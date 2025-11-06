export const storage = {
  async get(key: string) {
    try {
      // Prefer runtime-provided API (Electron/Capacitor/etc.)
      // if not available, fall back to localStorage
      // Some runtimes return { value } like the original code expects
      if (typeof (window as any).storage?.get === 'function') {
        return (window as any).storage.get(key);
      }
      const v = localStorage.getItem(key);
      return v ? { value: v } : null;
    } catch (e) {
      return null;
    }
  },
  async set(key: string, value: string) {
    try {
      if (typeof (window as any).storage?.set === 'function') {
        return (window as any).storage.set(key, value);
      }
      localStorage.setItem(key, value);
    } catch (e) {
      console.error('storage.set error', e);
    }
  }
}
