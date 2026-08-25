"use strict";

// test-render.js — valida o boot + sincronização com o Firebase
// usando um navegador real (Chrome) via Puppeteer-core.
// Aguarda o Firebase responder (rede real) antes de afirmar.

const puppeteer = require("puppeteer-core");

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = process.argv[2] || "http://localhost:8125/";

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"],
  });
  const page = await browser.newPage();
  const erros = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") erros.push(msg.text());
    else if (msg.text().indexOf("[main]") !== -1 || msg.text().indexOf("[deviceSync]") !== -1) console.log("LOG:", msg.text());
  });
  page.on("pageerror", (e) => erros.push(String(e)));

  await page.goto(URL, { waitUntil: "networkidle2", timeout: 30000 });

  // Aguarda as barras de tarefa aparecerem (prova que o boot completou).
  await page.waitForFunction(() => document.querySelectorAll(".barra").length > 0, { timeout: 20000 });

  const resultado = await page.evaluate(() => {
    const barras = Array.from(document.querySelectorAll(".rotulo-barra")).map((b) => b.textContent);
    const pistas = Array.from(document.querySelectorAll(".rotulo-pista")).map((p) => p.textContent);
    const conectores = document.querySelectorAll(".conectores line").length;
    const status = (document.getElementById("status") || {}).textContent || "";
    const datas = Object.keys(dayStore ? dayStore.listarDatas() : {});
    const diasRaw = window.deviceSync ? deviceSync.obterDias() : null;
    const firebaseOk = typeof window.firebase !== "undefined" && !!window.firebase.database;
    const dataMostrada = (document.getElementById("dataAtual") || {}).textContent || "";
    const diasInternos = (function () {
      try {
        return JSON.stringify(dayStore.listarDatas());
      } catch (e) {
        return "erro:" + e.message;
      }
    })();
    return {
      barras,
      pistas,
      conectores,
      status,
      datas,
      diasTipo: Array.isArray(diasRaw) ? "array" : typeof diasRaw,
      diasChaves: diasRaw ? Object.keys(diasRaw) : [],
      firebaseOk,
      dataMostrada,
      diasInternos,
    };
  });

  console.log("BARRAS:", JSON.stringify(resultado.barras, null, 2));
  console.log("PISTAS:", JSON.stringify(resultado.pistas));
  console.log("CONECTORES:", resultado.conectores);
  console.log("STATUS:", resultado.status);
  console.log("DIAS:", JSON.stringify(resultado.datas));
  console.log("DIAS RAW:", resultado.diasTipo, JSON.stringify(resultado.diasChaves));
  console.log("DATA MOSTRADA:", resultado.dataMostrada);
  console.log("DIAS INTERNOS (dayStore):", resultado.diasInternos);
  console.log("FIREBASE SDK CARREGADO:", resultado.firebaseOk);
  console.log("ERROS:", erros.length ? JSON.stringify(erros, null, 2) : "nenhum");

  await browser.close();

  // Critério: se há erro de console OU nenhuma barra OU flowline incompleta, falhou.
  if (erros.length > 0 || resultado.barras.length === 0 || resultado.conectores < 4) {
    console.log("RESULTADO: FALHOU");
    process.exit(1);
  } else {
    console.log("RESULTADO: OK");
  }
})().catch((e) => {
  console.error("ERRO no teste:", e.message);
  process.exit(1);
});