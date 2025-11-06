import React, { useState, useEffect } from 'react';
import { Plus, Trash2, User, Briefcase, AlertCircle, ChevronDown, Download } from 'lucide-react';
import { storage } from '../lib/storage';
import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from 'docx';

interface Projeto {
  id: number;
  nome: string;
  situacao: string;
  percentualFoco: number | string;
  pros: string;
  contras: string;
}

interface Membro {
  id: number;
  nome: string;
  projetos: Projeto[];
}

export default function ControleEquipeQA() {
  const [membros, setMembros] = useState<Membro[]>([]);
  const [nomeQA, setNomeQA] = useState('');
  const [search, setSearch] = useState('');
  const [openMap, setOpenMap] = useState<Record<number, boolean>>({});

  useEffect(() => { carregarDados(); }, []);

  const carregarDados = async () => {
    try {
      const result: any = await storage.get('qa-equipe-dados');
      if (result && result.value) setMembros(JSON.parse(result.value));
    } catch (e) { /* ignore */ }
  };

  const salvarDados = async (novos: Membro[]) => {
    try { await storage.set('qa-equipe-dados', JSON.stringify(novos)); } catch (e) { console.error(e); }
  };

  const adicionarMembro = () => {
    if (!nomeQA.trim()) { alert('Por favor, insira o nome do QA'); return; }
    const novo: Membro = { id: Date.now(), nome: nomeQA.trim(), projetos: [] };
    const novos = [...membros, novo]; setMembros(novos); salvarDados(novos); setNomeQA(''); setOpenMap((prev: Record<number, boolean>) => ({ ...prev, [novo.id]: true }));
  };

  const removerMembro = (id: number) => {
    if (!confirm('Deseja realmente remover este QA e todos seus projetos?')) return;
    const novos = membros.filter((m: Membro) => m.id !== id); setMembros(novos); salvarDados(novos);
  };

  const adicionarProjeto = (membroId: number) => {
    const novos = membros.map((m: Membro) => m.id === membroId ? ({ ...m, projetos: [...m.projetos, { id: Date.now(), nome: '', situacao: 'Em Andamento', percentualFoco: 0, pros: '', contras: '' }] }) : m);
    setMembros(novos); salvarDados(novos);
  };

  const removerProjeto = (membroId: number, projetoId: number) => {
    const novos = membros.map((m: Membro) => m.id === membroId ? ({ ...m, projetos: m.projetos.filter((p: Projeto) => p.id !== projetoId) }) : m);
    setMembros(novos); salvarDados(novos);
  };

  const atualizarProjeto = (membroId: number, projetoId: number, campo: keyof Projeto, valor: any) => {
    const novos = membros.map((m: Membro) => {
      if (m.id !== membroId) return m;
      return { ...m, projetos: m.projetos.map((p: Projeto) => p.id === projetoId ? ({ ...p, [campo]: valor }) : p) };
    });
    setMembros(novos); salvarDados(novos);
  };

  const calcularTotalFoco = (projetos: Projeto[]) => projetos.reduce((s, p) => s + (parseFloat(String(p.percentualFoco)) || 0), 0);

  const toggleOpen = (id: number) => setOpenMap((prev: Record<number, boolean>) => ({ ...prev, [id]: !prev[id] }));

  const filteredMembros = membros.filter((m: Membro) => m.nome.toLowerCase().includes(search.toLowerCase()));

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  const exportToXlsx = () => {
    const wb = XLSX.utils.book_new();
  membros.forEach((m: Membro) => {
      const data: any[] = [['Projeto','Situação','PercentualFoco','Prós','Contras']];
      if (m.projetos.length === 0) data.push(['(Nenhum projeto)', '','', '','']);
  else m.projetos.forEach((p: Projeto) => data.push([p.nome || '', p.situacao || '', String(p.percentualFoco || ''), p.pros || '', p.contras || '']));
      const ws = XLSX.utils.aoa_to_sheet(data);
      const name = (m.nome || 'QA').substring(0,31) || 'QA';
      XLSX.utils.book_append_sheet(wb, ws, name);
    });
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    downloadBlob(blob, 'controle-equipe-qa.xlsx');
  };

  const exportToDocx = async () => {
    try {
      const doc = new Document({ sections: [] });
  membros.forEach((m: Membro, idx: number) => {
        const children: any[] = [];
        children.push(new Paragraph({ text: m.nome || 'QA', heading: HeadingLevel.HEADING_2 }));
        if (m.projetos.length === 0) children.push(new Paragraph({ text: '(Nenhum projeto)' }));
        else {
          m.projetos.forEach((p: Projeto) => {
            children.push(new Paragraph({ text: `Projeto: ${p.nome || ''}`, spacing: { after: 100 } }));
            children.push(new Paragraph({ text: `Situação: ${p.situacao || ''}` }));
            children.push(new Paragraph({ text: `Percentual de Foco: ${p.percentualFoco}` }));
            children.push(new Paragraph({ text: `Prós: ${p.pros || ''}` }));
            children.push(new Paragraph({ text: `Contras: ${p.contras || ''}` }));
            children.push(new Paragraph({ text: '---', spacing: { after: 200 } }));
          });
        }
        doc.addSection({ properties: {}, children });
      });
      const blob: Blob = await Packer.toBlob(doc);
      downloadBlob(blob, 'controle-equipe-qa.docx');
    } catch (err) {
      console.error('Erro ao gerar DOCX:', err);
      alert('Erro ao exportar para .docx — veja o console para mais detalhes.');
    }
  };

  const exportMembroToXlsx = (m: Membro) => {
    const wb = XLSX.utils.book_new();
    const data: any[] = [['Projeto','Situação','PercentualFoco','Prós','Contras']];
    if (m.projetos.length === 0) data.push(['(Nenhum projeto)', '','','','']);
    else m.projetos.forEach(p => data.push([p.nome||'', p.situacao||'', String(p.percentualFoco||''), p.pros||'', p.contras||'']));
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, (m.nome||'QA').substring(0,31));
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    const safeName = (m.nome || 'qa').replace(/[^a-z0-9-_\.]/gi, '_');
    downloadBlob(blob, `qa-${safeName}.xlsx`);
  };

  const exportMembroToDocx = async (m: Membro) => {
    try {
      const doc = new Document({ sections: [] });
      const children: any[] = [ new Paragraph({ text: m.nome || 'QA', heading: HeadingLevel.HEADING_2 }) ];
      if (m.projetos.length === 0) children.push(new Paragraph({ text: '(Nenhum projeto)' }));
      else {
        m.projetos.forEach(p => {
          children.push(new Paragraph({ text: `Projeto: ${p.nome || ''}`, spacing: { after: 100 } }));
          children.push(new Paragraph({ text: `Situação: ${p.situacao || ''}` }));
          children.push(new Paragraph({ text: `Percentual de Foco: ${p.percentualFoco}` }));
          children.push(new Paragraph({ text: `Prós: ${p.pros || ''}` }));
          children.push(new Paragraph({ text: `Contras: ${p.contras || ''}` }));
          children.push(new Paragraph({ text: '---', spacing: { after: 200 } }));
        });
      }
      doc.addSection({ properties: {}, children });
      const blob: Blob = await Packer.toBlob(doc);
      const safeName = (m.nome || 'qa').replace(/[^a-z0-9-_\.]/gi, '_');
      downloadBlob(blob, `qa-${safeName}.docx`);
    } catch (err) {
      console.error('Erro ao gerar DOCX do membro:', err);
      alert('Erro ao exportar QA para .docx — veja o console para mais detalhes.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl p-8 mb-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <User className="w-8 h-8 text-purple-600" />
              <h1 className="text-3xl font-bold text-gray-800">Controle de Equipe QA</h1>
            </div>
            <div className="text-sm text-gray-500">{membros.length} QA(s) cadastrado(s)</div>
          </div>

          <div className="flex gap-3 mb-4">
            <input type="text" value={nomeQA} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNomeQA(e.target.value)} onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && adicionarMembro()} placeholder="Nome do QA" className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500" />
            <button onClick={adicionarMembro} className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 transition-colors"><Plus className="w-5 h-5" />Adicionar QA</button>
          </div>

          <div className="flex items-center gap-3 mb-8">
            <input type="search" value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} placeholder="Pesquisar QA por nome..." className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500" />
            <button onClick={exportToXlsx} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm flex items-center gap-2"><Download className="w-4 h-4" />Exportar .xlsx</button>
            <button onClick={exportToDocx} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center gap-2"><Download className="w-4 h-4" />Exportar .docx</button>
          </div>

          {filteredMembros.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <User className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">Nenhum QA cadastrado ainda</p>
              <p className="text-sm">Adicione um QA para começar</p>
            </div>
          )}

          {filteredMembros.map((membro) => {
            const totalFoco = calcularTotalFoco(membro.projetos);
            const focoExcedido = totalFoco > 100;
            const isOpen = !!openMap[membro.id];

            return (
              <div key={membro.id} className="mb-8 border-2 border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button onClick={() => toggleOpen(membro.id)} aria-expanded={isOpen} className={`p-1 rounded-md hover:bg-white/20 transition-transform ${isOpen ? 'rotate-180' : ''}`} title={isOpen ? 'Recolher' : 'Expandir'}><ChevronDown className="w-5 h-5" /></button>
                      <User className="w-6 h-6" />
                      <h2 className="text-2xl font-bold">{membro.nome}</h2>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm opacity-80">Total de Foco</div>
                        <div className={`text-2xl font-bold ${focoExcedido ? 'text-red-300' : ''}`}>{totalFoco}%</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm opacity-80">Projetos</div>
                        <div className="text-2xl font-bold">{membro.projetos.length}</div>
                      </div>
                      <button onClick={() => removerMembro(membro.id)} className="p-2 hover:bg-white/20 rounded-lg transition-colors"><Trash2 className="w-5 h-5" /></button>
                    </div>
                  </div>
                  {focoExcedido && (<div className="mt-3 flex items-center gap-2 text-red-300 text-sm"><AlertCircle className="w-4 h-4" /><span>Atenção: O foco total excede 100%</span></div>)}
                </div>

                {isOpen && (
                  <div className="p-6 bg-gray-50">
                    {membro.projetos.length === 0 ? (
                      <div className="text-center py-8 text-gray-400"><Briefcase className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>Nenhum projeto atribuído</p></div>
                    ) : (
                      <div className="space-y-4">
                        {membro.projetos.map((projeto) => (
                          <div key={projeto.id} className="bg-white rounded-lg p-5 shadow-md border border-gray-200">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                              <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Nome do Projeto</label>
                                <input type="text" value={projeto.nome} onChange={(e: React.ChangeEvent<HTMLInputElement>) => atualizarProjeto(membro.id, projeto.id, 'nome', e.target.value)} placeholder="Digite o nome do projeto" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500" />
                              </div>
                              <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Situação Atual</label>
                                <select value={projeto.situacao} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => atualizarProjeto(membro.id, projeto.id, 'situacao', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500">
                                  <option value="Planejamento">Planejamento</option>
                                  <option value="Em Andamento">Em Andamento</option>
                                  <option value="Testes">Testes</option>
                                  <option value="Homologação">Homologação</option>
                                  <option value="Concluído">Concluído</option>
                                  <option value="Pausado">Pausado</option>
                                </select>
                              </div>
                            </div>

                            <div className="mb-4">
                              <label className="block text-sm font-semibold text-gray-700 mb-2">Percentual de Foco (%)</label>
                              <div className="flex items-center gap-3">
                                <input type="range" min={0} max={100} step={5} value={String(projeto.percentualFoco)} onChange={(e: React.ChangeEvent<HTMLInputElement>) => atualizarProjeto(membro.id, projeto.id, 'percentualFoco', e.target.value)} className="flex-1" />
                                <input type="number" min={0} max={100} value={String(projeto.percentualFoco)} onChange={(e: React.ChangeEvent<HTMLInputElement>) => atualizarProjeto(membro.id, projeto.id, 'percentualFoco', e.target.value)} className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-center" />
                                <span className="text-gray-600 font-semibold">%</span>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                              <div>
                                <label className="block text-sm font-semibold text-green-700 mb-2">Prós para o QA</label>
                                <textarea value={projeto.pros} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => atualizarProjeto(membro.id, projeto.id, 'pros', e.target.value)} placeholder="Pontos positivos do projeto..." rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500 resize-none" />
                              </div>
                              <div>
                                <label className="block text-sm font-semibold text-red-700 mb-2">Contras para o QA</label>
                                <textarea value={projeto.contras} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => atualizarProjeto(membro.id, projeto.id, 'contras', e.target.value)} placeholder="Pontos negativos ou desafios..." rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-red-500 resize-none" />
                              </div>
                            </div>

                            <div className="flex justify-end">
                              <button onClick={() => removerProjeto(membro.id, projeto.id)} className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2 transition-colors"><Trash2 className="w-4 h-4" />Remover Projeto</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 flex gap-2">
                      <button onClick={() => adicionarProjeto(membro.id)} className="px-4 py-2 border-2 border-dashed border-purple-300 text-purple-600 rounded-lg hover:bg-purple-50 flex items-center gap-2"> <Plus className="w-4 h-4" /> Adicionar Projeto</button>
                      <button onClick={() => exportMembroToXlsx(membro)} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm flex items-center gap-2"><Download className="w-4 h-4" />Exportar QA .xlsx</button>
                      <button onClick={() => exportMembroToDocx(membro)} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center gap-2"><Download className="w-4 h-4" />Exportar QA .docx</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
