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

// Cenário 11: fimFixo — segurar o fim de uma etapa (Must Finish On);
// sucessores ficam ancorados no fim; predecessor ainda é respeitado.
{
  const tarefas = [
    { id: "mas", nome: "Mistura", duracaoMin: 30, recursos: ["masseira"] },
    { id: "fer", nome: "Fermenta", duracaoMin: 120, recursos: ["fermentacao"], dependeDe: ["mas"] },
    { id: "mod", nome: "Modela", duracaoMin: 30, recursos: ["modelagem"], dependeDe: ["fer"] },
  ];
  const a0 = calculaEncaixe(tarefas, 1, recursos);
  console.log("C11 base:", mostra(a0));

  // Fermenta dura 150min terminando em 180 (start = max(30, dep=30) = 30).
  const emp = tarefas.map((t) => (t.id === "fer" ? Object.assign({}, t, { fimFixo: 180, duracaoMin: 150 }) : t));
  const a1 = calculaEncaixe(emp, 1, recursos, undefined, a0);
  console.log("C11 fimFixo:", mostra(a1));
  const porId = {}; a1.forEach((x) => (porId[x.id] = x));
  assert(porId.fer.fim === 180, "fermenta segura o fim em 180");
  assert(porId.mod.inicio >= porId.fer.fim, "modela segue a fermenta (fim fixo)");
  assert(porId.mas.fim <= porId.fer.inicio, "mistura continua antes da fermenta");
}

// Cenário 12: quem você pega é quem move — mover Pão 2 (2º na ordem de
// inserção) para um alvo ocupado pelo Pão 1 empurra o Pão 1; Pão 2 encaixa
// no alvo em vez de ser barrado (regra 12 da ZenSpec).
{
  const tarefas = [
    { id: "aquecer-forno", nome: "Aquecer forno", duracaoMin: 15, inicioMin: 120, recursos: ["forno"] },
    { id: "p1-mas", nome: "Pão 1 mistura", duracaoMin: 60, inicioMin: 135, recursos: ["masseira"] },
    { id: "p1-fer", nome: "Pão 1 fermenta", duracaoMin: 60, recursos: ["fermentacao"], dependeDe: ["p1-mas"] },
    { id: "p1-mod", nome: "Pão 1 modela", duracaoMin: 15, recursos: ["modelagem"], dependeDe: ["p1-fer"] },
    { id: "p1-for", nome: "Pão 1 forno", duracaoMin: 45, recursos: ["forno"], dependeDe: ["p1-mod", "aquecer-forno"] },
    { id: "p2-mas", nome: "Pão 2 mistura", duracaoMin: 60, inicioMin: 75, recursos: ["masseira"] },
    { id: "p2-fer", nome: "Pão 2 fermenta", duracaoMin: 60, inicioMin: 135, recursos: ["fermentacao"], dependeDe: ["p2-mas"] },
    { id: "p2-mod", nome: "Pão 2 modela", duracaoMin: 15, recursos: ["modelagem"], dependeDe: ["p2-fer"] },
    { id: "p2-for", nome: "Pão 2 forno", duracaoMin: 45, recursos: ["forno"], dependeDe: ["p2-mod", "aquecer-forno"] },
  ];
  const a0 = calculaEncaixe(tarefas, 1, recursos);
  console.log("C12 base:", mostra(a0));
  const antes = {}; a0.forEach((x) => (antes[x.id] = x.inicio));

  // Pão 2 mistura arrastado para 11:00 (180) — ocupava o Pão 1 (10:15-11:15).
  const emp = tarefas.map((t) => (t.id === "p2-mas" ? Object.assign({}, t, { inicioMin: 180 }) : t));
  const a1 = calculaEncaixe(emp, 1, recursos, undefined, a0, "p2-mas");
  console.log("C12 empurrado:", mostra(a1));
  const porId = {}; a1.forEach((x) => (porId[x.id] = x));
  assert(porId["p2-mas"].inicio === 180, "Pão 2 encaixa no alvo (11:00) — não é barrado");
  assert(porId["p1-mas"].inicio > antes["p1-mas"], "Pão 1 (na frente) é empurrado para depois do Pão 2");
  assert(porId["p1-mas"].inicio >= porId["p2-mas"].fim, "Pão 1 não sobrepõe o Pão 2 na masseira");
}

