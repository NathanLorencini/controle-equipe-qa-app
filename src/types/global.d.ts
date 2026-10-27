export {};

declare global {
  interface Window {
    /** Armazenamento oferecido pelo ambiente (Electron, Capacitor, extensão), se houver. */
    storage?: {
      get?: (key: string) => Promise<unknown> | unknown;
      set?: (key: string, value: string) => Promise<void> | void;
    };
  }
}
