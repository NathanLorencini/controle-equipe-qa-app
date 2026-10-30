import { Trash2 } from 'lucide-react';
import { SITUACOES, type Projeto } from '../types';
import { percentual } from '../lib/dados';

interface Props {
  projeto: Projeto;
  /** Projeto de outro QA: aparece, mas não dá para alterar nem remover. */
  somenteLeitura?: boolean;
  onAlterar: (campos: Partial<Projeto>) => void;
  onRemover: () => void;
}

const campo = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none disabled:bg-gray-100 disabled:text-gray-600';

export default function CardProjeto({ projeto, somenteLeitura = false, onAlterar, onRemover }: Props) {
  const id = `projeto-${projeto.id}`;

  return (
    <div className="bg-white rounded-lg p-5 shadow-md border border-gray-200">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label htmlFor={`${id}-nome`} className="block text-sm font-semibold text-gray-700 mb-2">Nome do Projeto</label>
          <input
            id={`${id}-nome`}
            type="text"
            value={projeto.nome}
            disabled={somenteLeitura}
            onChange={(e) => onAlterar({ nome: e.target.value })}
            placeholder="Digite o nome do projeto"
            className={`${campo} focus:border-purple-500`}
          />
        </div>
        <div>
          <label htmlFor={`${id}-situacao`} className="block text-sm font-semibold text-gray-700 mb-2">Situação Atual</label>
          <select
            id={`${id}-situacao`}
            value={projeto.situacao}
            disabled={somenteLeitura}
            onChange={(e) => onAlterar({ situacao: e.target.value as Projeto['situacao'] })}
            className={`${campo} focus:border-purple-500`}
          >
            {SITUACOES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="mb-4">
        <label htmlFor={`${id}-foco`} className="block text-sm font-semibold text-gray-700 mb-2">Percentual de Foco (%)</label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={projeto.percentualFoco}
            disabled={somenteLeitura}
            onChange={(e) => onAlterar({ percentualFoco: percentual(e.target.value) })}
            aria-label="Percentual de foco"
            className="flex-1"
          />
          <input
            id={`${id}-foco`}
            type="number"
            min={0}
            max={100}
            value={projeto.percentualFoco}
            disabled={somenteLeitura}
            onChange={(e) => onAlterar({ percentualFoco: percentual(e.target.value) })}
            className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-center"
          />
          <span className="text-gray-600 font-semibold">%</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label htmlFor={`${id}-pros`} className="block text-sm font-semibold text-green-700 mb-2">Prós para o QA</label>
          <textarea
            id={`${id}-pros`}
            value={projeto.pros}
            disabled={somenteLeitura}
            onChange={(e) => onAlterar({ pros: e.target.value })}
            placeholder="Pontos positivos do projeto..."
            rows={3}
            className={`${campo} focus:border-green-500 resize-none`}
          />
        </div>
        <div>
          <label htmlFor={`${id}-contras`} className="block text-sm font-semibold text-red-700 mb-2">Contras para o QA</label>
          <textarea
            id={`${id}-contras`}
            value={projeto.contras}
            disabled={somenteLeitura}
            onChange={(e) => onAlterar({ contras: e.target.value })}
            placeholder="Pontos negativos ou desafios..."
            rows={3}
            className={`${campo} focus:border-red-500 resize-none`}
          />
        </div>
      </div>

      {!somenteLeitura && <div className="flex justify-end">
        <button onClick={onRemover} className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2 transition-colors">
          <Trash2 className="w-4 h-4" />Remover Projeto
        </button>
      </div>}
    </div>
  );
}
