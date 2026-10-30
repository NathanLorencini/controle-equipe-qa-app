import { useEffect, useState } from 'react';
import { Download, KeyRound, LogOut, Plus, Upload, User } from 'lucide-react';
import type { Membro } from '../types';
import { api, type Eu, type Usuario } from '../lib/api';
import { carregarDoNavegador, marcarImportado } from '../lib/dados';
import { useBaseCompartilhada, type Situacao } from '../lib/useBaseCompartilhada';
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

const avisar = (mensagem: string) => alert(mensagem);

const SITUACAO: Record<Situacao, { texto: string; cor: string }> = {
  carregando: { texto: 'Carregando…', cor: 'bg-gray-400' },
  sincronizado: { texto: 'Salvo — todos veem as mesmas informações', cor: 'bg-green-500' },
  salvando: { texto: 'Salvando…', cor: 'bg-amber-500' },
  'sem-conexao': { texto: 'Sem conexão com o servidor — tentando de novo', cor: 'bg-red-500' },
};

interface Props {
  eu: Eu;
  onSair: () => void;
  onTrocarSenha: () => void;
}

export default function ControleEquipeQA({ eu, onSair, onTrocarSenha }: Props) {
  const {
    membros, situacao, adicionarMembro: criarMembro, removerMembro: apagarMembro, vincularMembro,
    adicionarProjeto, alterarProjeto, removerProjeto, importar,
  } = useBaseCompartilhada(avisar);
  // Quem pode o que (a regra de verdade está no servidor; aqui só se esconde
  // o que a pessoa não pode fazer).
  const admin = eu.perfil === 'admin';
  const gereQAs = admin || eu.perfil === 'gestor';
  const podeEditar = (m: Membro) => admin || (m.usuarioId != null && m.usuarioId === eu.id);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [donoNovo, setDonoNovo] = useState('');
  const [nomeQA, setNomeQA] = useState('');
  const [busca, setBusca] = useState('');
  const [abertos, setAbertos] = useState<Record<number, boolean>>({});
  // O que versões antigas (sem banco) deixaram só neste navegador.
  const [doNavegador, setDoNavegador] = useState<Membro[]>([]);

  useEffect(() => {
    if (admin) carregarDoNavegador().then(setDoNavegador);
    if (gereQAs) api.usuarios().then(setUsuarios).catch(() => setUsuarios([]));
  }, [admin, gereQAs]);

  const adicionarMembro = async () => {
    const nome = nomeQA.trim();
    if (!nome) { alert('Por favor, insira o nome do QA'); return; }
    if (!donoNovo) { alert('Escolha o usuário dono deste QA (quem vai poder alterá-lo).'); return; }
    const novo = await criarMembro(nome, Number(donoNovo));
    if (novo) {
      setAbertos((a) => ({ ...a, [novo.id]: true }));
      setNomeQA('');
      setDonoNovo('');
    }
  };

  const removerMembro = (id: number) => {
    if (!confirm('Deseja realmente remover este QA e todos seus projetos? Isso vale para todos que usam o app.')) return;
    void apagarMembro(id);
  };

  const importarDoNavegador = async () => {
    const r = await importar(doNavegador);
    if (!r) return;
    await marcarImportado();
    setDoNavegador([]);
    alert(`Enviado para a base compartilhada: ${r.qas} QA(s) e ${r.projetos} projeto(s).`);
  };

  const dispensarImportacao = async () => {
    if (!confirm('Não enviar os dados deste navegador? Eles continuam guardados aqui, mas o aviso não aparece mais.')) return;
    await marcarImportado();
    setDoNavegador([]);
  };

  const filtrados = membros.filter((m) => m.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-end gap-3 mb-3 text-sm text-white/90">
          <span className="flex items-center gap-1">
            <User className="w-4 h-4" />{eu.usuario}
            {eu.perfil !== 'qa' && <span className="opacity-70">({eu.perfil === 'admin' ? 'administrador' : 'gestor'})</span>}
          </span>
          <button onClick={onTrocarSenha} className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-white/10">
            <KeyRound className="w-4 h-4" />Trocar senha
          </button>
          <button onClick={onSair} className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-white/10">
            <LogOut className="w-4 h-4" />Sair
          </button>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 mb-8">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-8">
            <div className="flex items-center gap-3">
              <User className="w-8 h-8 text-purple-600" />
              <h1 className="text-3xl font-bold text-gray-800">Controle de Equipe QA</h1>
            </div>
            <div className="flex flex-col items-end gap-1 text-sm text-gray-500">
              <span>{membros.length} QA(s) cadastrado(s)</span>
              <span className="flex items-center gap-2" role="status" aria-live="polite">
                <span className={`inline-block w-2 h-2 rounded-full ${SITUACAO[situacao].cor}`} />
                {SITUACAO[situacao].texto}
              </span>
            </div>
          </div>

          {doNavegador.length > 0 && (
            <div className="mb-6 p-4 rounded-lg border-2 border-amber-300 bg-amber-50 text-amber-900 flex flex-wrap items-center gap-3">
              <p className="flex-1 min-w-[16rem] text-sm">
                Este navegador tem <strong>{doNavegador.length} QA(s)</strong> salvos da versão antiga, que guardava os
                dados só aqui. Envie para a base compartilhada para que todos vejam.
              </p>
              <button onClick={importarDoNavegador} className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 text-sm flex items-center gap-2">
                <Upload className="w-4 h-4" />Enviar para a base compartilhada
              </button>
              <button onClick={dispensarImportacao} className="px-3 py-2 text-amber-800 hover:underline text-sm">
                Não enviar
              </button>
            </div>
          )}

          {gereQAs && <div className="flex flex-wrap gap-3 mb-4">
            <input
              type="text"
              value={nomeQA}
              onChange={(e) => setNomeQA(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && adicionarMembro()}
              placeholder="Nome do QA"
              aria-label="Nome do QA"
              className="flex-1 min-w-[12rem] px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
            />
            <select
              value={donoNovo}
              onChange={(e) => setDonoNovo(e.target.value)}
              aria-label="Usuário dono do QA"
              className="px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-gray-700"
            >
              <option value="">Usuário dono…</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.usuario}</option>)}
            </select>
            <button onClick={adicionarMembro} className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 transition-colors">
              <Plus className="w-5 h-5" />Adicionar QA
            </button>
          </div>}

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
              podeEditar={podeEditar(membro)}
              podeRemover={gereQAs}
              usuarios={admin ? usuarios : undefined}
              onVincular={admin ? (usuarioId) => void vincularMembro(membro.id, usuarioId) : undefined}
              onAlternar={() => setAbertos((a) => ({ ...a, [membro.id]: !a[membro.id] }))}
              onRemover={() => removerMembro(membro.id)}
              onAdicionarProjeto={() => void adicionarProjeto(membro.id)}
              onAlterarProjeto={(projetoId, campos) => alterarProjeto(membro.id, projetoId, campos)}
              onRemoverProjeto={(projetoId) => void removerProjeto(membro.id, projetoId)}
              onExportarXlsx={() => tentar(() => exportarMembroXlsx(membro), 'Erro ao exportar QA para .xlsx.')}
              onExportarDocx={() => tentar(() => exportarMembroDocx(membro), 'Erro ao exportar QA para .docx.')}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
