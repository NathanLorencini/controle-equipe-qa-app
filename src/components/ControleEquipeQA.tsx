import { useEffect, useRef, useState } from 'react';
import { Download, Plus, User } from 'lucide-react';
import type { Membro, Projeto } from '../types';
import { carregar, novoId, salvar } from '../lib/dados';
import {
  exportarEquipeDocx, exportarEquipeXlsx, exportarMembroDocx, exportarMembroXlsx,
} from '../lib/exportar';
import CardMembro from './CardMembro';

async function tentar(acao: () => unknown, mensagem: string) {
  try {
    await acao();
  } catch (e) {
    console.error(mensagem, e);
    alert(`${mensagem} Veja o console para mais detalhes.`);
  }
}

export default function ControleEquipeQA() {
  const [membros, setMembros] = useState<Membro[]>([]);
  const [nomeQA, setNomeQA] = useState('');
  const [busca, setBusca] = useState('');
  const [abertos, setAbertos] = useState<Record<number, boolean>>({});
  const carregou = useRef(false);

  useEffect(() => {
    carregar().then((lista) => {
      setMembros(lista);
      carregou.current = true;
    });
  }, []);

  // Grava a cada mudança, mas só depois de ler o que já estava salvo
  // (senão a lista vazia do primeiro render apagaria os dados).
  useEffect(() => {
    if (carregou.current) salvar(membros);
  }, [membros]);

  const alterarMembro = (id: number, f: (m: Membro) => Membro) =>
    setMembros((lista) => lista.map((m) => (m.id === id ? f(m) : m)));

  const adicionarMembro = () => {
    const nome = nomeQA.trim();
    if (!nome) { alert('Por favor, insira o nome do QA'); return; }
    const novo: Membro = { id: novoId(), nome, projetos: [] };
    setMembros((lista) => [...lista, novo]);
    setAbertos((a) => ({ ...a, [novo.id]: true }));
    setNomeQA('');
  };

  const removerMembro = (id: number) => {
    if (!confirm('Deseja realmente remover este QA e todos seus projetos?')) return;
    setMembros((lista) => lista.filter((m) => m.id !== id));
  };

  const adicionarProjeto = (membroId: number) => {
    const projeto: Projeto = { id: novoId(), nome: '', situacao: 'Em Andamento', percentualFoco: 0, pros: '', contras: '' };
    alterarMembro(membroId, (m) => ({ ...m, projetos: [...m.projetos, projeto] }));
  };

  const alterarProjeto = (membroId: number, projetoId: number, campos: Partial<Projeto>) =>
    alterarMembro(membroId, (m) => ({
      ...m,
      projetos: m.projetos.map((p) => (p.id === projetoId ? { ...p, ...campos } : p)),
    }));

  const removerProjeto = (membroId: number, projetoId: number) =>
    alterarMembro(membroId, (m) => ({ ...m, projetos: m.projetos.filter((p) => p.id !== projetoId) }));

  const filtrados = membros.filter((m) => m.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 mb-8">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-8">
            <div className="flex items-center gap-3">
              <User className="w-8 h-8 text-purple-600" />
              <h1 className="text-3xl font-bold text-gray-800">Controle de Equipe QA</h1>
            </div>
            <div className="text-sm text-gray-500">{membros.length} QA(s) cadastrado(s)</div>
          </div>

          <div className="flex gap-3 mb-4">
            <input
              type="text"
              value={nomeQA}
              onChange={(e) => setNomeQA(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && adicionarMembro()}
              placeholder="Nome do QA"
              aria-label="Nome do QA"
              className="flex-1 min-w-0 px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
            />
            <button onClick={adicionarMembro} className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 transition-colors">
              <Plus className="w-5 h-5" />Adicionar QA
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-8">
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisar QA por nome..."
              aria-label="Pesquisar QA por nome"
              className="flex-1 min-w-[12rem] px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={() => tentar(() => exportarEquipeXlsx(membros), 'Erro ao exportar para .xlsx.')}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm flex items-center gap-2"
            >
              <Download className="w-4 h-4" />Exportar .xlsx
            </button>
            <button
              onClick={() => tentar(() => exportarEquipeDocx(membros), 'Erro ao exportar para .docx.')}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center gap-2"
            >
              <Download className="w-4 h-4" />Exportar .docx
            </button>
          </div>

          {filtrados.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <User className="w-16 h-16 mx-auto mb-4 opacity-50" />
              {membros.length === 0 ? (
                <>
                  <p className="text-lg">Nenhum QA cadastrado ainda</p>
                  <p className="text-sm">Adicione um QA para começar</p>
                </>
              ) : (
                <p className="text-lg">Nenhum QA encontrado para &ldquo;{busca}&rdquo;</p>
              )}
            </div>
          )}

          {filtrados.map((membro) => (
            <CardMembro
              key={membro.id}
              membro={membro}
              aberto={!!abertos[membro.id]}
              onAlternar={() => setAbertos((a) => ({ ...a, [membro.id]: !a[membro.id] }))}
              onRemover={() => removerMembro(membro.id)}
              onAdicionarProjeto={() => adicionarProjeto(membro.id)}
              onAlterarProjeto={(projetoId, campos) => alterarProjeto(membro.id, projetoId, campos)}
              onRemoverProjeto={(projetoId) => removerProjeto(membro.id, projetoId)}
              onExportarXlsx={() => tentar(() => exportarMembroXlsx(membro), 'Erro ao exportar QA para .xlsx.')}
              onExportarDocx={() => tentar(() => exportarMembroDocx(membro), 'Erro ao exportar QA para .docx.')}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
