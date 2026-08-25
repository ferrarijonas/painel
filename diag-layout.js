"use strict";

// diag-layout.js — inspeciona o layout real: retângulos, colisões e overflow.
// Uso: node diag-layout.js <url>

const puppeteer = require("puppeteer-core");
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const URL = process.argv[2] || "http://localhost:8125/";

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
  await new Promise((r) => setTimeout(r, 1200));

  const info = await page.evaluate(() => {
    const rect = (el) => {
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    };
    const vw = window.innerWidth, vh = window.innerHeight;
    const head = document.querySelector(".barra");
    const foot = document.querySelector(".rodape");
    const tl = document.getElementById("timeline");
    const out = {
      viewport: vw + "x" + vh,
      header: head ? rect(head) : null,
      footer: foot ? rect(foot) : null,
      timeline: tl ? rect(tl) : null,
      barras: [],
      rotulos: [],
      colisoesBarraRotulo: [],
      colisoesRotuloRotulo: [],
      foraDaTimeline: [],
    };

    const baras = Array.from(document.querySelectorAll(".barra"));
    const rots = Array.from(document.querySelectorAll(".rotulo-barra"));
    const pistas = Array.from(document.querySelectorAll(".rotulo-pista"));

    baras.forEach((b) => out.barras.push({ texto: (b.nextElementSibling && b.nextElementSibling.textContent) || b.dataset.id, rect: rect(b) }));
    rots.forEach((r) => out.rotulos.push({ texto: r.textContent, rect: rect(r) }));

    const sobrepoe = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    const area = (a, b) => {
      const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
      const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
      return x * y;
    };

    for (const b of baras) {
      for (const r of rots) {
        if (sobrepoe(rect(b), rect(r))) {
          out.colisoesBarraRotulo.push(b.dataset.id + " x " + r.textContent + " (area " + Math.round(area(rect(b), rect(r))) + ")");
        }
      }
    }
    for (let i = 0; i < rots.length; i++) {
      for (let j = i + 1; j < rots.length; j++) {
        if (sobrepoe(rect(rots[i]), rect(rots[j]))) {
          out.colisoesRotuloRotulo.push(rots[i].textContent + " x " + rots[j].textContent);
        }
      }
    }

    const lim = tl ? tl.getBoundingClientRect() : null;
    for (const b of baras) {
      const r = b.getBoundingClientRect();
      if (lim && (r.top < lim.top - 1 || r.bottom > lim.bottom + 1 || r.left < lim.left - 1 || r.right > lim.right + 1)) {
        out.foraDaTimeline.push("barra " + b.dataset.id + " fora: " + JSON.stringify(rect(b)));
      }
    }
    for (const r of rots) {
      const rr = r.getBoundingClientRect();
      if (lim && (rr.top < lim.top - 1 || rr.bottom > lim.bottom + 1)) {
        out.foraDaTimeline.push("rotulo " + r.textContent + " fora: " + JSON.stringify(rect(r)));
      }
    }
    out.pistas = pistas.map((p) => ({ texto: p.textContent, rect: rect(p) }));
    return out;
  });

  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})().catch((e) => {
  console.error("ERRO:", e);
  process.exit(1);
});