// Cenário 13: cadeia acompanha sem folga ao trazer para antes — mover a
// mistura do Pão 1 para 08:30 puxa fermenta/modela/forno junto (sem folga),
// e o Pão 2 (na frente) é empurrado (regra 13).
{
  const tarefas = [
    { id: "aquecer-forno", nome: "Aquecer forno", duracaoMin: 15, inicioMin: 120, recursos: ["forno"] },
    { id: "p1-mas", nome: "Pão 1 mistura", duracaoMin: 60, inicioMin: 135, recursos: ["masseira"] },
    { id: "p1-fer", nome: "Pão 1 fermenta", duracaoMin: 60, recursos: ["fermentacao"], dependeDe: ["p1-mas"] },
    { id: "p1-mod", nome: "Pão 1 modela", duracaoMin: 15, recursos: ["modelagem"], dependeDe: ["p1-fer"] },
    { id: "p1-for", nome: "Pão 1 forno", duracaoMin: 45, recursos: ["forno"], dependeDe: ["p1-mod", "aquecer-forno"] },
    { id: "p2-mas", nome: "Pão 2 mistura", duracaoMin: 60, inicioMin: 75, recursos: ["masseira"] },
    { id: "p2-fer", nome: "Pão 2 fermenta", duracaoMin: 60, inicioMin: 135, recursos: ["fermentacao"], dependeDe: ["p2-mas"] },
    { id: "p2-mod", nome: "Pão 2 modela", duracaoMin: 15, recursos: ["modelagem"], dependeDe: ["p2-fer"] },
    { id: "p2-for", nome: "Pão 2 forno", duracaoMin: 45, recursos: ["forno"], dependeDe: ["p2-mod", "aquecer-forno"] },
  ];
  const a0 = calculaEncaixe(tarefas, 1, recursos);

  const emp = tarefas.map((t) => (t.id === "p1-mas" ? Object.assign({}, t, { inicioMin: 30 }) : t));
  const a1 = calculaEncaixe(emp, 1, recursos, undefined, a0, "p1-mas");
  console.log("C13 trazido para 08:30:", mostra(a1));
  const porId = {}; a1.forEach((x) => (porId[x.id] = x));
  assert(porId["p1-mas"].inicio === 30, "mistura do Pão 1 encaixa em 08:30");
  assert(porId["p1-fer"].inicio === porId["p1-mas"].fim, "fermenta segue a mistura sem folga");
  assert(porId["p1-mod"].inicio === porId["p1-fer"].fim, "modela segue a fermenta sem folga");
  assert(porId["p2-mas"].inicio > 75, "Pão 2 (na frente) é empurrado ao trazer o Pão 1 para antes");
}

// Cenário 14: dependente com âncora antiga (inicioMin) segue a cadeia quando
// o foco é trazido para antes — sem folga, ignorando a âncora velha.
{
  const tarefas = [
    { id: "aquecer-forno", nome: "Aquecer forno", duracaoMin: 15, inicioMin: 120, recursos: ["forno"] },
    { id: "p1-mas", nome: "Pão 1 mistura", duracaoMin: 60, inicioMin: 135, recursos: ["masseira"] },
    { id: "p1-fer", nome: "Pão 1 fermenta", duracaoMin: 60, recursos: ["fermentacao"], dependeDe: ["p1-mas"] },
    { id: "p2-mas", nome: "Pão 2 mistura", duracaoMin: 60, inicioMin: 75, recursos: ["masseira"] },
    { id: "p2-fer", nome: "Pão 2 fermenta", duracaoMin: 60, inicioMin: 135, recursos: ["fermentacao"], dependeDe: ["p2-mas"] },
  ];
  const a0 = calculaEncaixe(tarefas, 1, recursos);

  // Pão 2 mistura para 08:30; a fermenta do Pão 2 tem inicioMin=135 (âncora
  // antiga) — deve seguir a mistura em 09:30, sem a folga que a âncora criaria.
  const emp = tarefas.map((t) => (t.id === "p2-mas" ? Object.assign({}, t, { inicioMin: 30 }) : t));
  const a1 = calculaEncaixe(emp, 1, recursos, undefined, a0, "p2-mas");
  console.log("C14:", mostra(a1));
  const porId = {}; a1.forEach((x) => (porId[x.id] = x));
  assert(porId["p2-mas"].inicio === 30, "mistura do Pão 2 encaixa em 08:30");
  assert(porId["p2-fer"].inicio === porId["p2-mas"].fim, "fermenta do Pão 2 segue sem folga (ignora âncora antiga)");
}

console.log(process.exitCode ? "\nHOUVE FALHAS" : "\nTODOS OS TESTES PASSARAM");
