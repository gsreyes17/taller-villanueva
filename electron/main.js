// =====================================================================
// Taller Villanueva — Proceso principal de Electron
// Envuelve el servidor Next.js embebido corriendo localmente (como Discord).
// La BD sigue siendo remota (Supabase): se requiere internet.
// =====================================================================
const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const { spawn } = require("node:child_process");

const isDev = !app.isPackaged;
const PORT = process.env.APP_PORT || "34567";
const START_URL = process.env.ELECTRON_START_URL || `http://localhost:${PORT}`;

let mainWindow = null;
let nextServer = null;

// --------------------------------------------------------------------
// Carga de variables de entorno para el server embebido (producción).
// Orden de búsqueda (gana el primero que exista):
//   1. <userData>/.env           -> editable por el usuario tras instalar
//   2. <resources>/app/.env      -> .env empaquetado (si se incluyó)
//   3. junto al ejecutable /.env
// --------------------------------------------------------------------
function parseEnv(content) {
  const out = {};
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function loadRuntimeEnv() {
  const candidates = [
    path.join(app.getPath("userData"), ".env"),
    path.join(process.resourcesPath || "", "app", ".env"),
    path.join(path.dirname(app.getPath("exe")), ".env"),
  ];
  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        console.log("[env] cargando", file);
        return parseEnv(fs.readFileSync(file, "utf8"));
      }
    } catch {
      /* ignore */
    }
  }
  console.warn("[env] no se encontró .env; el server podría no conectar a la BD.");
  return {};
}

/** Arranca el servidor Next.js standalone embebido (solo en producción). */
function startNextServer() {
  if (isDev) return; // en dev usamos `next dev` (ELECTRON_START_URL)

  // El contenido de .next/standalone se empaqueta en <resources>/app,
  // por lo que server.js queda en <resources>/app/server.js.
  const appDir = path.join(process.resourcesPath, "app");
  const serverPath = path.join(appDir, "server.js");
  const runtimeEnv = loadRuntimeEnv();

  nextServer = spawn(process.execPath, [serverPath], {
    cwd: appDir,
    env: {
      ...process.env,
      ...runtimeEnv,
      PORT,
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
      ELECTRON_RUN_AS_NODE: "1", // que Electron corra server.js como Node puro
    },
    stdio: "inherit",
  });
  nextServer.on("error", (err) => console.error("[next] error:", err));
  nextServer.on("exit", (code) => console.log("[next] server salió con código", code));
}

/** Espera hasta que /api/health responda OK (o agota reintentos). */
function waitForHealth(timeoutMs = 40000) {
  const started = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      const req = http.get(`${START_URL}/api/health`, (res) => {
        if (res.statusCode === 200) resolve(true);
        else retry();
        res.resume();
      });
      req.on("error", retry);
      req.setTimeout(3000, () => req.destroy());
    };
    const retry = () => {
      if (Date.now() - started > timeoutMs) resolve(false);
      else setTimeout(check, 800);
    };
    check();
  });
}

/** Devuelve la ruta del ícono de la ventana si existe (build/icon.ico o electron/logo.png). */
function resolveWindowIcon() {
  const candidates = [
    path.join(__dirname, "..", "build", "icon.ico"),
    path.join(__dirname, "logo.png"),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

function createWindow() {
  const icon = resolveWindowIcon();
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 850,
    minWidth: 1024,
    minHeight: 680,
    frame: false, // barra de título custom (ver TitleBar en la UI de Next)
    backgroundColor: "#fbeee0",
    show: false,
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Pantalla de carga branded mientras el servidor/health resuelven.
  mainWindow.loadFile(path.join(__dirname, "loading.html"));
  mainWindow.once("ready-to-show", () => mainWindow.show());

  // Abrir enlaces externos en el navegador del sistema.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Refleja el estado maximizado a la UI (para el ícono de restaurar).
  const emitMax = () =>
    mainWindow?.webContents.send("window:maximized", mainWindow.isMaximized());
  mainWindow.on("maximize", emitMax);
  mainWindow.on("unmaximize", emitMax);
  mainWindow.on("closed", () => (mainWindow = null));
}

async function boot() {
  if (!mainWindow) createWindow();
  startNextServer();
  const healthy = await waitForHealth();
  if (!mainWindow) return;
  if (healthy) {
    mainWindow.loadURL(START_URL);
  } else {
    // Nunca mostrar un error crudo: pantalla clara de "sin conexión".
    mainWindow.loadFile(path.join(__dirname, "loading.html"), { hash: "offline" });
  }
}

// ------------------- IPC: controles de ventana ----------------------
ipcMain.on("window:minimize", () => mainWindow?.minimize());
ipcMain.on("window:maximize", () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on("window:close", () => mainWindow?.close());

// Exporta la vista actual (reporte) a un PDF nativo, sin el encabezado
// "localhost / fecha" que agrega el navegador. Respeta el @media print,
// por lo que el sidebar/header ya vienen ocultos.
ipcMain.handle("app:exportPDF", async () => {
  if (!mainWindow) return { ok: false, error: "sin ventana" };
  try {
    const data = await mainWindow.webContents.printToPDF({
      printBackground: true,
      margins: { marginType: "default" },
      pageSize: "A4",
    });
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: "Guardar reporte como PDF",
      defaultPath: `reporte-${stamp}.pdf`,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (canceled || !filePath) return { ok: false };
    fs.writeFileSync(filePath, data);
    shell.openPath(filePath); // abre el PDF recién guardado
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle("app:retry", async () => {
  if (mainWindow) mainWindow.loadFile(path.join(__dirname, "loading.html"));
  await boot();
});

app.whenReady().then(boot);

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) boot();
});
app.on("window-all-closed", () => {
  if (nextServer) nextServer.kill();
  if (process.platform !== "darwin") app.quit();
});
app.on("before-quit", () => {
  if (nextServer) nextServer.kill();
});
