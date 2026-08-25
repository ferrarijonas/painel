"use strict";

// diag-persist.js — testa se a mudança sobrevive a um reload da página.
// Fluxo: lê estado → empurra 1ª barra +15 → recarrega → lê de novo → restaura (−15).
// Uso: node diag-persist.js <url>

const puppeteer = require("puppeteer-core");
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const URL = process.argv[2] || "http://localhost:8125/";
const passo = (ms) => new Promise((r) => setTimeout(r, ms || 400));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e)));
  page.on("requestfailed", (r) => console.log("REQFALHA:", r.url(), "->", ((r.failure() || {}).errorText || "")));
  page.on("console", (m) => {
    if (m.type() === "error" || m.text().indexOf("Firebase") !== -1 || m.text().indexOf("WARNING") !== -1) console.log("CONSOLE[" + m.type() + "]:", m.text());
  });

  const estado = () =>
    page.evaluate(() => {
      const dias = window.deviceSync && deviceSync.obterDias ? deviceSync.obterDias() : null;
      const data = (document.getElementById("dataAtual") || {}).textContent || "";
      let t = null;
      try {
        if (dias && dias[data]) {
          const tt = dias[data].tarefas.find((x) => x.id === "pao-1-mistura");
          t = tt ? { inicioMin: tt.inicioMin, duracaoMin: tt.duracaoMin } : null;
        }
      } catch (e) {
        t = "erro:" + e.message;
      }
      const bars = Array.from(document.querySelectorAll(".barra"));
      return {
        data,
        pao1Mistura: t,
        primeiraBarra: (bars[0] && (bars[0].nextElementSibling || {}).textContent) || "",
        local: window.deviceSync && deviceSync.emModoLocal ? deviceSync.emModoLocal() : null,
      };
    });

  await page.goto(URL, { waitUntil: "networkidle2", timeout: 30000 });
  await page.waitForFunction(() => document.querySelectorAll(".barra").length > 0, { timeout: 20000 });
  await passo(800);

  console.log("1 antes:", JSON.stringify(await estado()));

  // Seleciona a 1ª barra e empurra +15 (1 press).
  await page.keyboard.press("ArrowDown");
  await passo();
  await page.keyboard.press("Enter");
  await passo();
  await page.keyboard.press("ArrowRight");
  await passo(1500); // tempo para o Firebase gravar

  console.log("2 depois de +15:", JSON.stringify(await estado()));

  // Recarrega.
  await page.reload({ waitUntil: "networkidle2", timeout: 30000 });
  await page.waitForFunction(() => document.querySelectorAll(".barra").length > 0, { timeout: 20000 });
  await passo(1200);

  console.log("3 depois do RELOAD:", JSON.stringify(await estado()));

  // Restaura: seleciona a 1ª barra e empurra −15.
  await page.keyboard.press("ArrowDown");
  await passo();
  await page.keyboard.press("Enter");
  await passo();
  await page.keyboard.press("ArrowLeft");
  await passo(1500);
  console.log("4 restaurado (−15):", JSON.stringify(await estado()));

  await browser.close();
})().catch((e) => {
  console.error("ERRO:", e);
  process.exit(1);
});