(function (global) {
  "use strict";

  // remoteNav — traduz D-pad/teclado/celular em foco, seleção, empurrão e config (Eng §3).
  // Navegação 10-foot: setas movem o foco, OK seleciona/confirma, Voltar sai.
  // Tarefa selecionada: setas empurram no tempo; OK de novo abre as configs.

  let focoIndex = -1;
  let itensFocados = [];
  let selecionadaEl = null;

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

  // selecionar — OK: barra alterna seleção (2º OK abre config); botão dispara ação.
  function selecionar() {
    coletarNavegaveis();
    const el = itensFocados[focoIndex];
    if (!el) return;

    if (el.classList.contains("barra")) {
      if (selecionadaEl === el) {
        // Segundo OK → abre as configs da tarefa (duração etc.).
        document.dispatchEvent(new CustomEvent("painel:abrirConfig", { detail: { id: el.dataset.id } }));
      } else {
        if (selecionadaEl) selecionadaEl.classList.remove("selecionado");
        selecionadaEl = el;
        selecionadaEl.classList.add("selecionado");
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

  // mover — setas: navegam o foco; com tarefa selecionada (e config fechada),
  // laterais empurram no tempo.
  function mover(dx, dy) {
    coletarNavegaveis();
    if (itensFocados.length === 0) return;

    if (!configPanelVisivel() && selecionadaEl) {
      if (dx !== 0) {
        document.dispatchEvent(new CustomEvent("painel:empurrar", { detail: { id: selecionadaEl.dataset.id, dir: dx } }));
      }
      return;
    }

    if (focoIndex === -1) focoIndex = 0;
    const atual = itensFocados[focoIndex];
    const n = itensFocados.length;

    if (dx !== 0) {
      const alvo = focoIndex + dx;
      focoIndex = (alvo + n) % n;
    } else if (dy !== 0) {
      const alvo = focoIndex + dy;
      if (alvo >= 0 && alvo < n) focoIndex = alvo;
    }

    const novo = itensFocados[focoIndex];
    if (novo && novo !== atual) {
      novo.scrollIntoView({ block: "nearest" });
    }
    aplicarFoco();
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
    if (itensFocados.length) {
      focoIndex = 0;
      aplicarFoco();
    }
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
    temSelecao: () => !!selecionadaEl,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.remoteNav = api;
})(typeof window !== "undefined" ? window : this);