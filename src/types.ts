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
  projetos: Projeto[];
}
