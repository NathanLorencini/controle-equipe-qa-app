import { useState, type FormEvent } from 'react';
import { Lock, User } from 'lucide-react';
import { api, ErroDaApi, type Eu } from '../lib/api';

interface Props {
  onEntrou: (eu: Eu) => void;
}

const campo = 'w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500';

export default function Login({ onEntrou }: Props) {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const entrar = async (e: FormEvent) => {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      onEntrou(await api.entra(usuario.trim(), senha));
    } catch (falha) {
      setErro(falha instanceof ErroDaApi ? falha.message : 'não foi possível entrar');
      setSenha('');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 flex items-center justify-center">
      <form onSubmit={entrar} className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <User className="w-8 h-8 text-purple-600" />
          <h1 className="text-2xl font-bold text-gray-800">Controle de Equipe QA</h1>
        </div>
        <label htmlFor="login-usuario" className="block text-sm font-semibold text-gray-700 mb-2">Usuário</label>
        <input
          id="login-usuario"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          className={`${campo} mb-4`}
          required
          autoFocus
        />
        <label htmlFor="login-senha" className="block text-sm font-semibold text-gray-700 mb-2">Senha</label>
        <input
          id="login-senha"
          type="password"
          autoComplete="current-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className={`${campo} mb-4`}
          required
        />
        {erro && <p role="alert" className="mb-4 text-sm text-red-600">{erro.charAt(0).toUpperCase() + erro.slice(1)}.</p>}
        <button
          type="submit"
          disabled={enviando}
          className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors"
        >
          <Lock className="w-5 h-5" />{enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
