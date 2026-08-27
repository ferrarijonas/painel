"use strict";

// diag-local.js — verifica o backup localStorage: salva uma mudança, recarrega
// com Firebase bloqueado (nodb) e confere que o dia volta do espelho.
// Uso: node diag-local.js <url>

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

  await page.goto(URL, { waitUntil: "networkidle2", timeout: 30000 });
  await page.waitForFunction(() => document.querySelectorAll(".barra").length > 0, { timeout: 20000 });
  await passo(800);

  // Aplica uma mudança via dayStore.salvar (gravando o espelho).
  const aplicado = await page.evaluate(() => {
    const dias = window.deviceSync.obterDias();
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hoje = `${d.getFullYear()}-${mm}-${dd}`;
    const dia = dias[hoje];
    if (!dia) return { ok: false };
    const t = dia.tarefas[0];
    const orig = t.inicioMin;
    t.inicioMin = (orig === undefined ? 0 : orig) + 15;
    window.dayStore.salvar(dia);
    const espelho = JSON.parse(localStorage.getItem("painel.dias.v1") || "{}");
    return { ok: true, orig, novo: t.inicioMin, espelhoTem: !!(espelho[hoje] && espelho[hoje].tarefas) };
  });
  console.log("APLICOU:", JSON.stringify(aplicado));
  await passo(1500);

  // Lê o espelho direto do localStorage.
  const espelho = await page.evaluate(() => {
    const raw = localStorage.getItem("painel.dias.v1");
    const j = JSON.parse(raw || "{}");
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hoje = `${d.getFullYear()}-${mm}-${dd}`;
    return j[hoje] && j[hoje].tarefas ? j[hoje].tarefas[0].inicioMin : null;
  });
  console.log("ESPELHO localStorage:", espelho);

  // Recarrega e confere que o dia vem do espelho antes de qualquer rede.
  await page.reload({ waitUntil: "networkidle2", timeout: 30000 });
  await page.waitForFunction(() => document.querySelectorAll(".barra").length > 0, { timeout: 20000 });
  const posReload = await page.evaluate(() => {
    const dias = window.deviceSync.obterDias();
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hoje = `${d.getFullYear()}-${mm}-${dd}`;
    const dia = dias && dias[hoje];
    return { inicio: dia ? dia.tarefas[0].inicioMin : null, local: window.deviceSync.emModoLocal ? deviceSync.emModoLocal() : null };
  });
  console.log("APÓS RELOAD:", JSON.stringify(posReload));

  // Restaura o valor original.
  if (aplicado.ok) {
    await page.evaluate((orig) => {
      const dias = window.deviceSync.obterDias();
      const d = new Date();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const hoje = `${d.getFullYear()}-${mm}-${dd}`;
      const dia = dias[hoje];
      if (dia) {
        dia.tarefas[0].inicioMin = orig;
        window.dayStore.salvar(dia);
      }
    }, aplicado.orig);
    console.log("RESTAUROU:", aplicado.orig);
  }

  await browser.close();
})().catch((e) => {
  console.error("ERRO:", e);
  process.exit(1);
});