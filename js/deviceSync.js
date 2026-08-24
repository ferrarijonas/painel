(function (global) {
  "use strict";

  // deviceSync — sincroniza o estado compartilhado entre clientes (Eng §3).
  // Encapsula o Firebase Realtime Database. Se não houver credenciais reais
  // (em desenvolvimento), usa um store em memória como fallback.

  let firebaseRef = null;
  let local = {};
  let listeners = [];

  // inicializar — configura o Firebase se houver credenciais reais.
  function inicializar() {
    const cfg = typeof global.FIREBASE_CONFIG !== "undefined" ? global.FIREBASE_CONFIG : null;
    if (cfg && cfg.databaseURL && cfg.databaseURL.indexOf("SUA") === -1) {
      // Firebase SDK (versão compatível com Firefox 68) — carregado via <script>.
      if (typeof global.firebase !== "undefined" && global.firebase.database) {
        global.firebase.initializeApp(cfg);
        firebaseRef = global.firebase.database().ref("painel/dia");
        firebaseRef.on("value", (snap) => {
          const val = snap.val();
          if (val) emitir(JSON.parse(val));
        });
      }
    }
    // Sem Firebase configurado → usa memória local (fallback de desenvolvimento).
  }

  // salvarDia — grava o dia no estado compartilhado e notifica clientes.
  function salvarDia(dia) {
    const payload = JSON.stringify(dia);
    local = dia;
    if (firebaseRef) {
      firebaseRef.set(payload).catch(() => {});
    }
    emitir(dia);
    return dia;
  }

  // assinarEstado — registra callback de mudanças em tempo real.
  function assinarEstado(cb) {
    listeners.push(cb);
    return () => {
      listeners = listeners.filter((l) => l !== cb);
    };
  }

  function emitir(dia) {
    for (const l of listeners) l(dia);
  }

  const api = { inicializar, salvarDia, assinarEstado, obterLocal: () => local };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.deviceSync = api;
})(typeof window !== "undefined" ? window : this);