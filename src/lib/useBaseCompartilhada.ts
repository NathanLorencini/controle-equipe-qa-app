import { useCallback, useEffect, useRef, useState } from 'react';
import type { Membro, Projeto } from '../types';
import { api, ErroDaApi } from './api';

/** De quanto em quanto tempo a tela pergunta se alguém mudou algo. */
const INTERVALO_MS = 5000;
/** Espera de digitação antes de gravar um campo de texto. */
const DIGITACAO_MS = 600;

export type Situacao = 'carregando' | 'sincronizado' | 'salvando' | 'sem-conexao';

type Pendentes = Map<number, Partial<Projeto>>;

/**
 * Aplica sobre os dados do servidor o que esta tela ainda não gravou: o que
 * está esperando a digitação parar e o que já foi enviado sem resposta. Sem
 * isso, uma recarga no meio do envio voltava o texto ao antigo e a próxima
 * tecla apagava o que a pessoa tinha escrito.
 */
function comPendentes(membros: Membro[], ...camadas: Pendentes[]): Membro[] {
  if (camadas.every((c) => !c.size)) return membros;
  return membros.map((m) => ({
    ...m,
    projetos: m.projetos.map((p) => camadas.reduce((x, c) => (c.has(x.id) ? { ...x, ...c.get(x.id) } : x), p)),
  }));
}

/**
 * Os dados da equipe, iguais para todo mundo.
 *
 * - Cada edição de projeto aparece na hora nesta tela e é gravada no servidor
 *   (texto: depois de uma pausa na digitação). Só o campo alterado vai.
 * - A cada INTERVALO_MS a tela pergunta a versão da base; se mudou (outra
 *   pessoa gravou), recarrega. O que esta tela ainda não gravou é mantido por
 *   cima, para quem está digitando não perder o texto.
 */
