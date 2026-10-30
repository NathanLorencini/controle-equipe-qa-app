export const SITUACOES = [
  'Planejamento',
  'Em Andamento',
  'Testes',
  'Homologação',
  'Concluído',
  'Pausado',
] as const;

export type Situacao = (typeof SITUACOES)[number];

export interface Projeto {
  id: number;
  nome: string;
  situacao: Situacao;
  percentualFoco: number;
  pros: string;
  contras: string;
}

export interface Membro {
  id: number;
  nome: string;
  /** Usuário dono do QA (só ele, e o admin, alteram). null = sem dono. */
  usuarioId?: number | null;
  usuario?: string | null;
  projetos: Projeto[];
}

/** admin: tudo; gestor: cria e remove QAs; qa: só o próprio QA. */
export type Perfil = 'admin' | 'gestor' | 'qa';
