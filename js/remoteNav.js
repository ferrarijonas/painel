(function (global) {
  "use strict";

  // remoteNav — D-pad/teclado/celular em foco, seleção, empurrão e config (Eng §3).
  // Navegação ESPACIAL (padrão TV: W3C Spatial Navigation / Android TV):
  // a seta move o foco para o elemento mais próximo NAQUELA direção.
  // ↓ = etapa de baixo (próximo processo), → = outro pão na mesma pista.

  let focoIndex = -1;
  let itensFocados = [];
  let selecionadaEl = null;

  // Garras de movimentação da barra selecionada (↑/↓ alterna).
  const GARRAS = ["corpo", "fim", "comeco"];
  let garraAtiva = "corpo";

  // visivel — só navegáveis com layout (escondidos ficam fora do foco).
  function visivel(el) {
    return el.getClientRects().length > 0;
  }

  // configPanelVisivel — modal de config aberto?
  function configPanelVisivel() {
    const el = document.getElementById("config");
    return !!el && el.hidden === false;
  }

  function coletarNavegaveis() {
    if (configPanelVisivel()) {
      itensFocados = Array.from(document.querySelectorAll("#config .config-btn, #config .config-fechar")).filter(visivel);
    } else {
      const controles = Array.from(document.querySelectorAll(".botao-controles, .acao")).filter(visivel);
      const barras = Array.from(document.querySelectorAll(".barra"));
      itensFocados = controles.concat(barras);
    }
    if (focoIndex >= itensFocados.length) focoIndex = -1;
    return itensFocados;
  }

  function aplicarFoco() {
    document.querySelectorAll(".focado").forEach((el) => el.classList.remove("focado"));
    itensFocados.forEach((el, i) => {
      el.classList.toggle("focado", i === focoIndex);
    });
  }

  // deselecionar — solta a tarefa selecionada e avisa o app.
  function deselecionar() {
    if (selecionadaEl) {
      selecionadaEl.classList.remove("selecionado");
      selecionadaEl = null;
      document.dispatchEvent(new CustomEvent("painel:selecionarTarefa", { detail: { id: null, on: false } }));
    }
  }

  // moverSpatial — escolhe o alvo mais próximo na direção (por centro/geometria).
  function moverSpatial(dx, dy) {
    const atual = itensFocados[focoIndex];
    if (!atual) return;
    const ra = atual.getBoundingClientRect();
    const cxa = ra.left + ra.width / 2;
    const cya = ra.top + ra.height / 2;
    let melhor = null;
    let melhorScore = Infinity;
    for (const alvo of itensFocados) {
      if (alvo === atual) continue;
      const rb = alvo.getBoundingClientRect();
      const cxb = rb.left + rb.width / 2;
      const cyb = rb.top + rb.height / 2;
      let dif;
      if (dy !== 0) {
        dif = cyb - cya;
        if (Math.sign(dif) !== dy) continue;
      } else {
        dif = cxb - cxa;
        if (Math.sign(dif) !== dx) continue;
      }
      // Distância na direção + penalidade de desalinhamento perpendicular.
      const score = Math.abs(dif) + (dy !== 0 ? Math.abs(cxb - cxa) : Math.abs(cyb - cya)) * 2;
      if (score < melhorScore) {
        melhorScore = score;
        melhor = alvo;
      }
    }
    if (melhor) {
      focoIndex = itensFocados.indexOf(melhor);
      aplicarFoco();
      melhor.scrollIntoView({ block: "nearest" });
    }
  }

  // selecionar — OK: barra alterna seleção (2º OK solta); botão dispara ação.
  function selecionar() {
    coletarNavegaveis();
    const el = itensFocados[focoIndex];
    if (!el) return;

    if (el.classList.contains("barra")) {
      if (selecionadaEl === el) {
        // Segundo OK → solta a seleção (nunca fica preso).
        deselecionar();
      } else {
        if (selecionadaEl) selecionadaEl.classList.remove("selecionado");
        selecionadaEl = el;
        selecionadaEl.classList.add("selecionado");
        garraAtiva = "corpo";
        document.dispatchEvent(new CustomEvent("painel:selecionarTarefa", { detail: { id: el.dataset.id, on: true } }));
      }
      aplicarFoco();
      return;
    }

    el.classList.add("selecionado");
    el.dispatchEvent(new CustomEvent("painel:selecionar", { bubbles: true, detail: { id: el.dataset.acao || el.dataset.id } }));
    setTimeout(() => el.classList.remove("selecionado"), 200);
  }

  // reaplicarSelecao — após re-render, restaura o destaque na barra do mesmo id.
  function reaplicarSelecao() {
    if (!selecionadaEl) return;
    const id = selecionadaEl.dataset.id;
    selecionadaEl.classList.remove("selecionado");
    selecionadaEl = null;
    if (id) {
      const el = document.querySelector('.barra[data-id="' + id + '"]');
      if (el) {
        selecionadaEl = el;
        selecionadaEl.classList.add("selecionado");
      }
    }
  }

  // focarPrimeiraBarra — foco na 1ª barra (ou no menu se não houver barras).
  function focarPrimeiraBarra() {
    coletarNavegaveis();
    const idx = itensFocados.findIndex((el) => el.classList.contains("barra"));
    focoIndex = idx >= 0 ? idx : itensFocados.length ? 0 : -1;
    aplicarFoco();
    return idx >= 0;
  }

  // focoDefinido — há um elemento focado válido?
  function focoDefinido() {
    return focoIndex >= 0 && itensFocados[focoIndex] !== undefined;
  }

  // focarPrimeiro — foco no 1º navegável (ex.: abrir config).
  function focarPrimeiro() {
    coletarNavegaveis();
    if (itensFocados.length) {
      focoIndex = 0;
      aplicarFoco();
    }
  }

  // focarBarra — devolve o foco à barra de um id (ex.: fechar config).
  function focarBarra(id) {
    coletarNavegaveis();
    const idx = itensFocados.findIndex((el) => el.classList.contains("barra") && el.dataset.id === id);
    if (idx >= 0) {
      focoIndex = idx;
      aplicarFoco();
    }
  }

  // ciclarGarra — ↑/↓ troca a garra da barra selecionada.
  function ciclarGarra() {
    const i = GARRAS.indexOf(garraAtiva);
    garraAtiva = GARRAS[(i + 1) % GARRAS.length];
    document.dispatchEvent(new CustomEvent("painel:garraMudou", { detail: { garra: garraAtiva } }));
    return garraAtiva;
  }

  // mover — setas: navegam espacialmente; com tarefa selecionada, laterais
  // empurram na garra ativa e verticais trocam a garra; config usa lista linear.
  function mover(dx, dy) {
    coletarNavegaveis();
    if (itensFocados.length === 0) return;

    if (configPanelVisivel()) {
      if (focoIndex === -1) focoIndex = 0;
      const n = itensFocados.length;
      if (dx !== 0) focoIndex = (focoIndex + dx + n) % n;
      else if (dy !== 0) focoIndex = Math.max(0, Math.min(n - 1, focoIndex + dy));
      aplicarFoco();
      return;
    }

    if (selecionadaEl) {
      if (dx !== 0) {
        document.dispatchEvent(new CustomEvent("painel:empurrar", { detail: { id: selecionadaEl.dataset.id, dir: dx, garra: garraAtiva } }));
      } else if (dy !== 0) {
        ciclarGarra();
      }
      return;
    }

    if (focoIndex === -1) focoIndex = 0;
    moverSpatial(dx, dy);
  }

  // inicializar — liga teclado (setas, Enter, Esc) e eventos do D-pad.
  function inicializar() {
    document.addEventListener("keydown", (e) => {
      switch (e.key) {
        case "ArrowUp": e.preventDefault(); mover(0, -1); break;
        case "ArrowDown": e.preventDefault(); mover(0, 1); break;
        case "ArrowLeft": e.preventDefault(); mover(-1, 0); break;
        case "ArrowRight": e.preventDefault(); mover(1, 0); break;
        case "Enter": e.preventDefault(); selecionar(); break;
        case "Escape":
          e.preventDefault();
          if (configPanelVisivel()) document.dispatchEvent(new CustomEvent("painel:fecharConfig"));
          else if (selecionadaEl) deselecionar();
          else document.dispatchEvent(new CustomEvent("painel:voltar"));
          break;
      }
    });
    coletarNavegaveis();
    // O foco real é definido no 1º render (as barras ainda não existem aqui).
    aplicarFoco();
  }

  const api = {
    inicializar,
    mover,
    selecionar,
    coletarNavegaveis,
    aplicarFoco,
    deselecionar,
    reaplicarSelecao,
    focarPrimeiro,
    focarBarra,
    focarPrimeiraBarra,
    focoDefinido,
    ciclarGarra,
    garraAtiva: () => garraAtiva,
    temSelecao: () => !!selecionadaEl,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.remoteNav = api;
})(typeof window !== "undefined" ? window : this);