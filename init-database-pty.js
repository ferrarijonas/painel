"use strict";

// init-database-pty.js — automatiza `firebase init database` num TTY real.
// Gatilhos robustos: responde Y, localização, e arquivo de rules.

const pty = require("node-pty");

const cmd = process.env.COMSPEC || "cmd.exe";
const args = ["/c", "firebase", "init", "database", "--project", "painel-padaria-pdv"];

const cwd = __dirname;
const p = pty.spawn(cmd, args, { name: "xterm-color", cols: 100, rows: 30, cwd, env: process.env });

let buf = "";
let responded = 0;

function send(what) {
  p.write(what);
}

p.onData((data) => {
  buf += data;
  process.stdout.write(data);

  // Responde "Are you ready to proceed?" com Enter (default Yes)
  if (responded === 0 && /ready to proceed/i.test(buf)) {
    responded = 1;
    setTimeout(() => send("\r"), 400);
    buf = "";
  }
  // Localização: dispara quando aparece "Database Setup" (vem depois do ready)
  else if (responded === 1 && /database setup/i.test(buf)) {
    responded = 2;
    // Aguarda o seletor de localização e escolhe us-central1 (1ª opção)
    setTimeout(() => send("\x1b[B\r"), 2500);
    buf = "";
  }
  // Arquivo de rules (pergunta seguinte)
  else if (responded === 2 && /rules/i.test(buf)) {
    responded = 3;
    setTimeout(() => send("\r"), 500);
    buf = "";
  }
  // Overwrite do firebase.json/rules existente
  else if (responded >= 3 && /overwrite|already exists/i.test(buf)) {
    responded = 4;
    setTimeout(() => send("\r"), 400);
    buf = "";
  }

  if (buf.length > 8000) buf = buf.slice(-4000);
});

p.onExit(({ exitCode }) => {
  console.log(`\n[exit code: ${exitCode}]`);
  process.exit(exitCode || 0);
});

setTimeout(() => {
  console.log("\n[TIMEOUT]");
  p.kill();
}, 120000);