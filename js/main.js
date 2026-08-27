(function (global) {
  "use strict";

  // main — orquestra os componentes do painel (boot + ligação).

  // SEED_VERSION — força re-seed do dia quando a receita padrão muda.
  const SEED_VERSION = 9;

  // COR — cada receita de pão tem sua cor (linha de balanço paralela).
  const COR = { pao1: "#B3541E", pao2: "#7A8B3D" };

  // tarefasPadraoDoDia — dois pães da mesma receita em cadeia que ficam
  // prontos antes da abertura (12h): pão assado 1h antes de abrir (11h),
  // assar leva 45min (10:15) e o forno aquece 15min antes (10:00).
  // O Pão 2 começa assim que o Pão 1 sai da masseira (recurso exclusivo).
  function tarefasPadraoDoDia() {
    return [
      { id: "aquecer-forno", nome: "Aquecer forno", cor: COR.pao1, duracaoMin: 15, inicioMin: 120, recursos: ["forno"] },
      { id: "pao-1-mistura", nome: "Pão 1", cor: COR.pao1, duracaoMin: 60, recursos: ["masseira"] },
      { id: "pao-1-fermenta", nome: "Pão 1", cor: COR.pao1, duracaoMin: 60, recursos: ["fermentacao"], dependeDe: ["pao-1-mistura"] },
      { id: "pao-1-modela", nome: "Pão 1", cor: COR.pao1, duracaoMin: 15, recursos: ["modelagem"], dependeDe: ["pao-1-fermenta"] },
      { id: "pao-1-forno", nome: "Pão 1", cor: COR.pao1, duracaoMin: 45, recursos: ["forno"], dependeDe: ["pao-1-modela", "aquecer-forno"] },
      { id: "pao-2-mistura", nome: "Pão 2", cor: COR.pao2, duracaoMin: 60, recursos: ["masseira"] },
      { id: "pao-2-fermenta", nome: "Pão 2", cor: COR.pao2, duracaoMin: 60, recursos: ["fermentacao"], dependeDe: ["pao-2-mistura"] },
      { id: "pao-2-modela", nome: "Pão 2", cor: COR.pao2, duracaoMin: 15, recursos: ["modelagem"], dependeDe: ["pao-2-fermenta"] },
      { id: "pao-2-forno", nome: "Pão 2", cor: COR.pao2, duracaoMin: 45, recursos: ["forno"], dependeDe: ["pao-2-modela", "aquecer-forno"] },
    ];
  }

  const timelineEl = document.getElementById("timeline");
  const horaEl = document.getElementById("horaAtual");
  const dataEl = document.getElementById("dataAtual");
  const pessoasEl = document.getElementById("contadorPessoas");
  const statusEl = document.getElementById("status");

  const recursos = Object.assign({}, global.resourceRegistry.RECURSOS_PADRAO);
  let diaAtual = null;
  let ultimaAgenda = [];

  // relogio — hora e data atuais no topo (atualiza a cada segundo).
  function atualizarRelogio() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    if (horaEl) horaEl.textContent = `${hh}:${mm}`;
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const dia = String(d.getDate()).padStart(2, "0");
    const semana = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][d.getDay()];
    if (dataEl) dataEl.textContent = `${semana} ${dia}/${mes}/${d.getFullYear()}`;
  }

  function hojeISO() {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  function aplicar(agenda) {
    global.timelineRenderer.render(timelineEl, agenda, recursos);
    global.remoteNav.coletarNavegaveis();
    if (!global.remoteNav.focoDefinido()) global.remoteNav.focarPrimeiraBarra();
    global.remoteNav.aplicarFoco();
    global.remoteNav.reaplicarSelecao();
    global.timelineRenderer.marcarGarras(global.remoteNav.garraAtiva());
    if (global.clima) global.clima.aplicar();
  }

  function recarregar() {
    const pessoas = global.personCounter.obter();
    const tarefas = diaAtual.tarefas;
    ultimaAgenda = global.scheduler.calculaEncaixe(tarefas, pessoas, recursos, undefined, ultimaAgenda);
    aplicar(ultimaAgenda);
    atualizarStatus(pessoas, ultimaAgenda);
  }

  // atualizarStatus — rodapé: modo mover (se há tarefa selecionada) ou contagem.
  function atualizarStatus(pessoas, agenda) {
    if (global.remoteNav.temSelecao()) {
      statusEl.textContent = "selecionada · ←/→ move · ↑/↓ garra · OK solta";
      return;
    }
    const local = global.deviceSync.emModoLocal ? global.deviceSync.emModoLocal() : false;
    statusEl.textContent = (local ? "sem rede · modo local · " : "") + `${pessoas} ${pessoas === 1 ? "pessoa" : "pessoas"} · ${agenda.length} tarefa(s)`;
  }

  function atualizarUI() {
    const p = global.personCounter.obter();
    pessoasEl.textContent = `${p} ${p === 1 ? "pessoa" : "pessoas"}`;
    recarregar();
  }

  // Botões de ação
  document.querySelectorAll(".acao").forEach((btn) => {
    btn.addEventListener("painel:selecionar", (e) => {
      const acao = btn.dataset.acao;
      if (acao === "adicionar") {
        const id = "t" + Date.now();
        diaAtual.tarefas.push({ id, nome: "Nova tarefa", duracaoMin: 20, recursos: ["livre"] });
        global.dayStore.salvar(diaAtual);
        atualizarUI();
      } else if (acao === "pessoas") {
        let n = global.personCounter.obter() + 1;
        if (n > global.personCounter.MAX) n = global.personCounter.MIN;
        global.personCounter.definir(n);
        atualizarUI();
      } else if (acao === "dia") {
        diaAtual = global.dayStore.carregar(hojeISO());
        atualizarUI();
      }
    });
  });

  // Menu de controles — escondido atrás do botão "menu" (aparece num clique).
  const controlesEl = document.getElementById("controles");
  const menuBtn = document.querySelector(".botao-controles");

  function abrirControles(aberto) {
    controlesEl.hidden = !aberto;
    if (menuBtn) menuBtn.setAttribute("aria-expanded", String(aberto));
    global.remoteNav.coletarNavegaveis();
    global.remoteNav.aplicarFoco();
  }

  if (menuBtn) {
    menuBtn.addEventListener("click", () => abrirControles(controlesEl.hidden));
    menuBtn.addEventListener("painel:selecionar", () => abrirControles(controlesEl.hidden));
  }
  document.addEventListener("painel:voltar", () => {
    if (!controlesEl.hidden) abrirControles(false);
  });

  // Config da tarefa — 2º OK (ou duplo clique) abre; ajusta a duração padrão.
  const configEl = document.getElementById("config");
  const configTituloEl = document.getElementById("configTitulo");
  const configDuracaoEl = document.getElementById("configDuracao");
  const PASSO_DURACAO = 15;
  let configId = null;

  function formatarDuracao(min) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h && m) return `${h}h${String(m).padStart(2, "0")}`;
    if (h) return `${h}h`;
    return `${m}min`;
  }

  function abrirConfig(id) {
    const tarefa = (diaAtual.tarefas || []).find((t) => t.id === id);
    if (!tarefa) return;
    configId = id;
    configTituloEl.textContent = tarefa.nome;
    configDuracaoEl.textContent = formatarDuracao(tarefa.duracaoMin);
    configEl.hidden = false;
    global.remoteNav.focarPrimeiro();
  }

  function fecharConfig() {
    configEl.hidden = true;
    const id = configId;
    configId = null;
    global.remoteNav.coletarNavegaveis();
    if (id) global.remoteNav.focarBarra(id);
    else global.remoteNav.aplicarFoco();
  }

  document.addEventListener("painel:abrirConfig", (e) => abrirConfig(e.detail && e.detail.id));
  document.addEventListener("painel:fecharConfig", fecharConfig);

  configEl.addEventListener("painel:selecionar", (e) => {
    const acao = e.detail && e.detail.id;
    if (!configId) return;
    const tarefa = diaAtual.tarefas.find((t) => t.id === configId);
    if (!tarefa) return;
    if (acao === "duracao-menos" || acao === "duracao-mais") {
      const delta = acao === "duracao-mais" ? PASSO_DURACAO : -PASSO_DURACAO;
      const antiga = tarefa.duracaoMin;
      tarefa.duracaoMin = Math.max(15, tarefa.duracaoMin + delta);
      try {
        const pessoas = global.personCounter.obter();
        ultimaAgenda = global.scheduler.calculaEncaixe(diaAtual.tarefas, pessoas, recursos, undefined, ultimaAgenda, configId);
        limparAncorasDaCadeia(configId);
        global.dayStore.salvar(diaAtual);
        aplicar(ultimaAgenda);
        atualizarStatus(global.personCounter.obter(), ultimaAgenda);
      } catch (err) {
        tarefa.duracaoMin = antiga;
        statusEl.textContent = "sem espaço no dia para essa duração";
      }
      configDuracaoEl.textContent = formatarDuracao(tarefa.duracaoMin);
    } else if (acao === "fechar") {
      fecharConfig();
    }
  });

  // Duplo clique (mouse/celular) abre as configs da tarefa.
  timelineEl.addEventListener("dblclick", (e) => {
    const barra = e.target.closest(".barra");
    if (barra && barra.dataset.id) {
      document.dispatchEvent(new CustomEvent("painel:abrirConfig", { detail: { id: barra.dataset.id } }));
    }
  });

  // Verificação de versão — avisa quando um novo deploy chegou ao GitHub Pages.
  // Dados do dia (Firebase) sincronizam sozinhos; código novo recarrega sozinho.
  let versaoCarregada = null;
  let recarregando = false;

  function checarVersao() {
    if (recarregando) return;
    fetch("versao.json?t=" + Date.now(), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("http"))))
      .then((j) => {
        if (!j || !j.versao) return;
        if (versaoCarregada === null) {
          versaoCarregada = j.versao;
          return;
        }
        if (j.versao !== versaoCarregada) {
          recarregando = true;
          // Recarrega automático para pegar a versão nova (dados ficam no Firebase).
          location.reload(true);
        }
      })
      .catch(() => {});
  }

  setInterval(checarVersao, 30000);
  checarVersao();

  // Seleção/deseleção de tarefa → atualiza garras, dica de modo e status.
  document.addEventListener("painel:selecionarTarefa", () => {
    global.timelineRenderer.marcarGarras(global.remoteNav.garraAtiva());
    atualizarStatus(global.personCounter.obter(), ultimaAgenda);
  });

  // Mudança de garra (↑/↓) → atualiza as alças na barra selecionada.
  document.addEventListener("painel:garraMudou", (e) => {
    global.timelineRenderer.marcarGarras(e.detail && e.detail.garra);
  });

  // aplicarMovimento — aplica um deslocamento (deltaMin) numa garra e, se
  // couber, re-encaixa pelo scheduler e persiste. Retorna true se aplicou.
  function aplicarMovimento(tarefa, g, deltaMin) {
    const item = ultimaAgenda.find((a) => a.id === tarefa.id);
    if (!item) return false;
    const antes = { inicioMin: tarefa.inicioMin, fimFixo: tarefa.fimFixo, duracaoMin: tarefa.duracaoMin };
    g = g || "corpo";
    if (g === "fim") {
      // Borda direita: começo fixo, duração muda, fim e sucessores seguem.
      delete tarefa.fimFixo;
      tarefa.duracaoMin = Math.max(15, tarefa.duracaoMin + deltaMin);
    } else if (g === "comeco") {
      // Borda esquerda: fim fixo (Must Finish On); sucessores não se movem.
      const novoInicio = Math.max(0, item.inicio + deltaMin);
      tarefa.fimFixo = item.fim;
      tarefa.duracaoMin = Math.max(15, item.fim - novoInicio);
      tarefa.inicioMin = novoInicio;
    } else {
      // Corpo: começo+fim juntos; duração preservada; sucessores seguem.
      delete tarefa.fimFixo;
      tarefa.inicioMin = Math.max(0, (tarefa.inicioMin !== undefined ? tarefa.inicioMin : item.inicio) + deltaMin);
    }
    try {
      const pessoas = global.personCounter.obter();
      ultimaAgenda = global.scheduler.calculaEncaixe(diaAtual.tarefas, pessoas, recursos, undefined, ultimaAgenda, tarefa.id);
      limparAncorasDaCadeia(tarefa.id);
      global.dayStore.salvar(diaAtual);
      aplicar(ultimaAgenda);
      atualizarStatus(pessoas, ultimaAgenda);
      return true;
    } catch (err) {
      tarefa.inicioMin = antes.inicioMin;
      tarefa.fimFixo = antes.fimFixo;
      tarefa.duracaoMin = antes.duracaoMin;
      statusEl.textContent = "sem espaço no dia para essa movimentação";
      return false;
    }
  }

  // limparAncorasDaCadeia — a receita anda como um bloco: ao mover uma etapa,
  // os sucessores transitivos perdem o inicioMin fixado (passam a seguir a
  // etapa movida sem folga). Predecessores e pães não relacionados preservam.
  function limparAncorasDaCadeia(idFoco) {
    const naCadeia = new Set();
    const fila = [idFoco];
    while (fila.length) {
      const cur = fila.shift();
      for (const t of diaAtual.tarefas) {
        if ((t.dependeDe || []).indexOf(cur) !== -1 && !naCadeia.has(t.id)) {
          naCadeia.add(t.id);
          fila.push(t.id);
        }
      }
    }
    for (const t of diaAtual.tarefas) {
      if (naCadeia.has(t.id)) delete t.inicioMin;
    }
  }

  // Empurrar tarefa — setas aplicam a garra ativa e o scheduler re-encaixa tudo.
  document.addEventListener("painel:empurrar", (e) => {
    const { id, dir, garra } = e.detail || {};
    if (!diaAtual || !id || !dir) return;
    const tarefa = diaAtual.tarefas.find((t) => t.id === id);
    if (!tarefa) return;
    aplicarMovimento(tarefa, garra, dir * 15);
  });

  // Arrastar no celular/mouse — segura numa barra e move/esticarr por toque.
  // A barra selecionada vira manipulável: arrastar no corpo move, nas bordas
  // estica (fim) ou mantém o fim (começo). Grava a cada passo via dayStore.
  let arrastando = null;
  function minutosPorPixel() {
    const cenario = timelineEl.querySelector(".cenario");
    if (!cenario) return 1;
    const W = (cenario.clientWidth || 800) - 24; // mesmo R_PAD do renderer
    return W > 0 ? 600 / W : 1;
  }
  timelineEl.addEventListener("pointerdown", (e) => {
    const barra = e.target.closest ? e.target.closest(".barra") : null;
    if (!barra || !diaAtual) return;
    const id = barra.dataset.id;
    const tarefa = diaAtual.tarefas.find((t) => t.id === id);
    if (!tarefa) return;
    // Seleciona a barra (como um toque simples) para mostrar as garras.
    global.remoteNav.selecionarBarraPorId(id);
    const rect = barra.getBoundingClientRect();
    const cenarioRect = (timelineEl.querySelector(".cenario") || timelineEl).getBoundingClientRect();
    // Garra pela posição do toque dentro da barra (10% das pontas).
    let g = "corpo";
    const frac = (e.clientX - rect.left) / Math.max(rect.width, 1);
    if (frac < 0.12) g = "comeco";
    else if (frac > 0.88) g = "fim";
    arrastando = {
      id,
      g,
      tarefa,
      ultimoX: e.clientX,
      minPorPx: minutosPorPixel(),
      ultimoDelta: 0,
      moveu: false,
    };
    e.preventDefault();
  });
  window.addEventListener("pointermove", (e) => {
    if (!arrastando) return;
    const dx = e.clientX - arrastando.ultimoX;
    if (Math.abs(dx) < 4) return;
    arrastando.ultimoX = e.clientX;
    const deltaMin = Math.round(dx * arrastando.minPorPx);
    arrastando.ultimoDelta += deltaMin;
    arrastando.moveu = true;
    aplicarMovimento(arrastando.tarefa, arrastando.g, deltaMin);
    e.preventDefault();
  });
  window.addEventListener("pointerup", () => {
    if (!arrastando) return;
    const moveu = arrastando.moveu;
    const id = arrastando.id;
    arrastando = null;
    if (moveu) {
      global.__arrastouBarra = id;
      global.remoteNav.coletarNavegaveis();
      setTimeout(() => { if (global.__arrastouBarra === id) global.__arrastouBarra = null; }, 500);
    }
  });

  // Mudanças vindas de outros clientes (ou do próprio save) → só atualiza a UI.
  // NÃO chama dayStore.salvar de volta (evita loop).
  global.deviceSync.assinarEstado((dias) => {
    if (!dias) return;
    global.dayStore.sincronizar(dias);
    if (!diaAtual) return; // boot ainda não atribuiu o dia
    const d = dias[diaAtual.data];
    if (d) {
      diaAtual = d;
      atualizarUI();
    } else if (diaAtual.tarefas.length > 0 && !global.deviceSync.emModoLocal()) {
      // Snapshot real confirmou dia vazio e temos um seed/dia local → grava.
      global.dayStore.salvar(diaAtual);
    }
  });

  // Boot — aguarda o primeiro snapshot do deviceSync antes de decidir
// criar o dia padrão (evita sobrescrever o dia real do Firebase).
  global.deviceSync.inicializar();
  global.deviceSync.quandoPronto(function iniciar() {
    global.dayStore.sincronizar(global.deviceSync.obterDias());
    diaAtual = global.dayStore.carregar(hojeISO());
    // Seed só preenche dia vazio; o dia do usuário persiste sempre
    // (nada de re-seed por versão — o que apagaria onde paramos).
    if (diaAtual.tarefas.length === 0) {
      diaAtual.tarefas = tarefasPadraoDoDia();
      diaAtual.seedVersion = SEED_VERSION;
      ultimaAgenda = [];
      // Só grava o seed na nuvem após o 1º snapshot real, para não
      // sobrescrever um dia existente com rede lenta (modo local).
      if (!global.deviceSync.emModoLocal()) {
        global.dayStore.salvar(diaAtual);
      }
    }
    global.remoteNav.inicializar();
    atualizarUI();
  });

  // Relógio e clima do dia — começam já no boot (não dependem do dia).
  atualizarRelogio();
  setInterval(atualizarRelogio, 1000);
  if (global.clima) global.clima.inicializar();
})(typeof window !== "undefined" ? window : this);