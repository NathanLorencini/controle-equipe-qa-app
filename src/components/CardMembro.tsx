import { AlertCircle, Briefcase, ChevronDown, Download, Plus, Trash2, User } from 'lucide-react';
import type { Membro, Projeto } from '../types';
import { totalFoco } from '../lib/dados';
import CardProjeto from './CardProjeto';

interface Props {
  membro: Membro;
  aberto: boolean;
  onAlternar: () => void;
  onRemover: () => void;
  onAdicionarProjeto: () => void;
  onAlterarProjeto: (projetoId: number, campos: Partial<Projeto>) => void;
  onRemoverProjeto: (projetoId: number) => void;
  onExportarXlsx: () => void;
  onExportarDocx: () => void;
}

export default function CardMembro({
  membro, aberto, onAlternar, onRemover, onAdicionarProjeto,
  onAlterarProjeto, onRemoverProjeto, onExportarXlsx, onExportarDocx,
}: Props) {
  const total = totalFoco(membro.projetos);
  const excedido = total > 100;

  return (
    <div className="mb-8 border-2 border-gray-200 rounded-xl overflow-hidden">
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onAlternar}
              aria-expanded={aberto}
              className={`p-1 rounded-md hover:bg-white/20 transition-transform ${aberto ? 'rotate-180' : ''}`}
              title={aberto ? 'Recolher' : 'Expandir'}
            >
              <ChevronDown className="w-5 h-5" />
            </button>
            <User className="w-6 h-6" />
            <h2 className="text-2xl font-bold">{membro.nome}</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm opacity-80">Total de Foco</div>
              <div className={`text-2xl font-bold ${excedido ? 'text-red-300' : ''}`}>{total}%</div>
            </div>
            <div className="text-right">
              <div className="text-sm opacity-80">Projetos</div>
              <div className="text-2xl font-bold">{membro.projetos.length}</div>
            </div>
            <button onClick={onRemover} title="Remover QA" aria-label={`Remover ${membro.nome}`} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
        {excedido && (
          <div className="mt-3 flex items-center gap-2 text-red-300 text-sm">
            <AlertCircle className="w-4 h-4" /><span>Atenção: O foco total excede 100%</span>
          </div>
        )}
      </div>

      {aberto && (
        <div className="p-6 bg-gray-50">
          {membro.projetos.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>Nenhum projeto atribuído</p>
            </div>
          ) : (
            <div className="space-y-4">
              {membro.projetos.map((projeto) => (
                <CardProjeto
                  key={projeto.id}
                  projeto={projeto}
                  onAlterar={(campos) => onAlterarProjeto(projeto.id, campos)}
                  onRemover={() => onRemoverProjeto(projeto.id)}
                />
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={onAdicionarProjeto} className="px-4 py-2 border-2 border-dashed border-purple-300 text-purple-600 rounded-lg hover:bg-purple-50 flex items-center gap-2">
              <Plus className="w-4 h-4" /> Adicionar Projeto
            </button>
            <button onClick={onExportarXlsx} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm flex items-center gap-2">
              <Download className="w-4 h-4" />Exportar QA .xlsx
            </button>
            <button onClick={onExportarDocx} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center gap-2">
              <Download className="w-4 h-4" />Exportar QA .docx
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
