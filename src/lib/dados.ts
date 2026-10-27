import { storage } from './storage';
import { SITUACOES, type Membro, type Projeto, type Situacao } from '../types';

/** Chave usada desde a primeira versão: não mudar, ou os dados salvos somem da tela. */
const CHAVE = 'qa-equipe-dados';

let ultimoId = 0;

/** Id único mesmo com dois cliques no mesmo milissegundo. */
export function novoId(): number {
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
 * Lê os dados salvos. Aceita o formato antigo (percentual gravado como texto)
 * e ignora o que não for reconhecível, em vez de quebrar a tela.
 */
export async function carregar(): Promise<Membro[]> {
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

export function salvar(membros: Membro[]): Promise<void> {
  return storage.set(CHAVE, JSON.stringify(membros));
}
