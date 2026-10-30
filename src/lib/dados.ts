import { storage } from './storage';
import { SITUACOES, type Membro, type Projeto, type Situacao } from '../types';

/**
 * Chave das versões sem banco, quando cada navegador guardava os próprios dados.
 * Hoje só é lida para oferecer a importação para a base compartilhada.
 */
const CHAVE = 'qa-equipe-dados';
/** Marca de que os dados deste navegador já foram enviados (ou o aviso dispensado). */
const CHAVE_IMPORTADO = 'qa-equipe-dados-importado';

let ultimoId = 0;

/** Id provisório para o que vem do navegador; o banco dá o definitivo. */
function novoId(): number {
  ultimoId = Math.max(Date.now(), ultimoId + 1);
  return ultimoId;
}

export function percentual(valor: unknown): number {
  const n = parseFloat(String(valor));
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

export function totalFoco(projetos: Projeto[]): number {
  return projetos.reduce((soma, p) => soma + p.percentualFoco, 0);
}

function normalizarProjeto(p: Partial<Projeto> & Record<string, unknown>): Projeto {
  const situacao = SITUACOES.includes(p.situacao as Situacao) ? (p.situacao as Situacao) : 'Em Andamento';
  return {
    id: typeof p.id === 'number' ? p.id : novoId(),
    nome: String(p.nome ?? ''),
    situacao,
    percentualFoco: percentual(p.percentualFoco),
    pros: String(p.pros ?? ''),
    contras: String(p.contras ?? ''),
  };
}

/**
 * Lê o que as versões sem banco deixaram neste navegador. Aceita o formato
 * antigo (percentual gravado como texto) e ignora o que não for reconhecível.
 * Lista vazia quando não há nada ou já foi importado.
 */
export async function carregarDoNavegador(): Promise<Membro[]> {
  if (await storage.get(CHAVE_IMPORTADO)) return [];
  const bruto = await storage.get(CHAVE);
  if (!bruto) return [];
  try {
    const lista: unknown = JSON.parse(bruto);
    if (!Array.isArray(lista)) return [];
    return lista
      .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object')
      .map((m) => ({
        id: typeof m.id === 'number' ? m.id : novoId(),
        nome: String(m.nome ?? ''),
        projetos: Array.isArray(m.projetos) ? m.projetos.map(normalizarProjeto) : [],
      }));
  } catch {
    return [];
  }
}

/** Não oferece mais a importação. Os dados antigos ficam no navegador, como cópia. */
export function marcarImportado(): Promise<void> {
  return storage.set(CHAVE_IMPORTADO, new Date().toISOString());
}
