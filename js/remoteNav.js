(function (global) {
  "use strict";

  // remoteNav — traduz D-pad/teclado/celular em foco e seleção (Eng §3).
  // Navegação 10-foot: setas movem o foco, OK seleciona, Voltar cancela.

  let focoIndex = -1;
  let itensFocados = [];

  function coletarNavegaveis() {
    // Ordem de tabulação: ações do topo, depois barras da timeline.
    const acoes = Array.from(document.querySelectorAll(".acao"));
    const barras = Array.from(document.querySelectorAll(".barra"));
    itensFocados = acoes.concat(barras);
    if (focoIndex >= itensFocados.length) focoIndex = -1;
    return itensFocados;
  }

  function aplicarFoco() {
    itensFocados.forEach((el, i) => {
      el.classList.toggle("focado", i === focoIndex);
    });
  }

  function mover(dx, dy) {
    coletarNavegaveis();
    if (itensFocados.length === 0) return;
    if (focoIndex === -1) focoIndex = 0;

    const atual = itensFocados[focoIndex];
    const n = itensFocados.length;

    if (dx !== 0) {
      // Horizontal: circula entre ações (topo) e barras.
      const alvo = focoIndex + dx;
      focoIndex = (alvo + n) % n;
    } else if (dy !== 0) {
      // Vertical: sobe/desce na lista (ações vêm antes das barras).
      const alvo = focoIndex + dy;
      if (alvo >= 0 && alvo < n) focoIndex = alvo;
    }

    const novo = itensFocados[focoIndex];
    if (novo && novo !== atual) {
      novo.scrollIntoView({ block: "nearest" });
    }
    aplicarFoco();
  }

  function selecionar() {
    coletarNavegaveis();
    const el = itensFocados[focoIndex];
    if (el) {
      el.classList.add("selecionado");
      el.dispatchEvent(new CustomEvent("painel:selecionar", { detail: { id: el.dataset.id } }));
      setTimeout(() => el.classList.remove("selecionado"), 200);
    }
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
        case "Escape": document.dispatchEvent(new CustomEvent("painel:voltar")); break;
      }
    });
    coletarNavegaveis();
    if (itensFocados.length) {
      focoIndex = 0;
      aplicarFoco();
    }
  }

  const api = { inicializar, mover, selecionar, coletarNavegaveis, aplicarFoco };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.remoteNav = api;
})(typeof window !== "undefined" ? window : this);