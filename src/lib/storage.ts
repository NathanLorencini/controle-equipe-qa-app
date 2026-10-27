/**
 * Armazenamento chave/valor.
 *
 * Usa `window.storage` quando o ambiente oferece (Electron, Capacitor, extensão)
 * e cai para o `localStorage` do navegador. No navegador, os dados ficam só
 * naquele navegador daquela máquina.
 */
export const storage = {
  async get(key: string): Promise<string | null> {
    try {
      if (typeof window.storage?.get === 'function') {
        const r = await window.storage.get(key);
        // Alguns ambientes devolvem { value }, outros a string direto.
        if (r && typeof r === 'object' && 'value' in r) return (r as { value: string }).value ?? null;
        return typeof r === 'string' ? r : null;
      }
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  async set(key: string, value: string): Promise<void> {
    try {
      if (typeof window.storage?.set === 'function') {
        await window.storage.set(key, value);
        return;
      }
      localStorage.setItem(key, value);
    } catch (e) {
      console.error('storage.set error', e);
    }
  },
};
