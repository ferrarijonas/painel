(function (global) {
  "use strict";

  // remoteNav — traduz D-pad/teclado/celular em foco, seleção e empurrão (Eng §3).
  // Navegação 10-foot: setas movem o foco, OK seleciona/confirma, Voltar sai.
  // Tarefa selecionada: setas horizontais empurram no tempo (re-encaixe automático).

  let focoIndex = -1;
  let itensFocados = [];
  let selecionadaEl = null;

  // visivel — só navegáveis visíveis (controles escondidos ficam fora do foco).
  function visivel(el) {
    return el.offsetParent !== null;
  }

  function coletarNavegaveis() {
    const controles = Array.from(document.querySelectorAll(".botao-controles, .acao")).filter(visivel);
    const barras = Array.from(document.querySelectorAll(".barra"));
    itensFocados = controles.concat(barras);
    if (focoIndex >= itensFocados.length) focoIndex = -1;
    return itensFocados;
  }

  function aplicarFoco() {
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

  // selecionar — OK: barra alterna seleção; botão dispara a ação.
  function selecionar() {
    coletarNavegaveis();
    const el = itensFocados[focoIndex];
    if (!el) return;

    if (el.classList.contains("barra")) {
      if (selecionadaEl === el) {
        deselecionar();
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
    el.dispatchEvent(new CustomEvent("painel:selecionar", { detail: { id: el.dataset.acao || el.dataset.id } }));
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

  // mover — setas: navegam o foco; com tarefa selecionada, laterais empurram.
  function mover(dx, dy) {
    coletarNavegaveis();
    if (itensFocados.length === 0) return;

    if (selecionadaEl) {
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
          if (selecionadaEl) deselecionar();
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
    temSelecao: () => !!selecionadaEl,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.remoteNav = api;
})(typeof window !== "undefined" ? window : this);