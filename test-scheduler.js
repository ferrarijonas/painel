"use strict";

const { calculaEncaixe, OCUP } = require("./js/scheduler.js");

// Regras de recursos da padaria (exemplos da Concept §9).
const recursos = {
  masseira: { tipo: OCUP.EXCLUSIVO },
  forno: { tipo: OCUP.CAPACIDADE, capacidade: 2 },
  fermentacao: { tipo: OCUP.PASSIVO },
  modelagem: { tipo: OCUP.PESSOA_ATIVA },
  livre: { tipo: OCUP.LIVRE },
};

function hora(min) {
  const h = Math.floor(min / 60) + 8;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function mostra(agenda) {
  return agenda.map((a) => `${a.nome} ${hora(a.inicio)}-${hora(a.fim)}`).join(" | ");
}

function assert(cond, msg) {
  if (!cond) {
    console.error("FALHOU:", msg);
    process.exitCode = 1;
  } else {
    console.log("ok:", msg);
  }
}

// Cenário 1: masseira exclusiva — 2 pães não sobrepõem na masseira.
{
  const tarefas = [
    { id: "p1", nome: "Pão 1 (masseira)", duracaoMin: 30, recursos: ["masseira"] },
    { id: "p2", nome: "Pão 2 (masseira)", duracaoMin: 30, recursos: ["masseira"] },
  ];
  const a = calculaEncaixe(tarefas, 1, recursos);
  console.log("C1:", mostra(a));
  assert(a[0].fim <= a[1].inicio, "masseira exclusiva não sobrepõe");
}

// Cenário 2: forno capacidade-2 — 2 pães assam em paralelo.
{
  const tarefas = [
    { id: "f1", nome: "Forno 1", duracaoMin: 40, recursos: ["forno"] },
    { id: "f2", nome: "Forno 2", duracaoMin: 40, recursos: ["forno"] },
  ];
  const a = calculaEncaixe(tarefas, 1, recursos);
  console.log("C2:", mostra(a));
  assert(a[0].inicio === a[1].inicio, "forno capacidade-2 permite paralelo");
}

// Cenário 3: fermentação passiva — roda em paralelo, não bloqueia.
{
  const tarefas = [
    { id: "f", nome: "Forno", duracaoMin: 40, recursos: ["forno"] },
    { id: "fer", nome: "Fermentação", duracaoMin: 60, recursos: ["fermentacao"] },
  ];
  const a = calculaEncaixe(tarefas, 1, recursos);
  console.log("C3:", mostra(a));
  assert(a[0].inicio === a[1].inicio, "passivo roda em paralelo livre");
}

// Cenário 4: pessoa-ativa — 1 pessoa não faz 2 modelagens ao mesmo tempo.
{
  const tarefas = [
    { id: "m1", nome: "Modelar 1", duracaoMin: 20, recursos: ["modelagem"] },
    { id: "m2", nome: "Modelar 2", duracaoMin: 20, recursos: ["modelagem"] },
  ];
  const a = calculaEncaixe(tarefas, 1, recursos);
  console.log("C4 (1 pessoa):", mostra(a));
  assert(a[0].fim <= a[1].inicio, "1 pessoa serializa modelagem");

  const b = calculaEncaixe(tarefas, 2, recursos);
  console.log("C4 (2 pessoas):", mostra(b));
  assert(b[0].inicio === b[1].inicio, "2 pessoas permitem modelagem em paralelo");
}

// Cenário 5: empurrão — re-encaixa dependentes (masseira exclusiva serializa).
{
  const tarefas = [
    { id: "p1", nome: "Pão 1", duracaoMin: 30, recursos: ["masseira"] },
    { id: "p2", nome: "Pão 2", duracaoMin: 30, recursos: ["masseira"] },
    { id: "p3", nome: "Pão 3", duracaoMin: 30, recursos: ["masseira"] },
  ];
  const a = calculaEncaixe(tarefas, 1, recursos);
  console.log("C5:", mostra(a));
  assert(a[0].fim <= a[1].inicio && a[1].fim <= a[2].inicio, "3 pães serializam na masseira");
}

// Cenário 6: SEM_HORARIO — tarefa que não cabe na janela.
{
  const tarefas = [{ id: "longo", nome: "Tarefa longa", duracaoMin: 700, recursos: ["livre"] }];
  let erro = null;
  try {
    calculaEncaixe(tarefas, 1, recursos);
  } catch (e) {
    erro = e.code;
  }
  assert(erro === "SEM_HORARIO", "tarefa que estoura a janela lança SEM_HORARIO");
}

// Cenário 7: dependência — cadeia do pão respeita a ordem massa→fermenta→modela→assa.
{
  const tarefas = [
    { id: "mas", nome: "Masseira", duracaoMin: 30, recursos: ["masseira"] },
    { id: "fer", nome: "Fermenta", duracaoMin: 90, recursos: ["fermentacao"], dependeDe: ["mas"] },
    { id: "mod", nome: "Modela", duracaoMin: 40, recursos: ["modelagem"], dependeDe: ["fer"] },
    { id: "assa", nome: "Assa", duracaoMin: 45, recursos: ["forno"], dependeDe: ["mod"] },
  ];
  const a = calculaEncaixe(tarefas, 1, recursos);
  console.log("C7:", mostra(a));
  const porId = {}; a.forEach((x) => (porId[x.id] = x));
  assert(porId.mas.fim <= porId.fer.inicio, "fermenta começa após masseira");
  assert(porId.fer.fim <= porId.mod.inicio, "modela começa após fermenta");
  assert(porId.mod.fim <= porId.assa.inicio, "assa começa após modela");
}

// Cenário 8: DEPENDENCIA_CICLICA.
{
  const tarefas = [
    { id: "a", nome: "A", duracaoMin: 10, recursos: ["livre"], dependeDe: ["b"] },
    { id: "b", nome: "B", duracaoMin: 10, recursos: ["livre"], dependeDe: ["a"] },
  ];
  let erro = null;
  try {
    calculaEncaixe(tarefas, 1, recursos);
  } catch (e) {
    erro = e.code;
  }
  assert(erro === "DEPENDENCIA_CICLICA", "ciclo de dependência lança DEPENDENCIA_CICLICA");
}

// Cenário 9: DEPENDENCIA_INVALIDA.
{
  const tarefas = [
    { id: "a", nome: "A", duracaoMin: 10, recursos: ["livre"], dependeDe: ["nao-existe"] },
  ];
  let erro = null;
  try {
    calculaEncaixe(tarefas, 1, recursos);
  } catch (e) {
    erro = e.code;
  }
  assert(erro === "DEPENDENCIA_INVALIDA", "dependência inexistente lança DEPENDENCIA_INVALIDA");
}

// Cenário 10: preservar posições — mover um processo do Pão 1 não
// re-embaralha o Pão 2 nem os processos acima dele.
{
  const tarefas = [
    { id: "p1-mas", nome: "Pão 1 mistura", duracaoMin: 60, recursos: ["masseira"] },
    { id: "p1-fer", nome: "Pão 1 fermenta", duracaoMin: 120, recursos: ["fermentacao"], dependeDe: ["p1-mas"] },
    { id: "p1-mod", nome: "Pão 1 modela", duracaoMin: 30, recursos: ["modelagem"], dependeDe: ["p1-fer"] },
    { id: "p2-mas", nome: "Pão 2 mistura", duracaoMin: 60, recursos: ["masseira"] },
  ];
  const a0 = calculaEncaixe(tarefas, 1, recursos);
  console.log("C10 base:", mostra(a0));

  // Fermenta do Pão 1 atrasa 60min → só ela e as de baixo (modela) mudam.
  const empurradas = tarefas.map((t) => (t.id === "p1-fer" ? Object.assign({}, t, { inicioMin: 120 }) : t));
  const a1 = calculaEncaixe(empurradas, 1, recursos, undefined, a0);
  console.log("C10 empurrado:", mostra(a1));
  const porId = {}; a1.forEach((x) => (porId[x.id] = x));
  assert(porId["p1-mas"].inicio === 0, "mistura do Pão 1 preserva 08:00");
  assert(porId["p1-fer"].inicio === 120, "fermenta do Pão 1 empurrada para 10:00");
  assert(porId["p1-mod"].inicio >= porId["p1-fer"].fim, "modela do Pão 1 segue a fermenta (cadeia)");
  assert(porId["p2-mas"].inicio === 60, "Pão 2 preserva 09:00 (não re-embaralha)");
}

console.log(process.exitCode ? "\nHOUVE FALHAS" : "\nTODOS OS TESTES PASSARAM");
