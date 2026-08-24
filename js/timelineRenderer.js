(function (global) {
  "use strict";

  // timelineRenderer — desenha a linha do balanço (Gantt) 8h-18h (Eng §3).
  // Estilo 10-foot: barras grandes, legíveis a ~3m, foco claro por D-pad.

  const T0 = 0;
  const T1 = 600; // 8h-18h em minutos

  // corPorRecurso — cor funcional por tipo de recurso (design: acento por função).
  const COR = {
    exclusivo: "#b3541e",
    "capacidade-N": "#2e6f95",
    passivo: "#7a8b3d",
    "pessoa-ativa": "#6b4e8e",
    livre: "#3d7a5a",
  };

  function horaTexto(min) {
    const h = Math.floor(min / 60) + 8;
    const m = min % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  function percentual(min) {
    return ((min - T0) / (T1 - T0)) * 100;
  }

  // renderHoras — constrói o grid de horas no eixo.
  function renderHoras(el) {
    const grid = document.createElement("div");
    grid.className = "eixo-horas";
    for (let m = T0; m <= T1; m += 60) {
      const tick = document.createElement("div");
      tick.className = "hora";
      tick.style.left = percentual(m) + "%";
      tick.textContent = horaTexto(m);
      grid.appendChild(tick);
    }
    el.appendChild(grid);
  }

  // barraDeTarefa — cria a barra de uma tarefa agendada.
  function barraDeTarefa(item, regrasRecursos) {
    const barra = document.createElement("div");
    barra.className = "barra";
    barra.dataset.id = item.id;

    const principal = item.recursos && item.recursos.length ? item.recursos[0] : "livre";
    const regra = regrasRecursos[principal];
    const tipo = regra ? regra.tipo : "livre";
    barra.style.background = COR[tipo] || COR.livre;
    barra.style.left = percentual(item.inicio) + "%";
    barra.style.width = percentual(item.fim - item.inicio) + "%";

    const rotulo = document.createElement("span");
    rotulo.className = "rotulo";
    rotulo.textContent = `${item.nome} · ${horaTexto(item.inicio)}`;
    barra.appendChild(rotulo);

    return barra;
  }

  // render — desenha o dia completo na timeline.
  function render(el, agenda, regrasRecursos) {
    el.innerHTML = "";
    renderHoras(el);
    const corpo = document.createElement("div");
    corpo.className = "corpo-barras";
    for (const item of agenda) {
      corpo.appendChild(barraDeTarefa(item, regrasRecursos));
    }
    el.appendChild(corpo);
  }

  const api = { render, COR, horaTexto, percentual };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.timelineRenderer = api;
})(typeof window !== "undefined" ? window : this);