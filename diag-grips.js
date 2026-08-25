"use strict";

// diag-grips.js — testa as garras da barra selecionada (corpo/fim/começo).
// Não-destrutivo: +15 e −15 se cancelam. Uso: node diag-grips.js <url>

const puppeteer = require("puppeteer-core");
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const URL = process.argv[2] || "http://localhost:8125/";
const passo = () => new Promise((r) => setTimeout(r, 350));

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
  await passo(800);

  const estado = () =>
    page.evaluate(() => {
      const data = (document.getElementById("dataAtual") || {}).textContent || "";
      let t = null;
      try {
        const d = window.dayStore && dayStore.carregar(data);
        if (d) {
          const tt = d.tarefas.find((x) => x.id === "pao-1-mistura");
          t = tt ? { inicioMin: tt.inicioMin, fimFixo: tt.fimFixo, duracaoMin: tt.duracaoMin } : null;
        }
      } catch (e) {
        t = "erro:" + e.message;
      }
      const bars = Array.from(document.querySelectorAll(".barra"));
      return {
        selecionada: (document.querySelector(".barra.selecionado") || {}).dataset && (document.querySelector(".barra.selecionado") || {}).dataset.id || null,
        garraEtiqueta: (document.querySelector(".garra-etiqueta") || {}).textContent || "",
        garraAtiva: Array.from(document.querySelectorAll(".garra.ativo")).map((g) => g.className),
        pao1: t,
        primeiraBarra: (bars[0] && (bars[0].nextElementSibling || {}).textContent) || "",
        status: (document.getElementById("status") || {}).textContent || "",
      };
    });

  console.log("1:", JSON.stringify(await estado()));

  // Seleciona a 1ª barra (foco já começa nela) → garras aparecem (corpo).
  await page.keyboard.press("Enter");
  await passo();
  console.log("2 selecionada (corpo):", JSON.stringify(await estado()));

  // ↑/↓ cicla para "fim"; → aplica +15 na duração.
  await page.keyboard.press("ArrowDown");
  await passo();
  console.log("3 garra fim:", JSON.stringify(await estado()));
  await page.keyboard.press("ArrowRight");
  await passo(1200);
  console.log("4 fim +15:", JSON.stringify(await estado()));
  await page.keyboard.press("ArrowLeft");
  await passo(1200);
  console.log("5 fim -15 (restaura):", JSON.stringify(await estado()));

  // Cicla para "começo" (manter fim); → move o começo mantendo o fim.
  await page.keyboard.press("ArrowDown");
  await passo();
  console.log("6 garra começo:", JSON.stringify(await estado()));
  await page.keyboard.press("ArrowRight");
  await passo(1200);
  console.log("7 começo +15 (fim fixo):", JSON.stringify(await estado()));
  await page.keyboard.press("ArrowLeft");
  await passo(1200);
  console.log("8 começo -15 (restaura):", JSON.stringify(await estado()));

  // Volta para corpo e deseleciona.
  await page.keyboard.press("ArrowDown");
  await passo();
  await page.keyboard.press("Escape");
  await passo();
  console.log("9 corpo + deselecionada:", JSON.stringify(await estado()));

  await browser.close();
})().catch((e) => {
  console.error("ERRO:", e);
  process.exit(1);
});