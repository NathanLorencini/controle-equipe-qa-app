import { useState, type FormEvent } from 'react';
import { KeyRound } from 'lucide-react';
import { api, ErroDaApi } from '../lib/api';

interface Props {
  usuario: string;
  /** Senha provisória: não há como fechar sem trocar (só sair). */
  obrigatoria: boolean;
  onTrocou: () => void;
  onCancelar: () => void;
}

const SENHA_MINIMA = 8;
const campo = 'w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 mb-4';

export default function TrocarSenha({ usuario, obrigatoria, onTrocou, onCancelar }: Props) {
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const trocar = async (e: FormEvent) => {
    e.preventDefault();
    setErro('');
    if (nova.length < SENHA_MINIMA) { setErro(`A senha nova precisa de pelo menos ${SENHA_MINIMA} caracteres.`); return; }
    if (nova !== confirmacao) { setErro('A confirmação não é igual à senha nova.'); return; }
    setEnviando(true);
    try {
      await api.trocaSenha(atual, nova);
      onTrocou();
    } catch (falha) {
      const msg = falha instanceof ErroDaApi ? falha.message : 'não foi possível trocar a senha';
      setErro(`${msg.charAt(0).toUpperCase()}${msg.slice(1)}.`);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 flex items-center justify-center">
      <form onSubmit={trocar} className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8">
        <div className="flex items-center gap-3 mb-2">
          <KeyRound className="w-7 h-7 text-purple-600" />
          <h1 className="text-2xl font-bold text-gray-800">Trocar senha</h1>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          {obrigatoria
            ? `Olá, ${usuario}. Sua senha é provisória: crie uma senha só sua para continuar.`
            : `Usuário: ${usuario}`}
        </p>
        <label htmlFor="senha-atual" className="block text-sm font-semibold text-gray-700 mb-2">
          {obrigatoria ? 'Senha provisória' : 'Senha atual'}
        </label>
        <input id="senha-atual" type="password" autoComplete="current-password" value={atual}
          onChange={(e) => setAtual(e.target.value)} className={campo} required autoFocus />
        <label htmlFor="senha-nova" className="block text-sm font-semibold text-gray-700 mb-2">
          Senha nova (mínimo {SENHA_MINIMA} caracteres)
        </label>
        <input id="senha-nova" type="password" autoComplete="new-password" value={nova}
          onChange={(e) => setNova(e.target.value)} className={campo} required />
        <label htmlFor="senha-confirmacao" className="block text-sm font-semibold text-gray-700 mb-2">Confirme a senha nova</label>
        <input id="senha-confirmacao" type="password" autoComplete="new-password" value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)} className={campo} required />
        {erro && <p role="alert" className="mb-4 text-sm text-red-600">{erro}</p>}
        <button type="submit" disabled={enviando}
          className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-60 transition-colors">
          {enviando ? 'Salvando…' : 'Salvar senha nova'}
        </button>
        <button type="button" onClick={onCancelar} className="w-full mt-3 px-6 py-2 text-gray-600 hover:underline text-sm">
          {obrigatoria ? 'Sair' : 'Cancelar'}
        </button>
      </form>
    </div>
  );
}
