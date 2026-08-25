(function (global) {
  "use strict";

  // main — orquestra os componentes do painel (boot + ligação).

  // SEED_VERSION — força re-seed do dia quando a receita padrão muda.
  const SEED_VERSION = 2;

  // tarefasPadraoDoDia — uma receita de pão em cadeia:
  // mistura 1h → caixa de fermentação 2h → modelagem 30min →
  // temperatura ambiente 1h30 → forno até o fim do dia.
  function tarefasPadraoDoDia() {
    return [
      { id: "pao-1-mistura", nome: "Mistura", duracaoMin: 60, recursos: ["masseira"] },
      { id: "pao-1-fermenta", nome: "Caixa de fermentação", duracaoMin: 120, recursos: ["fermentacao"], dependeDe: ["pao-1-mistura"] },
      { id: "pao-1-modela", nome: "Modelagem", duracaoMin: 30, recursos: ["modelagem"], dependeDe: ["pao-1-fermenta"] },
      { id: "pao-1-ambiente", nome: "Temp. ambiente", duracaoMin: 90, recursos: ["ambiente"], dependeDe: ["pao-1-modela"] },
      { id: "pao-1-forno", nome: "Forno", duracaoMin: 60, ateFim: true, recursos: ["forno"], dependeDe: ["pao-1-ambiente"] },
    ];
  }

  const timelineEl = document.getElementById("timeline");
  const dataEl = document.getElementById("dataAtual");
  const pessoasEl = document.getElementById("contadorPessoas");
  const statusEl = document.getElementById("status");

  const recursos = Object.assign({}, global.resourceRegistry.RECURSOS_PADRAO);
  let diaAtual = null;

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
  }

  function recarregar() {
    const pessoas = global.personCounter.obter();
    const tarefas = diaAtual.tarefas;
    const agenda = global.scheduler.calculaEncaixe(tarefas, pessoas, recursos);
    aplicar(agenda);
    const local = global.deviceSync.emModoLocal ? global.deviceSync.emModoLocal() : false;
    statusEl.textContent = (local ? "sem rede · modo local · " : "") + `${pessoas} ${pessoas === 1 ? "pessoa" : "pessoas"} · ${agenda.length} tarefa(s)`;
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

  // Barra selecionada → remove tarefa (temporário para testar fluxo)
  timelineEl.addEventListener("painel:selecionar", (e) => {
    const id = e.detail.id;
    if (!id) return;
    diaAtual.tarefas = diaAtual.tarefas.filter((t) => t.id !== id);
    global.dayStore.salvar(diaAtual);
    atualizarUI();
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
    }
    global.remoteNav.inicializar();
    atualizarUI();
  });
})(typeof window !== "undefined" ? window : this);