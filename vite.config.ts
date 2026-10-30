import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Caminhos relativos: o build funciona na raiz do dominio (https://app/) ou
  // num subcaminho (https://intranet/controle-qa/) sem rebuild.
  base: './',
  // Em desenvolvimento a API roda a parte (npm run dev sobe os dois).
  server: { proxy: { '/api': 'http://localhost:3001' } },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // xlsx e docx sao grandes; ficam em arquivos proprios, cacheados a parte.
    rollupOptions: {
      output: {
        manualChunks: { xlsx: ['xlsx'], docx: ['docx'], react: ['react', 'react-dom'] },
      },
    },
  },
});
