"use strict";

// diag-mobile.js — inspeciona o render em viewport de celular.
// Uso: node diag-mobile.js <url> [largura]

const puppeteer = require("puppeteer-core");
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const URL = process.argv[2] || "https://ferrarijonas.github.io/painel/";
const LARGURA = parseInt(process.argv[3] || "390", 10);
const passo = (ms) => new Promise((r) => setTimeout(r, ms || 400));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: LARGURA, height: 844, isMobile: true, hasTouch: true });
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e)));

  await page.goto(URL, { waitUntil: "networkidle2", timeout: 30000 });
  await page.waitForFunction(() => document.querySelectorAll(".barra").length > 0, { timeout: 20000 });
  await passo(800);

  const info = await page.evaluate(() => {
    const cenario = document.querySelector(".cenario");
    const miolo = document.querySelector(".miolo");
    const topo = document.querySelector(".topo");
    const pistas = document.querySelector(".pistas");
    const canto = document.querySelector(".canto");
    const timeline = document.getElementById("timeline");
    const barras = Array.from(document.querySelectorAll(".barra"));
    const barra0 = barras[0];
    const r = (el) => el ? { w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height), top: Math.round(el.getBoundingClientRect().top), left: Math.round(el.getBoundingClientRect().left) } : null;
    return {
      viewport: window.innerWidth + "x" + window.innerHeight,
      cenario: r(cenario),
      miolo: r(miolo),
      topo: r(topo),
      pistas: r(pistas),
      canto: r(canto),
      timeline: r(timeline),
      qtdBarras: barras.length,
      barra0: r(barra0),
      primeiraBarraTexto: barra0 ? barra0.textContent : "",
      bodyScrollH: document.body.scrollHeight,
      bodyClientH: document.documentElement.clientHeight,
      overflowBody: getComputedStyle(document.body).overflow,
    };
  });
  console.log(JSON.stringify(info, null, 2));

  await page.screenshot({ path: "shot-mobile.png" });
  await browser.close();
})().catch((e) => {
  console.error("ERRO:", e);
  process.exit(1);
});
