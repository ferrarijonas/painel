"use strict";

// versao.js — grava o hash do commit atual em versao.json.
// Roda DEPOIS do commit de código, ANTES do push (sinal de deploy).

const { execSync } = require("child_process");
const fs = require("fs");

const hash = execSync("git rev-parse --short HEAD").toString().trim();
const dados = { versao: hash, atualizadoEm: new Date().toISOString() };
fs.writeFileSync("versao.json", JSON.stringify(dados, null, 2) + "\n");
console.log("versao.json ->", hash);