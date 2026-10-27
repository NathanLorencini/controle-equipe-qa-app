import * as XLSX from 'xlsx';
import { Document, HeadingLevel, Packer, Paragraph } from 'docx';
import type { Membro } from '../types';

const CABECALHO = ['Projeto', 'Situação', 'Percentual de Foco (%)', 'Prós', 'Contras'];

function baixar(blob: Blob, arquivo: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = arquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function nomeDeArquivo(nome: string): string {
  return (nome || 'qa').replace(/[^a-z0-9_.-]/gi, '_');
}

/**
 * Nome de aba aceito pelo Excel: até 31 caracteres, sem : \ / ? * [ ]
 * e sem repetir (dois QAs com o mesmo nome quebravam a exportação).
 */
function nomeDeAba(nome: string, usados: Set<string>): string {
  const base = (nome.replace(/[:\\/?*[\]]/g, '_').trim() || 'QA').substring(0, 31);
  let candidato = base;
  for (let i = 2; usados.has(candidato.toLowerCase()); i++) {
    const sufixo = ` (${i})`;
    candidato = base.substring(0, 31 - sufixo.length) + sufixo;
  }
  usados.add(candidato.toLowerCase());
  return candidato;
}

function planilha(membro: Membro): XLSX.WorkSheet {
  const linhas: (string | number)[][] = [CABECALHO];
  if (membro.projetos.length === 0) linhas.push(['(Nenhum projeto)', '', '', '', '']);
  for (const p of membro.projetos) linhas.push([p.nome, p.situacao, p.percentualFoco, p.pros, p.contras]);
  return XLSX.utils.aoa_to_sheet(linhas);
}

function gravarXlsx(membros: Membro[], arquivo: string) {
  const wb = XLSX.utils.book_new();
  const usados = new Set<string>();
  for (const m of membros) XLSX.utils.book_append_sheet(wb, planilha(m), nomeDeAba(m.nome, usados));
  if (membros.length === 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([CABECALHO]), 'Equipe');
  XLSX.writeFile(wb, arquivo);
}

function paragrafos(membro: Membro): Paragraph[] {
  const filhos = [new Paragraph({ text: membro.nome || 'QA', heading: HeadingLevel.HEADING_2 })];
  if (membro.projetos.length === 0) filhos.push(new Paragraph({ text: '(Nenhum projeto)' }));
  for (const p of membro.projetos) {
    filhos.push(
      new Paragraph({ text: `Projeto: ${p.nome}`, spacing: { after: 100 } }),
      new Paragraph({ text: `Situação: ${p.situacao}` }),
      new Paragraph({ text: `Percentual de Foco: ${p.percentualFoco}%` }),
      new Paragraph({ text: `Prós: ${p.pros}` }),
      new Paragraph({ text: `Contras: ${p.contras}` }),
      new Paragraph({ text: '---', spacing: { after: 200 } }),
    );
  }
  return filhos;
}

async function gravarDocx(membros: Membro[], arquivo: string) {
  // docx 8: as seções vão no construtor (o antigo doc.addSection não existe mais).
  const doc = new Document({
    sections: membros.length
      ? membros.map((m) => ({ children: paragrafos(m) }))
      : [{ children: [new Paragraph({ text: 'Nenhum QA cadastrado.' })] }],
  });
  baixar(await Packer.toBlob(doc), arquivo);
}

export const exportarEquipeXlsx = (membros: Membro[]) => gravarXlsx(membros, 'controle-equipe-qa.xlsx');
export const exportarEquipeDocx = (membros: Membro[]) => gravarDocx(membros, 'controle-equipe-qa.docx');
export const exportarMembroXlsx = (m: Membro) => gravarXlsx([m], `qa-${nomeDeArquivo(m.nome)}.xlsx`);
export const exportarMembroDocx = (m: Membro) => gravarDocx([m], `qa-${nomeDeArquivo(m.nome)}.docx`);
