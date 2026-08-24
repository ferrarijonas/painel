(function (global) {
  "use strict";

  // dayStore — persiste e recupera dias por data (histórico) (Eng §3).
  // Usa deviceSync como meio de persistência; mantém índice por data.

  let dias = {}; // { "YYYY-MM-DD": dia }

  function chave(data) {
    return data; // formato "YYYY-MM-DD"
  }

  // carregar — recupera um dia por data; cria vazio se não existir (edge case).
  function carregar(data) {
    const k = chave(data);
    if (dias[k]) return dias[k];
    const novo = { data, tarefas: [], criadoEm: Date.now() };
    dias[k] = novo;
    return novo;
  }

  // salvar — grava um dia, atualiza índice local e sincroniza.
  function salvar(dia) {
    dias[chave(dia.data)] = dia;
    if (global.deviceSync && global.deviceSync.salvarDia) {
      global.deviceSync.salvarDia(dia);
    }
    return dia;
  }

  // listarDatas — datas disponíveis no histórico (ordenadas, decrescente).
  function listarDatas() {
    return Object.keys(dias).sort().reverse();
  }

  const api = { carregar, salvar, listarDatas };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.dayStore = api;
})(typeof window !== "undefined" ? window : this);