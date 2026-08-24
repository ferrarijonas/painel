(function (global) {
  "use strict";

  // deviceSync — sincroniza os dias compartilhados entre clientes (Eng §3).
  // Estrutura no Firebase RTDB: painel/dias/{YYYY-MM-DD} → dia.
  // Sem credenciais reais (dev) → store em memória como fallback.

  let firebaseRef = null;
  let diasLocais = {};
  let listeners = [];
  let pronto = false;
  let callbacksProntos = [];

  // inicializar — configura o Firebase se houver credenciais reais.
  function inicializar() {
    const cfg = typeof global.FIREBASE_CONFIG !== "undefined" ? global.FIREBASE_CONFIG : null;
    if (cfg && cfg.databaseURL && cfg.databaseURL.indexOf("SUA") === -1) {
      if (typeof global.firebase !== "undefined" && global.firebase.database) {
        global.firebase.initializeApp(cfg);
        firebaseRef = global.firebase.database().ref("painel/dias");
        firebaseRef.on("value", (snap) => {
          const val = snap.val();
          if (val) {
            diasLocais = val;
            emitir(diasLocais);
          }
          if (!pronto) {
            pronto = true;
            for (const cb of callbacksProntos) cb();
            callbacksProntos = [];
          }
        });
        return;
      }
    }
    // Sem Firebase configurado → memória local (fallback de desenvolvimento).
    pronto = true;
    for (const cb of callbacksProntos) cb();
    callbacksProntos = [];
  }

  // quandoPronto — executa callback quando o primeiro snapshot chegar
  // (ou imediatamente se sem Firebase).
  function quandoPronto(cb) {
    if (pronto) cb();
    else callbacksProntos.push(cb);
  }

  // salvarDia — grava um dia (por data) no estado compartilhado e notifica.
  function salvarDia(dia) {
    diasLocais[dia.data] = dia;
    if (firebaseRef) {
      firebaseRef.child(dia.data).set(dia).catch(() => {});
    }
    emitir(diasLocais);
    return dia;
  }

  // obterDias — mapa atual de dias conhecidos.
  function obterDias() {
    return diasLocais;
  }

  // assinarEstado — registra callback de mudanças em tempo real.
  function assinarEstado(cb) {
    listeners.push(cb);
    return () => {
      listeners = listeners.filter((l) => l !== cb);
    };
  }

  function emitir(dias) {
    for (const l of listeners) l(dias);
  }

  const api = { inicializar, salvarDia, obterDias, assinarEstado, quandoPronto };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.deviceSync = api;
})(typeof window !== "undefined" ? window : this);