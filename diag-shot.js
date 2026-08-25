"use strict";

// diag-shot.js — screenshot da página (Edge headless) para inspeção visual.
// Uso: node diag-shot.js <url> [saida.png]

const puppeteer = require("puppeteer-core");
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const URL = process.argv[2] || "http://localhost:8125/";
const SAIDA = process.argv[3] || "shot.png";

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e)));
  await page.goto(URL, { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: SAIDA, fullPage: false });
  console.log("screenshot salvo em", SAIDA);
  await browser.close();
})().catch((e) => {
  console.error("ERRO:", e);
  process.exit(1);
});