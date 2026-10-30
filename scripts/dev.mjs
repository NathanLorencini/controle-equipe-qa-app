/**
 * Desenvolvimento: sobe a API (porta 3001, banco em dados/dev.db) e o Vite
 * juntos, no Mac e no Windows. Ctrl+C encerra os dois.
 *
 * Usuario para testar: DB_PATH=dados/dev.db npm run usuarios -- criar <nome>
 */
import { spawn } from 'node:child_process';

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const filhos = [
  spawn(process.execPath, ['server/index.mjs'], {
    stdio: 'inherit', env: { ...process.env, PORT: '3001', DB_PATH: 'dados/dev.db' },
  }),
  spawn(npx, ['vite'], { stdio: 'inherit', shell: process.platform === 'win32' }),
];
const encerra = () => { for (const f of filhos) f.kill(); process.exit(0); };
for (const f of filhos) f.on('exit', encerra);
process.on('SIGINT', encerra);
process.on('SIGTERM', encerra);
