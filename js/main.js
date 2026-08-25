(function (global) {
  "use strict";

  // main — orquestra os componentes do painel (boot + ligação).

  // SEED_VERSION — força re-seed do dia quando a receita padrão muda.
  const SEED_VERSION = 8;

  // COR — cada receita de pão tem sua cor (linha de balanço paralela).
  const COR = { pao1: "#B3541E", pao2: "#7A8B3D" };

  // tarefasPadraoDoDia — dois pães da mesma receita em cadeia:
  // mistura 1h → caixa de fermentação 2h → modelagem 30min →
  // temperatura ambiente 1h30 → forno até o fim do dia.
  // O Pão 2 começa assim que o Pão 1 sai da masseira (recurso exclusivo).
  function tarefasPadraoDoDia() {
    return [
      { id: "pao-1-mistura", nome: "Pão 1", cor: COR.pao1, duracaoMin: 60, recursos: ["masseira"] },
      { id: "pao-1-fermenta", nome: "Pão 1", cor: COR.pao1, duracaoMin: 120, recursos: ["fermentacao"], dependeDe: ["pao-1-mistura"] },
      { id: "pao-1-modela", nome: "Pão 1", cor: COR.pao1, duracaoMin: 30, recursos: ["modelagem"], dependeDe: ["pao-1-fermenta"] },
      { id: "pao-1-ambiente", nome: "Pão 1", cor: COR.pao1, duracaoMin: 90, recursos: ["ambiente"], dependeDe: ["pao-1-modela"] },
      { id: "pao-1-forno", nome: "Pão 1", cor: COR.pao1, duracaoMin: 60, ateFim: true, recursos: ["forno"], dependeDe: ["pao-1-ambiente"] },
      { id: "pao-2-mistura", nome: "Pão 2", cor: COR.pao2, duracaoMin: 60, recursos: ["masseira"] },
      { id: "pao-2-fermenta", nome: "Pão 2", cor: COR.pao2, duracaoMin: 120, recursos: ["fermentacao"], dependeDe: ["pao-2-mistura"] },
      { id: "pao-2-modela", nome: "Pão 2", cor: COR.pao2, duracaoMin: 30, recursos: ["modelagem"], dependeDe: ["pao-2-fermenta"] },
      { id: "pao-2-ambiente", nome: "Pão 2", cor: COR.pao2, duracaoMin: 90, recursos: ["ambiente"], dependeDe: ["pao-2-modela"] },
      { id: "pao-2-forno", nome: "Pão 2", cor: COR.pao2, duracaoMin: 60, ateFim: true, recursos: ["forno"], dependeDe: ["pao-2-ambiente"] },
    ];
  }

  const timelineEl = document.getElementById("timeline");
  const dataEl = document.getElementById("dataAtual");
  const pessoasEl = document.getElementById("contadorPessoas");
  const statusEl = document.getElementById("status");

  const recursos = Object.assign({}, global.resourceRegistry.RECURSOS_PADRAO);
  let diaAtual = null;
  let ultimaAgenda = [];

  function hojeISO() {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  function aplicar(agenda) {
    global.timelineRenderer.render(timelineEl, agenda, recursos);
    global.remoteNav.coletarNavegaveis();
    global.remoteNav.aplicarFoco();
    global.remoteNav.reaplicarSelecao();
  }

  function recarregar() {
    const pessoas = global.personCounter.obter();
    const tarefas = diaAtual.tarefas;
    ultimaAgenda = global.scheduler.calculaEncaixe(tarefas, pessoas, recursos, undefined, ultimaAgenda);
    aplicar(ultimaAgenda);
    const local = global.deviceSync.emModoLocal ? global.deviceSync.emModoLocal() : false;
    statusEl.textContent = (local ? "sem rede · modo local · " : "") + `${pessoas} ${pessoas === 1 ? "pessoa" : "pessoas"} · ${ultimaAgenda.length} tarefa(s)`;
  }

  function atualizarUI() {
    dataEl.textContent = diaAtual.data;
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
        ultimaAgenda = global.scheduler.calculaEncaixe(diaAtual.tarefas, pessoas, recursos, undefined, ultimaAgenda);
        global.dayStore.salvar(diaAtual);
        aplicar(ultimaAgenda);
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

  // Empurrar tarefa — setas empurram no tempo e o scheduler re-encaixa tudo.
  document.addEventListener("painel:empurrar", (e) => {
    const { id, dir } = e.detail || {};
    if (!diaAtual || !id || !dir) return;
    const tarefa = diaAtual.tarefas.find((t) => t.id === id);
    if (!tarefa) return;
    const passo = 15;
    const antigo = tarefa.inicioMin;
    tarefa.inicioMin = Math.max(0, (tarefa.inicioMin || 0) + dir * passo);
    try {
      const pessoas = global.personCounter.obter();
      ultimaAgenda = global.scheduler.calculaEncaixe(diaAtual.tarefas, pessoas, recursos, undefined, ultimaAgenda);
      global.dayStore.salvar(diaAtual);
      aplicar(ultimaAgenda);
      statusEl.textContent = `${pessoas} ${pessoas === 1 ? "pessoa" : "pessoas"} · ${ultimaAgenda.length} tarefa(s)`;
    } catch (err) {
      tarefa.inicioMin = antigo;
      statusEl.textContent = "sem espaço no dia para empurrar";
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
    }
  });

  // Boot — aguarda o primeiro snapshot do deviceSync antes de decidir
// criar o dia padrão (evita sobrescrever o dia real do Firebase).
  global.deviceSync.inicializar();
  global.deviceSync.quandoPronto(function iniciar() {
    global.dayStore.sincronizar(global.deviceSync.obterDias());
    diaAtual = global.dayStore.carregar(hojeISO());
    if (diaAtual.tarefas.length === 0 || diaAtual.seedVersion !== SEED_VERSION) {
      diaAtual.tarefas = tarefasPadraoDoDia();
      diaAtual.seedVersion = SEED_VERSION;
      global.dayStore.salvar(diaAtual);
      ultimaAgenda = [];
    }
    global.remoteNav.inicializar();
    atualizarUI();
  });
})(typeof window !== "undefined" ? window : this);