"use strict";

// diag-spatial.js — valida a navegação espacial: ↓ = etapa de baixo,
// → = outro pão na mesma pista, ↑ = sobe. Uso: node diag-spatial.js <url>

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

  const foco = () =>
    page.evaluate(() => {
      const el = document.querySelector(".focado");
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { id: el.dataset.id || el.dataset.acao || el.className, x: Math.round(r.x), y: Math.round(r.y) };
    });

  console.log("1 inicial:", JSON.stringify(await foco()));
  await page.keyboard.press("ArrowDown");
  await passo();
  console.log("2 ↓ (etapa abaixo):", JSON.stringify(await foco()));
  await page.keyboard.press("ArrowRight");
  await passo();
  console.log("3 → (mesma pista):", JSON.stringify(await foco()));
  await page.keyboard.press("ArrowLeft");
  await passo();
  console.log("4 ← (volta):", JSON.stringify(await foco()));
  await page.keyboard.press("ArrowUp");
  await passo();
  console.log("5 ↑ (sobe):", JSON.stringify(await foco()));

  // Enter seleciona (modo mover) e Esc deseleciona.
  await page.keyboard.press("Enter");
  await passo();
  console.log("6 status com seleção:", JSON.stringify(await page.evaluate(() => (document.getElementById("status") || {}).textContent)));
  await page.keyboard.press("Escape");
  await passo();
  console.log("7 status sem seleção:", JSON.stringify(await page.evaluate(() => (document.getElementById("status") || {}).textContent)));

  await browser.close();
})().catch((e) => {
  console.error("ERRO:", e);
  process.exit(1);
});