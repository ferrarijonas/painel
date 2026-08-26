"use strict";

// diag-interact.js — testa menu escondido + seleção + empurrar via teclado/D-pad.
// Uso: node diag-interact.js <url>

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

  const estado = async () =>
    page.evaluate(() => {
      const bars = Array.from(document.querySelectorAll(".barra"));
      const cfg = document.getElementById("config");
      return {
        controlesEscondido: (document.getElementById("controles") || {}).hidden,
        configVisivel: cfg ? cfg.hidden === false : null,
        configDuracao: (document.getElementById("configDuracao") || {}).textContent || "",
        configTitulo: (document.getElementById("configTitulo") || {}).textContent || "",
        selecionadas: bars.filter((b) => b.classList.contains("selecionado")).map((b) => b.dataset.id),
        focado: Array.from(document.querySelectorAll(".focado")).map((e) => (e.className || e.tagName) + ":" + (e.dataset.acao || e.dataset.id || "")),
        rotulos: bars.map((b) => (b.nextElementSibling || {}).textContent || ""),
      };
    });

  console.log("1 inicial:", JSON.stringify(await estado(), null, 2));

  // Menu: foco inicial na 1ª barra → ↑ vai ao menu; Enter abre, Esc fecha.
  await page.keyboard.press("ArrowUp");
  await passo();
  console.log("2 apos ArrowUp (menu):", JSON.stringify(await estado(), null, 2));
  await page.keyboard.press("Enter");
  await passo();
  console.log("3 apos Enter (abre menu):", JSON.stringify(await estado(), null, 2));
  await page.keyboard.press("Escape");
  await passo();
  console.log("4 apos Esc (fecha):", JSON.stringify(await estado(), null, 2));

  // ↓ do menu volta a uma barra (espacial) → Enter seleciona.
  await page.keyboard.press("ArrowDown");
  await passo();
  await page.keyboard.press("Enter");
  await passo();
  console.log("5 barra selecionada:", JSON.stringify(await estado(), null, 2));

  // Empurra 4x para a direita (+60min) e confere o re-encaixe.
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("ArrowRight");
    await passo();
  }
  console.log("6 apos 4x direita:", JSON.stringify(await estado(), null, 2));

  // Esc deseleciona.
  await page.keyboard.press("Escape");
  await passo();
  console.log("7 apos Esc (deseleciona):", JSON.stringify(await estado(), null, 2));

  // OK alterna: Enter seleciona, Enter de novo SOLTA (nunca fica preso).
  await page.keyboard.press("Enter");
  await passo();
  await page.keyboard.press("Enter");
  await passo();
  console.log("8 apos Enter 2x (solta):", JSON.stringify(await estado(), null, 2));

  // Config abre por duplo clique (celular/mouse) e ajusta a duração −15.
  await page.evaluate(() => {
    const b = document.querySelector(".barra");
    if (b) b.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
  });
  await passo();
  console.log("9 config aberta:", JSON.stringify(await estado(), null, 2));
  await page.keyboard.press("Enter");
  await passo();
  console.log("10 duracao -15:", JSON.stringify(await estado(), null, 2));
  await page.keyboard.press("Escape");
  await passo();
  console.log("11 config fechada:", JSON.stringify(await estado(), null, 2));

  await browser.close();
})().catch((e) => {
  console.error("ERRO:", e);
  process.exit(1);
});