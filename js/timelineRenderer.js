(function (global) {
  "use strict";

  // timelineRenderer — desenha a linha do balanço (Eng §3).
  // Padrão da indústria: tempo na horizontal (8h-18h), postos em pistas
  // no eixo Y em ordem de fluxo, e cada receita como linha de fluxo diagonal
  // cruzando os postos (flowline). Tarefas que se sobrepõem na mesma pista
  // empilham em trilhas (duas fornadas do mesmo pão). Estilo 10-foot (TV).

  const T0 = 0;
  const T1 = 600; // 8h-18h em minutos

  const COR_PAO = "#B3541E";
  const COR_EXTRA = "#8A7A5C";
  const COR_CONECTOR = "rgba(138, 122, 92, 0.7)";

  // PISTAS — postos em ordem de fluxo da produção (Concept §9, a refinar).
  const PISTAS = [
    { id: "masseira", rotulo: "Masseira" },
    { id: "fermentacao", rotulo: "Caixa de fermentação" },
    { id: "modelagem", rotulo: "Modelagem" },
    { id: "ambiente", rotulo: "Temp. ambiente" },
    { id: "forno", rotulo: "Forno" },
  ];

  const ROTULO_EXTRA = { livre: "Livre" };

  // Espaços dentro de cada pista (px): respiro do topo, da base e entre trilhas.
  const TOPO_PAD = 22;
  const BASE_PAD = 6;
  const TRILHA_GAP = 30;

  let ultimo = null;
  let agoraEl = null;
  let timerResize = null;

  function horaTexto(min) {
    const h = Math.floor(min / 60) + 8;
    const m = min % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  function percentual(min) {
    return ((min - T0) / (T1 - T0)) * 100;
  }

  // pistaDe — pista de um item agendado, pelo primeiro recurso.
  function pistaDe(item) {
    const rid = item.recursos && item.recursos.length ? item.recursos[0] : "livre";
    const p = PISTAS.find((x) => x.id === rid);
    return p || { id: rid, rotulo: ROTULO_EXTRA[rid] || rid };
  }

  // pistasUsadas — pistas presentes na agenda, na ordem de fluxo.
  function pistasUsadas(agenda) {
    const ids = [];
    for (const item of agenda) {
      const rid = item.recursos && item.recursos.length ? item.recursos[0] : "livre";
      if (ids.indexOf(rid) === -1) ids.push(rid);
    }
    const pistas = PISTAS.filter((p) => ids.indexOf(p.id) !== -1);
    for (const rid of ids) {
      if (!PISTAS.some((p) => p.id === rid)) {
        pistas.push({ id: rid, rotulo: ROTULO_EXTRA[rid] || rid });
      }
    }
    return pistas;
  }

  // trilhasPorPista — atribui a cada item uma trilha (empilhamento) dentro
  // da pista, empilhando apenas quando há sobreposição de tempo.
  function trilhasPorPista(agenda) {
    const porPista = new Map();
    for (const item of agenda) {
      const pid = pistaDe(item).id;
      if (!porPista.has(pid)) porPista.set(pid, []);
      porPista.get(pid).push(item);
    }
    const trilhaDe = new Map();
    let maxTrilhas = 1;
    for (const itens of porPista.values()) {
      itens.sort((a, b) => a.inicio - b.inicio);
      const trilhas = [];
      for (const item of itens) {
        let t = 0;
        while (trilhas[t] && trilhas[t].fim > item.inicio) t++;
        if (!trilhas[t]) trilhas[t] = { fim: item.fim };
        else if (item.fim > trilhas[t].fim) trilhas[t].fim = item.fim;
        trilhaDe.set(item.id, t);
      }
      if (trilhas.length > maxTrilhas) maxTrilhas = trilhas.length;
    }
    return { trilhaDe, maxTrilhas };
  }

  // atualizarAgora — posiciona a linha do "agora" (escondida fora de 8h-18h).
  function atualizarAgora() {
    if (!agoraEl) return;
    const d = new Date();
    const min = (d.getHours() - 8) * 60 + d.getMinutes();
    if (min < T0 || min > T1) {
      agoraEl.style.display = "none";
    } else {
      agoraEl.style.display = "";
      agoraEl.style.left = percentual(min) + "%";
    }
  }

  // render — desenha o dia completo: pistas, trilhas, barras e conectores.
  function render(el, agenda, regrasRecursos) {
    ultimo = { el, agenda, regrasRecursos };
    el.innerHTML = "";

    const pistas = pistasUsadas(agenda);
    const { trilhaDe, maxTrilhas } = trilhasPorPista(agenda);

    // Topo: canto dos postos + eixo de horas.
    const topo = document.createElement("div");
    topo.className = "topo";
    const canto = document.createElement("div");
    canto.className = "canto";
    canto.textContent = "Posto";
    const eixo = document.createElement("div");
    eixo.className = "eixo-horas";
    for (let m = T0; m <= T1; m += 60) {
      const tick = document.createElement("div");
      tick.className = "hora";
      tick.style.left = percentual(m) + "%";
      tick.textContent = horaTexto(m);
      eixo.appendChild(tick);
    }
    // Quebras de 15min no eixo (marcas menores).
    for (let m = T0; m <= T1; m += 15) {
      if (m % 60 === 0) continue;
      const tick = document.createElement("div");
      tick.className = "tick-menor";
      tick.style.left = percentual(m) + "%";
      eixo.appendChild(tick);
    }
    topo.appendChild(canto);
    topo.appendChild(eixo);

    // Miolo: coluna de pistas + cenário das barras.
    const miolo = document.createElement("div");
    miolo.className = "miolo";
    const coluna = document.createElement("div");
    coluna.className = "pistas";
    const cenario = document.createElement("div");
    cenario.className = "cenario";
    miolo.appendChild(coluna);
    miolo.appendChild(cenario);

    el.appendChild(topo);
    el.appendChild(miolo);

    const H = cenario.clientHeight || 400;
    const W = cenario.clientWidth || 800;
    const laneH = H / Math.max(pistas.length, 1);
    const barH = Math.max(
      26,
      Math.min(120, (laneH - TOPO_PAD - BASE_PAD - (maxTrilhas - 1) * TRILHA_GAP) / maxTrilhas)
    );

    const idxPista = new Map();
    pistas.forEach((p, i) => idxPista.set(p.id, i));

    // Faixas de fundo + rótulos das pistas.
    pistas.forEach((pista, i) => {
      const banda = document.createElement("div");
      banda.className = "banda" + (i % 2 ? " banda-alt" : "");
      banda.style.top = i * laneH + "px";
      banda.style.height = laneH + "px";
      cenario.appendChild(banda);

      const rotulo = document.createElement("div");
      rotulo.className = "rotulo-pista";
      rotulo.style.height = laneH + "px";
      rotulo.textContent = pista.rotulo;
      coluna.appendChild(rotulo);
    });

    // Grade de horas (linhas maiores a cada 60min).
    for (let m = T0; m <= T1; m += 60) {
      const linha = document.createElement("div");
      linha.className = "gridlinha";
      linha.style.left = percentual(m) + "%";
      cenario.appendChild(linha);
    }
    // Quebras de 15min (linhas menores).
    for (let m = T0; m <= T1; m += 15) {
      if (m % 60 === 0) continue;
      const linha = document.createElement("div");
      linha.className = "gridlinha-menor";
      linha.style.left = percentual(m) + "%";
      cenario.appendChild(linha);
    }

    // Conectores de fluxo: dependência → diagonal entre postos.
    const porId = new Map();
    for (const item of agenda) porId.set(item.id, item);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "conectores");
    svg.setAttribute("width", W);
    svg.setAttribute("height", H);
    const centro = (item) => {
      const i = idxPista.get(pistaDe(item).id);
      const t = trilhaDe.get(item.id) || 0;
      return (i === undefined ? 0 : i) * laneH + TOPO_PAD + t * (barH + TRILHA_GAP) + barH / 2;
    };
    for (const item of agenda) {
      for (const depId of item.dependeDe || []) {
        const dep = porId.get(depId);
        if (!dep) continue;
        const linha = document.createElementNS("http://www.w3.org/2000/svg", "line");
        linha.setAttribute("x1", (percentual(dep.fim) / 100) * W);
        linha.setAttribute("y1", centro(dep));
        linha.setAttribute("x2", (percentual(item.inicio) / 100) * W);
        linha.setAttribute("y2", centro(item));
        linha.setAttribute("stroke", item.cor || COR_CONECTOR);
        linha.setAttribute("stroke-opacity", item.cor ? "0.85" : "1");
        linha.setAttribute("stroke-width", "3");
        linha.setAttribute("stroke-linecap", "round");
        svg.appendChild(linha);
      }
    }
    cenario.appendChild(svg);

    // Barras das tarefas (uma por trilha), com rótulo acima.
    for (const item of agenda) {
      const pista = pistaDe(item);
      const i = idxPista.get(pista.id);
      if (i === undefined) continue;
      const t = trilhaDe.get(item.id) || 0;
      const x = (percentual(item.inicio) / 100) * W;
      const w = (percentual(item.fim - item.inicio) / 100) * W;
      const y = i * laneH + TOPO_PAD + t * (barH + TRILHA_GAP);

      const barra = document.createElement("div");
      barra.className = "barra";
      barra.dataset.id = item.id;
      barra.style.left = x + "px";
      barra.style.top = y + "px";
      barra.style.width = Math.max(w, 8) + "px";
      barra.style.height = barH + "px";
      barra.style.background = item.cor || (PISTAS.some((p) => p.id === pista.id) ? COR_PAO : COR_EXTRA);
      cenario.appendChild(barra);

      const rotulo = document.createElement("div");
      rotulo.className = "rotulo-barra";
      rotulo.style.left = x + "px";
      rotulo.style.top = Math.max(0, y - 22) + "px";
      rotulo.style.maxWidth = Math.max(w, 60) + "px";
      rotulo.textContent = `${item.nome} · ${horaTexto(item.inicio)}–${horaTexto(item.fim)}`;
      rotulo.title = rotulo.textContent;
      cenario.appendChild(rotulo);
    }

    // Linha do "agora".
    agoraEl = document.createElement("div");
    agoraEl.className = "agora";
    const etiqueta = document.createElement("span");
    etiqueta.className = "etiqueta";
    etiqueta.textContent = "agora";
    agoraEl.appendChild(etiqueta);
    cenario.appendChild(agoraEl);
    atualizarAgora();
  }

  // Redimensionou a tela → re-desenha com as novas medidas.
  if (typeof window !== "undefined") {
    window.addEventListener("resize", () => {
      clearTimeout(timerResize);
      timerResize = setTimeout(() => {
        if (ultimo) render(ultimo.el, ultimo.agenda, ultimo.regrasRecursos);
      }, 150);
    });
  }
  setInterval(atualizarAgora, 30000);

  const api = { render, horaTexto, percentual, pistasUsadas, trilhasPorPista };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.timelineRenderer = api;
})(typeof window !== "undefined" ? window : this);