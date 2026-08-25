"use strict";

// diag-config.js — testa o modal de config da tarefa (abrir, −/+ duração, fechar).
// Não-destrutivo: −15 e +15 se cancelam (net zero). Uso: node diag-config.js <url>

const puppeteer = require("puppeteer-core");
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const URL = process.argv[2] || "http://localhost:8125/";
const passo = () => new Promise((r) => setTimeout(r, 250));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e)));
  await page.goto(URL, { waitUntil: "networkidle2", timeout: 30000 });
  await page.waitForFunction(() => document.querySelectorAll(".barra").length > 0, { timeout: 20000 });
  await passo();

  const estado = () =>
    page.evaluate(() => {
      const cfg = document.getElementById("config");
      const data = (document.getElementById("dataAtual") || {}).textContent || "";
      let t1 = null;
      let store = null;
      try {
        store = window.dayStore && dayStore.carregar(data);
        if (store) {
          const t = store.tarefas.find((x) => x.id === "pao-1-mistura");
          t1 = t ? { duracaoMin: t.duracaoMin, inicioMin: t.inicioMin } : null;
        }
      } catch (e) {
        store = "erro:" + e.message;
      }
      const bars = Array.from(document.querySelectorAll(".barra"));
      return {
        configVisivel: cfg ? cfg.hidden === false : null,
        configTitulo: (document.getElementById("configTitulo") || {}).textContent || "",
        duracao: (document.getElementById("configDuracao") || {}).textContent || "",
        status: (document.getElementById("status") || {}).textContent || "",
        pao1Mistura: t1,
        primeiraBarra: (bars[0] && (bars[0].nextElementSibling || {}).textContent) || "",
        focado: Array.from(document.querySelectorAll(".focado")).map((e) => e.dataset.acao || e.dataset.id || e.className),
      };
    });

  console.log("1:", JSON.stringify(await estado()));
  // seleciona a 1ª barra e abre config (2º OK)
  await page.keyboard.press("ArrowDown");
  await passo();
  await page.keyboard.press("Enter");
  await passo();
  await page.keyboard.press("Enter");
  await passo();
  console.log("2 aberta:", JSON.stringify(await estado()));
  // −15 (foco inicial está no "−")
  await page.keyboard.press("Enter");
  await passo();
  console.log("3 -15:", JSON.stringify(await estado()));
  // +15 restaura
  await page.keyboard.press("ArrowRight");
  await passo();
  await page.keyboard.press("Enter");
  await passo();
  console.log("4 +15:", JSON.stringify(await estado()));
  // fecha (foco volta à barra, sem "focado" preso no modal)
  await page.keyboard.press("Escape");
  await passo();
  console.log("5 fechada:", JSON.stringify(await estado()));
  await browser.close();
})().catch((e) => {
  console.error("ERRO:", e);
  process.exit(1);
});