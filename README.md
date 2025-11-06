# Controle Equipe QA (Vite + React + TypeScript)

Projeto scaffold criado para rodar o componente `controle-equipe-qa.tsx` em um app Vite + React + TypeScript com TailwindCSS.

Passos para rodar (PowerShell - Windows):

```powershell
cd controle-equipe-qa-app
npm install
npm run dev
```

Observações:
- O componente original usa `window.storage`; este scaffold fornece um wrapper (`src/lib/storage.ts`) que usa `window.storage` quando disponível e faz fallback para `localStorage` no navegador.
- Se seu runtime for Electron/Capacitor/extensão, mantenha a API `window.storage` e o wrapper a usará.
