export {};

declare global {
  interface Window {
    electronAPI?: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      retry: () => Promise<void>;
      exportarPDF: () => Promise<{ ok: boolean; error?: string }>;
      onMaximizeChange?: (cb: (isMax: boolean) => void) => (() => void) | undefined;
      isElectron: boolean;
    };
  }
}