export function useBaseCompartilhada(avisar: (mensagem: string) => void) {
  const [membros, setMembros] = useState<Membro[]>([]);
  const [situacao, setSituacao] = useState<Situacao>('carregando');
  const versao = useRef(-1);
  const pendentes = useRef<Pendentes>(new Map());
  const emVoo = useRef<Pendentes>(new Map());
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const gravando = useRef(0);

  const atualizaSituacao = useCallback(() => {
    setSituacao(gravando.current || pendentes.current.size ? 'salvando' : 'sincronizado');
  }, []);

  const recarrega = useCallback(async () => {
    const d = await api.dados();
    versao.current = d.versao;
    setMembros(comPendentes(d.membros, emVoo.current, pendentes.current));
  }, []);

  /** Roda uma gravação; sem conexão ou erro, avisa e traz o estado real da base. */
  const grava = useCallback(async <T,>(acao: () => Promise<T>): Promise<T | null> => {
    gravando.current += 1;
    setSituacao('salvando');
    try {
      return await acao();
    } catch (e) {
      const msg = e instanceof ErroDaApi ? e.message : String(e);
      if (e instanceof ErroDaApi && e.status === 0) setSituacao('sem-conexao');
      if (!(e instanceof ErroDaApi && e.status === 401)) avisar(`Não foi possível salvar: ${msg}.`);
      await recarrega().catch(() => setSituacao('sem-conexao'));
      return null;
    } finally {
      gravando.current -= 1;
      if (gravando.current === 0) atualizaSituacao();
    }
  }, [avisar, recarrega, atualizaSituacao]);

  /**
   * Grava o que um projeto tem pendente. Sem conexão, a edição volta para a
   * fila e é reenviada a cada INTERVALO_MS (nada se perde); recusada pelo
   * servidor (projeto removido, valor inválido), a tela volta ao que está na base.
   */
  const enviaPendente = useRef<(projetoId: number, keepalive?: boolean) => Promise<void>>(async () => {});
  enviaPendente.current = async (projetoId: number, keepalive = false) => {
    timers.current.delete(projetoId);
    const campos = pendentes.current.get(projetoId);
    if (!campos) return;
    pendentes.current.delete(projetoId);
    const enviado = { ...emVoo.current.get(projetoId), ...campos };
    emVoo.current.set(projetoId, enviado);
    gravando.current += 1;
    setSituacao('salvando');
    let recusado = false;
    let semConexao = false;
    try {
      await api.alteraProjeto(projetoId, campos, keepalive);
    } catch (e) {
      if (e instanceof ErroDaApi && e.status === 0) {
        semConexao = true;
        // O que foi digitado depois deste envio vale mais que ele.
        pendentes.current.set(projetoId, { ...campos, ...pendentes.current.get(projetoId) });
        clearTimeout(timers.current.get(projetoId));
        timers.current.set(projetoId, setTimeout(() => void enviaPendente.current(projetoId), INTERVALO_MS));
      } else {
        recusado = true;
        if (!(e instanceof ErroDaApi && e.status === 401)) {
          avisar(`Não foi possível salvar: ${e instanceof Error ? e.message : String(e)}.`);
        }
      }
    } finally {
      gravando.current -= 1;
      // So sai da camada se nada mais novo foi enviado para o mesmo projeto.
      if (emVoo.current.get(projetoId) === enviado) emVoo.current.delete(projetoId);
    }
    if (recusado) await recarrega().catch(() => { semConexao = true; });
    if (semConexao) setSituacao('sem-conexao');
    else if (gravando.current === 0) atualizaSituacao();
  };

  // Primeira leitura + pergunta periódica pela versão.
  useEffect(() => {
    let vivo = true;
    recarrega().then(() => vivo && atualizaSituacao()).catch(() => vivo && setSituacao('sem-conexao'));
    const id = setInterval(async () => {
      try {
        const v = await api.versao();
        if (!vivo) return;
        if (v !== versao.current) await recarrega();
        if (vivo) atualizaSituacao();
      } catch {
        if (vivo) setSituacao('sem-conexao');
      }
    }, INTERVALO_MS);
    return () => { vivo = false; clearInterval(id); };
  }, [recarrega, atualizaSituacao]);

  // Fechou a aba no meio da digitação: grava o que faltava mesmo assim.
  useEffect(() => {
    const aoSair = () => {
      for (const id of [...pendentes.current.keys()]) void enviaPendente.current(id, true);
    };
    window.addEventListener('pagehide', aoSair);
    return () => window.removeEventListener('pagehide', aoSair);
  }, []);

  const adicionarMembro = useCallback(async (nome: string, usuarioId: number | null) => {
    const novo = await grava(() => api.criaMembro(nome, usuarioId));
    if (novo) setMembros((lista) => (lista.some((m) => m.id === novo.id) ? lista : [...lista, novo]));
    return novo;
  }, [grava]);

  const removerMembro = useCallback(async (id: number) => {
    if (await grava(() => api.removeMembro(id))) setMembros((lista) => lista.filter((m) => m.id !== id));
  }, [grava]);

  const vincularMembro = useCallback(async (id: number, usuarioId: number | null) => {
    if (await grava(() => api.vinculaMembro(id, usuarioId))) await recarrega();
  }, [grava, recarrega]);

  const adicionarProjeto = useCallback(async (membroId: number) => {
    const p = await grava(() => api.criaProjeto(membroId));
    if (p) {
      setMembros((lista) => lista.map((m) => (m.id === membroId && !m.projetos.some((x) => x.id === p.id)
        ? { ...m, projetos: [...m.projetos, p] } : m)));
    }
  }, [grava]);

  const alterarProjeto = useCallback((membroId: number, projetoId: number, campos: Partial<Projeto>) => {
    setMembros((lista) => lista.map((m) => (m.id === membroId
      ? { ...m, projetos: m.projetos.map((p) => (p.id === projetoId ? { ...p, ...campos } : p)) }
      : m)));
    pendentes.current.set(projetoId, { ...pendentes.current.get(projetoId), ...campos });
    setSituacao('salvando');
    // Texto espera a pessoa parar de digitar; seleção e número gravam logo.
    const digitando = 'nome' in campos || 'pros' in campos || 'contras' in campos;
    clearTimeout(timers.current.get(projetoId));
    timers.current.set(projetoId, setTimeout(() => void enviaPendente.current(projetoId), digitando ? DIGITACAO_MS : 150));
  }, []);

  const removerProjeto = useCallback(async (membroId: number, projetoId: number) => {
    clearTimeout(timers.current.get(projetoId));
    timers.current.delete(projetoId);
    pendentes.current.delete(projetoId);
    emVoo.current.delete(projetoId);
    if (await grava(() => api.removeProjeto(projetoId))) {
      setMembros((lista) => lista.map((m) => (m.id === membroId
        ? { ...m, projetos: m.projetos.filter((p) => p.id !== projetoId) } : m)));
    }
  }, [grava]);

  const importar = useCallback(async (lista: Membro[]) => {
    const r = await grava(() => api.importa(lista));
    if (r) await recarrega();
    return r;
  }, [grava, recarrega]);

  return {
    membros, situacao,
    adicionarMembro, removerMembro, vincularMembro, adicionarProjeto, alterarProjeto, removerProjeto, importar,
  };
}
