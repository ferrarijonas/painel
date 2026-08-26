(function (global) {
  "use strict";

  // clima — temperatura atual e previsão por hora "daqui pra frente",
  // para o padeiro ajustar as receitas ao clima do dia (Uberlândia/MG).
  // Fonte: Open-Meteo (gratuito, sem chave, HTTPS).

  const GEO = { latitude: -18.9186, longitude: -48.2772, nome: "Uberlândia" };
  const HORAS_PREVISAO = 12; // gráfico: próximas 12h a partir de agora

  // CODIGO — emoji de condição por código WMO (0 céu limpo … 95 tempestade).
  const CODIGO = {
    0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️",
    45: "🌫️", 48: "🌫️",
    51: "🌦️", 53: "🌦️", 55: "🌧️",
    61: "🌧️", 63: "🌧️", 65: "🌧️",
    80: "🌦️", 81: "🌧️", 82: "⛈️",
    95: "⛈️", 96: "⛈️", 99: "⛈️",
  };

  let el = null;
  let timer = null;
  let dados = null;

  function url() {
    const p = [
      "current=temperature_2m,relative_humidity_2m,weather_code",
      "hourly=temperature_2m,relative_humidity_2m,weather_code",
      "timezone=auto",
      "forecast_days=2",
    ].join("&");
    return `https://api.open-meteo.com/v1/forecast?latitude=${GEO.latitude}&longitude=${GEO.longitude}&${p}`;
  }

  // agoraMin — minutos desde 00h da máquina local (fuso do box).
  function agoraMin() {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }

  // horaDeISO — "HH:MM" local a partir do ISO "YYYY-MM-DDTHH:MM".
  function horaDeISO(iso) {
    return iso.slice(11, 16);
  }

  function emojiDe(codigo) {
    return CODIGO[codigo] || "🌡️";
  }

  // carregar — busca a previsão; guarda e renderiza; erro → mostra só o hoje.
  function carregar() {
    if (!el) return;
    fetch(url(), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("http"))))
      .then((j) => {
        dados = j;
        renderizar();
      })
      .catch(() => {
        el.textContent = GEO.nome + " — clima indisponível";
      });
  }

  // renderizar — desenha o resumo de agora + gráfico das próximas horas.
  function renderizar() {
    if (!el || !dados) return;
    const agora = dados.current || {};
    const h = dados.hourly || {};
    const temps = h.temperature_2m || [];
    const times = h.time || [];

    el.innerHTML = "";

    // Bloco "agora": temperatura, umidade, condição.
    const agoraBox = document.createElement("div");
    agoraBox.className = "clima-agora";
    const temp = Math.round(agora.temperature_2m);
    const umi = Math.round(agora.relative_humidity_2m);
    agoraBox.innerHTML =
      `<span class="clima-emoji">${emojiDe(agora.weather_code)}</span>` +
      `<span class="clima-temp">${temp}°</span>` +
      `<span class="clima-det">${umi}% umid · ${GEO.nome}</span>`;
    el.appendChild(agoraBox);

    // Gráfico "daqui pra frente": próxima HORAS_PREVISAO horas.
    const g = document.createElement("div");
    g.className = "clima-grafico";
    const inicio = agoraMin();
    const daqui = []; // {hora, temp}
    for (let i = 0; i < times.length; i++) {
      const hm = horaDeISO(times[i]);
      const min = parseInt(hm.slice(0, 2), 10) * 60 + parseInt(hm.slice(3, 5), 10);
      if (min >= inicio) daqui.push({ hora: hm, temp: temps[i] });
      if (daqui.length >= HORAS_PREVISAO) break;
    }
    if (daqui.length === 0) {
      // Amanhã (virada de dia) — usa as primeiras horas da previsão.
      for (let i = 0; i < HORAS_PREVISAO && i < times.length; i++) {
        daqui.push({ hora: horaDeISO(times[i]), temp: temps[i] });
      }
    }

    const minTemp = Math.min.apply(null, daqui.map((x) => x.temp));
    const maxTemp = Math.max.apply(null, daqui.map((x) => x.temp));
    const range = maxTemp - minTemp || 1;

    for (const item of daqui) {
      const col = document.createElement("div");
      col.className = "clima-col";
      const barra = document.createElement("div");
      barra.className = "clima-barra";
      const h2 = Math.round(((item.temp - minTemp) / range) * 26 + 8); // 8..34px
      barra.style.height = h2 + "px";
      const rotuloTemp = document.createElement("div");
      rotuloTemp.className = "clima-g-temp";
      rotuloTemp.textContent = Math.round(item.temp) + "°";
      const rotuloHora = document.createElement("div");
      rotuloHora.className = "clima-g-hora";
      rotuloHora.textContent = item.hora.slice(0, 2) + "h";
      col.appendChild(rotuloTemp);
      col.appendChild(barra);
      col.appendChild(rotuloHora);
      g.appendChild(col);
    }
    el.appendChild(g);
  }

  function inicializar(elCont) {
    el = elCont;
    carregar();
    if (timer) clearInterval(timer);
    timer = setInterval(carregar, 30 * 60 * 1000); // atualiza a cada 30min
  }

  const api = { inicializar, carregar, GEO };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.clima = api;
})(typeof window !== "undefined" ? window : this);