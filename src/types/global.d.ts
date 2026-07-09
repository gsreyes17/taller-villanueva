export {};

declare global {
  interface Window {
    electronAPI?: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      retry: () => Promise<void>;
      onMaximizeChange?: (cb: (isMax: boolean) => void) => (() => void) | undefined;
      isElectron: boolean;
    };
  }
}
