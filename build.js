"use strict";

// build.js — valida a integridade do front antes de publicar.
// (Sem bundler: JS puro compatível com Firefox 68.)
// Verifica: todos os assets referenciados existem + sintaxe JS válida.

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = __dirname;
const indexHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

let falhas = 0;

// 1. Assets referenciados existem (ignora URLs externas http/https).
const refs = [...indexHtml.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
for (const ref of refs) {
  if (/^https?:\/\//.test(ref)) continue; // recurso externo (fontes CDN, etc.)
  const caminho = path.join(ROOT, ref.replace(/^\//, ""));
  if (!fs.existsSync(caminho)) {
    console.error("FALTA arquivo:", ref);
    falhas++;
  }
}

// 2. Sintaxe de cada JS válida (via `node --check`).
const jss = fs.existsSync(path.join(ROOT, "js"))
  ? fs.readdirSync(path.join(ROOT, "js")).filter((f) => f.endsWith(".js")).map((f) => "js/" + f)
  : [];
for (const js of [...jss, "firebase-config.js", "serve.js", "build.js", "test-scheduler.js"]) {
  if (!fs.existsSync(path.join(ROOT, js))) continue;
  try {
    execSync(`node --check "${path.join(ROOT, js)}"`, { stdio: "pipe" });
  } catch (e) {
    console.error("ERRO de sintaxe em", js);
    console.error(e.stderr ? e.stderr.toString() : e.message);
    falhas++;
  }
}

if (falhas) {
  console.error(`\nBUILD FALHOU (${falhas} problema(s))`);
  process.exit(1);
} else {
  console.log("BUILD OK — front íntegro, pronto para publicar.");
}
