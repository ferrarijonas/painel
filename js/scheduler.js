(function (global) {
  "use strict";

  // scheduler — recalcula o encaixe do dia conforme a ZenSpec.
  // Janela 8h-18h em minutos: T0=0, T1=600.
  const T0 = 0;
  const T1 = 600;

  // Tipos de ocupação (Concept §9 / ZenSpec do scheduler).
  const OCUP = {
    EXCLUSIVO: "exclusivo",
    CAPACIDADE: "capacidade-N",
    PASSIVO: "passivo",
    PESSOA_ATIVA: "pessoa-ativa",
    LIVRE: "livre",
  };

  function err(code) {
    const e = new Error(code);
    e.code = code;
    return e;
  }

  // validaEntrada — garante contrato válido ou lança erro explícito.
  function validaEntrada(tarefas, pessoas, regrasRecursos) {
    if (!Array.isArray(tarefas)) throw err("ENTRADA_INVALIDA");
    if (!Number.isInteger(pessoas) || pessoas < 1 || pessoas > 4)
      throw err("PESSOAS_INVALIDA");
    if (!regrasRecursos || typeof regrasRecursos !== "object")
      throw err("ENTRADA_INVALIDA");

    for (const t of tarefas) {
      if (!t || !t.id || !t.nome) throw err("ENTRADA_INVALIDA");
      if (typeof t.duracaoMin !== "number" || t.duracaoMin <= 0)
        throw err("DURACAO_INVALIDA");
      for (const rid of t.recursos || []) {
        if (!regrasRecursos[rid]) throw err("RECURSO_INVALIDO");
      }
      for (const depId of t.dependeDe || []) {
        const existe = tarefas.some((x) => x.id === depId);
        if (!existe) throw err("DEPENDENCIA_INVALIDA");
      }
    }
  }

  // ocupadosNoIntervalo — quantas tarefas ativas num [inicio, fim) por critério.
  function ocupadosNoIntervalo(agenda, inicio, fim, filtro) {
    let n = 0;
    for (const a of agenda) {
      if (a.inicio >= fim || a.fim <= inicio) continue; // sem sobreposição
      if (filtro(a)) n++;
    }
    return n;
  }

  // estaBloqueado — a tarefa [inicio, fim) fere recurso exclusivo, capacidade
  // ou limite de pessoas ativas?
  function estaBloqueado(tarefa, agenda, inicio, fim, pessoas, regrasRecursos) {
    for (const rid of tarefa.recursos || []) {
      const regra = regrasRecursos[rid];
      const tipo = regra.tipo;

      if (tipo === OCUP.EXCLUSIVO) {
        if (ocupadosNoIntervalo(agenda, inicio, fim, (a) => a.recursos.includes(rid)) > 0) return true;
      } else if (tipo === OCUP.CAPACIDADE) {
        const cap = regra.capacidade || 1;
        const n = ocupadosNoIntervalo(agenda, inicio, fim, (a) => a.recursos.includes(rid));
        if (n >= cap) return true;
      }
    }

    if (tarefa.recursos && tarefa.recursos.some((rid) => regrasRecursos[rid].tipo === OCUP.PESSOA_ATIVA)) {
      const nPessoas = ocupadosNoIntervalo(agenda, inicio, fim, (a) =>
        a.recursos.some((rid2) => regrasRecursos[rid2].tipo === OCUP.PESSOA_ATIVA)
      );
      if (nPessoas >= pessoas) return true;
    }
    return false;
  }

  // primeiroInicioLivre — acha o menor início >= aPartirDe onde a tarefa
  // respeita todas as regras de recurso e de pessoas, e as dependências.
  // `prevInicio` preserva a posição anterior da tarefa (não re-embaralha o resto).
  // `naCadeia` (cadeia do idFoco): a receita segue sem folga — ignora âncoras
  // antigas (inicioMin/posição) e começa logo após o fim dos predecessores.
  function primeiroInicioLivre(tarefa, agenda, pessoas, regrasRecursos, aPartirDe, prevInicio, naCadeia) {
    const duracao = tarefa.duracaoMin;

    // Dependências: esta tarefa só inicia depois que todas as dependentes terminaram.
    let depFim = T0;
    if (Array.isArray(tarefa.dependeDe) && tarefa.dependeDe.length) {
      for (const depId of tarefa.dependeDe) {
        const dep = agenda.find((a) => a.id === depId);
        if (dep && dep.fim > depFim) depFim = dep.fim;
      }
    }

    // Fim fixado: `ateFim` ocupa até o fim da janela (duração não trava o
    // encaixe); `fimFixo` tenta terminar exatamente no alvo e, se não der
    // (predecessor/recurso), cai no encaixe normal — a cadeia acompanha.
    if (tarefa.ateFim) {
      let candidato = Math.max(aPartirDe === undefined ? T0 : aPartirDe, depFim);
      while (candidato < T1) {
        if (!estaBloqueado(tarefa, agenda, candidato, T1, pessoas, regrasRecursos)) return candidato;
        candidato++;
      }
      throw err("SEM_HORARIO");
    }
    if (tarefa.fimFixo !== undefined) {
      const alvo = Math.max(tarefa.fimFixo - duracao, depFim, aPartirDe === undefined ? T0 : aPartirDe);
      if (alvo + duracao <= T1 && !estaBloqueado(tarefa, agenda, alvo, alvo + duracao, pessoas, regrasRecursos)) {
        return alvo;
      }
      // Não segurou o fim → segue para o encaixe normal (cadeia acompanha).
    }

    // Cadeia do foco: segue sem folga — começa logo após o fim dos
    // predecessores, sem levar em conta posição/âncora antiga.
    // Fora da cadeia: `inicioMin` é intenção explícita (empurrar) e vence a
    // preservação; sem inicioMin, preserva-se a posição anterior.
    let candidato;
    if (naCadeia) {
      candidato = Math.max(aPartirDe === undefined ? T0 : aPartirDe, depFim);
    } else {
      const anterior = prevInicio && prevInicio.has(tarefa.id) ? prevInicio.get(tarefa.id) : T0;
      const base = tarefa.inicioMin !== undefined ? tarefa.inicioMin : anterior;
      candidato = Math.max(aPartirDe === undefined ? T0 : aPartirDe, base, depFim);
    }

    // Candidato vai avançando enquanto alguma regra bloquear.
    const fimDe = (c) => (tarefa.ateFim ? T1 : c + duracao);
    while (candidato < T1 && fimDe(candidato) <= T1) {
      const fim = fimDe(candidato);
      if (!estaBloqueado(tarefa, agenda, candidato, fim, pessoas, regrasRecursos)) return candidato;
      candidato++;
    }

    throw err("SEM_HORARIO");
  }

  // ordenaPorDependencia — topológica simples: dependentes depois das dependências.
  // Mantém ordem de adição entre tarefas sem relação (regra 10, estável).
  function ordenaPorDependencia(tarefas) {
    const ordem = [];
    const visitado = new Set();
    const emCurso = new Set();

    function visitar(t) {
      if (visitado.has(t.id)) return;
      if (emCurso.has(t.id)) throw err("DEPENDENCIA_CICLICA");
      emCurso.add(t.id);
      for (const depId of t.dependeDe || []) {
        const dep = tarefas.find((x) => x.id === depId);
        if (dep) visitar(dep);
      }
      emCurso.delete(t.id);
      visitado.add(t.id);
      ordem.push(t);
    }

    for (const t of tarefas) visitar(t);
    return ordem;
  }

  // dependentesDe — ids das tarefas que dependem de `id` transitivamente
  // (a cadeia que acompanha um movimento: massa → fermenta → modela → assa).
  function dependentesDe(tarefas, id) {
    const deps = new Set();
    const fila = [id];
    while (fila.length) {
      const cur = fila.shift();
      for (const t of tarefas) {
        if ((t.dependeDe || []).indexOf(cur) !== -1 && !deps.has(t.id)) {
          deps.add(t.id);
          fila.push(t.id);
        }
      }
    }
    return deps;
  }

  // predecessoresDe — ids das tarefas das quais `id` depende transitivamente
  // (predecessores devem ser encaixados antes do foco).
  function predecessoresDe(tarefas, id) {
    const preds = new Set();
    const fila = [id];
    while (fila.length) {
      const cur = fila.shift();
      const t = tarefas.find((x) => x.id === cur);
      if (!t) continue;
      for (const depId of t.dependeDe || []) {
        if (!preds.has(depId)) {
          preds.add(depId);
          fila.push(depId);
        }
      }
    }
    return preds;
  }

  // calculaEncaixe — orquestrador principal (regra de entrada pública).
  // `agendaAnterior` (opcional) preserva as posições atuais das tarefas não
  // afetadas: empurrar um pão não re-embaralha o outro.
  // `idFoco` (opcional) = tarefa sendo mexida: ela é encaixada primeiro e
  // vence as que estiverem na frente (regra 12/13 da ZenSpec).
  function calculaEncaixe(tarefas, pessoas, regrasRecursos, aPartirDe, agendaAnterior, idFoco) {
    validaEntrada(tarefas, pessoas, regrasRecursos);
    if (tarefas.length === 0) return [];

    // Ordem de adição com dependências respeitadas (regra 10 + dependências).
    const ordenadas = ordenaPorDependencia(tarefas);

    // Cadeia que acompanha o foco: dependentes transitivos (a receita anda
    // como um bloco). O foco em si mantém o alvo (inicioMin/fimFixo).
    let cadeia = null;
    if (idFoco && ordenadas.some((t) => t.id === idFoco)) {
      cadeia = dependentesDe(tarefas, idFoco);
      // Reordena: o foco vai logo após os próprios predecessores, e antes de
      // qualquer outra tarefa — assim ele encaixa no alvo e empurra quem
      // estiver na frente, em vez de ser barrado por elas.
      const foco = ordenadas.find((t) => t.id === idFoco);
      const semFoco = ordenadas.filter((t) => t.id !== idFoco);
      const preds = predecessoresDe(tarefas, idFoco);
      let pos = 0;
      for (let i = 0; i < semFoco.length; i++) {
        if (preds.has(semFoco[i].id)) pos = i + 1;
      }
      semFoco.splice(pos, 0, foco);
      ordenadas.length = 0;
      ordenadas.push.apply(ordenadas, semFoco);
    }

    const prevInicio = new Map();
    if (Array.isArray(agendaAnterior)) {
      for (const a of agendaAnterior) prevInicio.set(a.id, a.inicio);
    }

    const agenda = [];
    const porId = new Map();

    for (const t of ordenadas) {
      const naCadeia = !!cadeia && cadeia.has(t.id);
      const inicio = primeiroInicioLivre(t, agenda, pessoas, regrasRecursos, aPartirDe, prevInicio, naCadeia);
      const item = {
        id: t.id,
        nome: t.nome,
        inicio,
        fim: t.ateFim ? T1 : inicio + t.duracaoMin,
        recursos: t.recursos || [],
        dependeDe: t.dependeDe || [],
        cor: t.cor,
      };
      agenda.push(item);
      porId.set(t.id, item);
    }

    agenda.sort((a, b) => a.inicio - b.inicio || 0);
    return agenda;
  }

  const api = { calculaEncaixe, OCUP, T0, T1 };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.scheduler = api;
})(typeof window !== "undefined" ? window : this);