(function (global) {
  "use strict";

  // clima — temperatura atual e previsão por hora "daqui pra frente",
  // para o padeiro ajustar as receitas ao clima do dia (Uberlândia/MG).
  // Fonte: Open-Meteo (gratuito, sem chave, HTTPS).
  // Render: preenche a temperatura embaixo de cada hora do eixo da timeline.

  const GEO = { latitude: -18.9186, longitude: -48.2772, nome: "Uberlândia" };

  // CODIGO — emoji de condição por código WMO (0 céu limpo … 95 tempestade).
  const CODIGO = {
    0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️",
    45: "🌫️", 48: "🌫️",
    51: "🌦️", 53: "🌦️", 55: "🌧️",
    61: "🌧️", 63: "🌧️", 65: "🌧️",
    80: "🌦️", 81: "🌧️", 82: "⛈️",
    95: "⛈️", 96: "⛈️", 99: "⛈️",
  };

  // condicao — emoji "minimalista": sol, nuvem, chuva ou frio (pela temperatura).
  function condicao(codigo, temp) {
    if (temp !== undefined && temp <= 12) return "🥶";
    if (temp !== undefined && temp >= 32) return "☀️";
    return CODIGO[codigo] || "🌡️";
  }

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

  // carregar — busca a previsão; guarda e aplica no eixo.
  function carregar() {
    fetch(url(), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("http"))))
      .then((j) => {
        dados = j;
        aplicar();
      })
      .catch(() => {});
  }

  // aplicar — preenche a temperatura de cada hora do eixo (só as futuras
  // ou atuais; as passadas ficam apagadas), com destaque na hora "agora",
  // e o resumo minimalista ao lado do relógio (ícone + temp atual).
  function aplicar() {
    if (!dados) return;
    const agora = dados.current || {};
    const h = dados.hourly || {};
    const temps = h.temperature_2m || [];
    const times = h.time || [];
    if (times.length === 0) return;

    const agoraHora = Math.floor(agoraMin() / 60);

    document.querySelectorAll(".hora-temp").forEach((el) => {
      const hh = parseInt(el.dataset.hora, 10);
      if (!Number.isFinite(hh)) return;
      // Encontra a temperatura desta hora (do dia atual, virada p/ amanhã).
      const idx = times.findIndex((t) => parseInt(horaDeISO(t).slice(0, 2), 10) === hh);
      const valor = idx >= 0 ? temps[idx] : undefined;
      const passado = hh < agoraHora;

      if (valor === undefined) {
        el.textContent = "—";
        el.classList.add("vazio");
        el.classList.remove("atual");
        return;
      }
      el.textContent = Math.round(valor) + "°";
      el.classList.remove("vazio");
      if (hh === agoraHora) el.classList.add("atual");
      else el.classList.remove("atual");
      el.style.opacity = passado ? "0.45" : "1";
    });

    // Resumo atual ao lado do relógio: ícone (sol/chuva/frio) + temperatura.
    const atual = agora.temperature_2m;
    const badge = document.getElementById("climaMini");
    if (badge) {
      const emojiEl = badge.querySelector(".clima-mini-emoji");
      const tempEl = badge.querySelector(".clima-mini-temp");
      if (atual !== undefined) {
        if (emojiEl) emojiEl.textContent = condicao(agora.weather_code, atual);
        if (tempEl) tempEl.textContent = Math.round(atual) + "°";
      } else if (emojiEl) {
        emojiEl.textContent = "—";
      }
    }

    // Título da página: temperatura atual (acessível p/ quem usa a página).
    if (atual !== undefined && document.title) {
      document.title = `${Math.round(atual)}° · ${GEO.nome} — painel`;
    }
  }

  function inicializar() {
    carregar();
    if (timer) clearInterval(timer);
    timer = setInterval(carregar, 30 * 60 * 1000); // atualiza a cada 30min
  }

  const api = { inicializar, carregar, aplicar, GEO };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.clima = api;
})(typeof window !== "undefined" ? window : this);