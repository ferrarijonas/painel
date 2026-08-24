(function (global) {
  "use strict";

  // dayStore — persiste e recupera dias por data (histórico) (Eng §3).
  // Usa deviceSync como fonte de verdade compartilhada; mantém espelho local.

  let dias = {}; // { "YYYY-MM-DD": dia }

  // sincronizar — adota o mapa de dias recebido do deviceSync.
  function sincronizar(diasNovos) {
    if (!diasNovos) return;
    dias = diasNovos;
  }

  // carregar — recupera um dia por data; cria vazio se não existir (edge case).
  function carregar(data) {
    if (dias[data]) return dias[data];
    const novo = { data, tarefas: [], criadoEm: Date.now() };
    dias[data] = novo;
    return novo;
  }

  // salvar — grava um dia e sincroniza via deviceSync.
  function salvar(dia) {
    dias[dia.data] = dia;
    if (global.deviceSync && global.deviceSync.salvarDia) {
      global.deviceSync.salvarDia(dia);
    }
    return dia;
  }

  // listarDatas — datas disponíveis no histórico (ordenadas, decrescente).
  function listarDatas() {
    return Object.keys(dias).sort().reverse();
  }

  const api = { sincronizar, carregar, salvar, listarDatas };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.dayStore = api;
})(typeof window !== "undefined" ? window : this);