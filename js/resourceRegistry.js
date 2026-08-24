(function (global) {
  "use strict";

  // resourceRegistry — conhece os recursos e seus tipos de ocupação (Eng §3).
  // Exemplos da padaria (Concept §9); refine com as tarefas reais depois.
  const RECURSOS_PADRAO = {
    masseira: { tipo: "exclusivo" },
    forno: { tipo: "capacidade-N", capacidade: 2 },
    fermentacao: { tipo: "passivo" },
    modelagem: { tipo: "pessoa-ativa" },
    livre: { tipo: "livre" },
  };

  // devolveRegra — regra de ocupação de um recurso, ou null se não existe.
  function devolveRegra(recursos, recursoId) {
    return recursos[recursoId] || null;
  }

  // registra — adiciona ou atualiza uma regra de recurso (config).
  function registra(recursos, recursoId, regra) {
    if (!recursos[recursoId]) recursos[recursoId] = {};
    recursos[recursoId] = regra;
    return recursos;
  }

  const api = { RECURSOS_PADRAO, devolveRegra, registra };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.resourceRegistry = api;
})(typeof window !== "undefined" ? window : this);