(function (global) {
  "use strict";

  // main — orquestra os componentes do painel (boot + ligação).

  // tarefasPadraoDoDia — dia de exemplo para a primeira tela.
  // Demonstra o escalonamento automático por recurso (Concept §9) + dependências.
  function tarefasPadraoDoDia() {
    return [
      { id: "p1-mas", nome: "Pão 1 · masseira", duracaoMin: 30, recursos: ["masseira"] },
      { id: "p1-fer", nome: "Pão 1 · fermenta", duracaoMin: 90, recursos: ["fermentacao"], dependeDe: ["p1-mas"] },
      { id: "p1-mod", nome: "Pão 1 · modela", duracaoMin: 40, recursos: ["modelagem"], dependeDe: ["p1-fer"] },
      { id: "p1-for", nome: "Pão 1 · assa", duracaoMin: 45, recursos: ["forno"], dependeDe: ["p1-mod"] },
      { id: "p2-mas", nome: "Pão 2 · masseira", duracaoMin: 30, recursos: ["masseira"] },
      { id: "p2-fer", nome: "Pão 2 · fermenta", duracaoMin: 90, recursos: ["fermentacao"], dependeDe: ["p2-mas"] },
      { id: "geleia", nome: "Geleia de morango", duracaoMin: 50, recursos: ["livre"] },
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
    statusEl.textContent = `${pessoas} ${pessoas === 1 ? "pessoa" : "pessoas"} · ${agenda.length} tarefa(s)`;
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
    if (diaAtual.tarefas.length === 0) {
      diaAtual.tarefas = tarefasPadraoDoDia();
      global.dayStore.salvar(diaAtual);
    }
    global.remoteNav.inicializar();
    atualizarUI();
  });
})(typeof window !== "undefined" ? window : this);