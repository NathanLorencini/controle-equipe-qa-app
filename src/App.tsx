import { useEffect, useState } from 'react';
import ControleEquipeQA from './components/ControleEquipeQA';
import Login from './components/Login';
import TrocarSenha from './components/TrocarSenha';
import { api, ErroDaApi, SESSAO_ENCERRADA, type Eu } from './lib/api';

/**
 * Porta de entrada: sem sessão, login; com senha provisória, troca de senha;
 * só então o controle. Sessão expirada no meio do uso volta para o login.
 */
export default function App() {
  const [eu, setEu] = useState<Eu | null | undefined>(undefined);
  const [trocandoSenha, setTrocandoSenha] = useState(false);
  const [semServidor, setSemServidor] = useState(false);

  useEffect(() => {
    api.eu().then(setEu).catch((e) => {
      if (e instanceof ErroDaApi && e.status === 0) setSemServidor(true);
      setEu(null);
    });
    const expirou = () => setEu(null);
    window.addEventListener(SESSAO_ENCERRADA, expirou);
    return () => window.removeEventListener(SESSAO_ENCERRADA, expirou);
  }, []);

  const sair = async () => {
    await api.sai().catch(() => {});
    setTrocandoSenha(false);
    setEu(null);
  };

  if (eu === undefined) return null;
  if (!eu) {
    return (
      <>
        {semServidor && (
          <p role="alert" className="fixed top-0 inset-x-0 p-2 text-center text-sm bg-red-600 text-white">
            Sem conexão com o servidor.
          </p>
        )}
        <Login onEntrou={(novo) => { setSemServidor(false); setEu(novo); }} />
      </>
    );
  }
  if (eu.trocarSenha || trocandoSenha) {
    return (
      <TrocarSenha
        usuario={eu.usuario}
        obrigatoria={eu.trocarSenha}
        onTrocou={() => { setTrocandoSenha(false); setEu({ ...eu, trocarSenha: false }); }}
        onCancelar={eu.trocarSenha ? sair : () => setTrocandoSenha(false)}
      />
    );
  }
  return <ControleEquipeQA usuario={eu.usuario} onSair={sair} onTrocarSenha={() => setTrocandoSenha(true)} />;
}
