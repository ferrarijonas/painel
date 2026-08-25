"use strict";

// diag-edge.js — diagnóstico com Edge real via puppeteer-core.
// Uso: node diag-edge.js [url] [offline]
// "offline" bloqueia firebaseio/gstatic para simular rede de padaria.

const puppeteer = require("puppeteer-core");
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const URL = process.argv[2] || "http://localhost:8125/";
const MODO = process.argv[3] || "online";
const SEM_DB = MODO === "nodb" || MODO === "offline";

(async () => {
  const args = ["--no-sandbox", "--disable-gpu"];
  if (SEM_DB) {
    // derruba DNS do firebaseio → HTTP e WebSocket falham (DB inacessível),
    // mas o CDN gstatic continua carregando (SDK sobe, DB nunca responde).
    args.push('--host-resolver-rules=MAP *firebaseio.com ~NOTFOUND, MAP firebaseio.com ~NOTFOUND');
  }
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args });
  const page = await browser.newPage();
  const logs = [];
  const erros = [];
  const falhas = [];

  page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on("pageerror", (e) => erros.push("PAGEERROR: " + String(e)));

  if (SEM_DB) {
    page.on("requestfailed", (r) => falhas.push("FAIL: " + r.url() + " -> " + ((r.failure() || {}).errorText || "")));
  } else {
    page.on("requestfailed", (r) => falhas.push("FAIL: " + r.url() + " -> " + ((r.failure() || {}).errorText || "")));
    page.on("response", (r) => { if (r.status() >= 400) falhas.push("HTTP " + r.status() + ": " + r.url()); });
  }

  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 16000));

  const estado = await page.evaluate(() => {
    const status = (document.getElementById("status") || {}).textContent || "";
    const data = (document.getElementById("dataAtual") || {}).textContent || "";
    const barras = Array.from(document.querySelectorAll(".barra")).length;
    const rotulos = Array.from(document.querySelectorAll(".rotulo-barra")).map((b) => b.textContent);
    const pistas = Array.from(document.querySelectorAll(".rotulo-pista")).map((p) => p.textContent);
    const conectores = document.querySelectorAll(".conectores line").length;
    const local = window.deviceSync && deviceSync.emModoLocal ? deviceSync.emModoLocal() : "n/a";
    return { status, data, barras, rotulos, pistas, conectores, local };
  });

  console.log("=== ESTADO ===");
  console.log(JSON.stringify(estado, null, 2));
  console.log("=== LOGS ===");
  console.log(logs.join("\n") || "(sem logs)");
  console.log("=== ERROS ===");
  console.log(erros.join("\n") || "nenhum");
  console.log("=== REDE ===");
  console.log(falhas.join("\n") || "nenhuma falha");

  await browser.close();
})().catch((e) => {
  console.error("ERRO DIAG:", e);
  process.exit(1);
});