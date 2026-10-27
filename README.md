# Controle Equipe QA (Vite + React + TypeScript)

Projeto scaffold criado para rodar o componente `controle-equipe-qa.tsx` em um app Vite + React + TypeScript com TailwindCSS.

Roda igual no **Mac** e no **Windows**.

## Requisito

- **Node.js 18 ou mais novo** (recomendado: a versão LTS em https://nodejs.org).
  Confira com `node -v`.

## Rodar

**Mac (Terminal)**

```bash
cd controle-equipe-qa-app
npm install
npm run dev
```

**Windows (PowerShell)**

```powershell
cd controle-equipe-qa-app
npm install
npm run dev
```

Abra no navegador o endereço que aparecer (normalmente `http://localhost:5173`).
Para parar: `Ctrl + C` no terminal.

## Outros comandos

| Comando           | O que faz                                   |
|-------------------|---------------------------------------------|
| `npm run build`   | gera a versão final em `dist/`              |
| `npm run preview` | serve o `dist/` para conferir o build       |
| `npm run lint`    | confere o código com o ESLint               |

## Mac e Windows no mesmo repositório

- A pasta `node_modules/` **não vai para o git** (`.gitignore`). Cada máquina roda
  `npm install` e recebe os binários do próprio sistema (o Vite usa `esbuild` e
  `rollup`, que são nativos: os do Windows não rodam no Mac e vice-versa).
- Copiou o projeto de outra máquina (pendrive, zip) com `node_modules` junto e deu
  `Permission denied` ou erro de `esbuild`? Apague a pasta e reinstale:
  - Mac: `rm -rf node_modules && npm install`
  - Windows: `Remove-Item -Recurse -Force node_modules; npm install`
- O `.gitattributes` mantém o fim de linha igual (LF) nas duas, para não aparecer
  diff falso no arquivo inteiro.

## Observações

- O componente original usa `window.storage`; este scaffold fornece um wrapper (`src/lib/storage.ts`) que usa `window.storage` quando disponível e faz fallback para `localStorage` no navegador.
- Se seu runtime for Electron/Capacitor/extensão, mantenha a API `window.storage` e o wrapper a usará.
