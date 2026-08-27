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
  let modoLocal = false;

  // Espelho local (localStorage) — backup offline. O dia nunca se perde ao
  // desligar a máquina: sem rede, o painel volta do último estado conhecido
  // em vez de zerar. O snapshot real do Firebase SEMPRE vence o espelho.
  const CHAVE_LOCAL = "painel.dias.v1";
  function lerEspelho() {
    try {
      const raw = global.localStorage && global.localStorage.getItem(CHAVE_LOCAL);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }
  function gravarEspelho() {
    try {
      if (global.localStorage) global.localStorage.setItem(CHAVE_LOCAL, JSON.stringify(diasLocais));
    } catch (e) { /* quota/privado — sem backup, segue só em memória */ }
  }

  // inicializar — configura o Firebase se houver credenciais reais.
  function inicializar() {
    // Hidrata do espelho local ANTES de qualquer rede: se o boot ficar no
    // modo local (8s), o dia da última sessão já está em mãos.
    diasLocais = lerEspelho();

    const cfg = typeof global.FIREBASE_CONFIG !== "undefined" ? global.FIREBASE_CONFIG : null;
    if (cfg && cfg.databaseURL && cfg.databaseURL.indexOf("SUA") === -1) {
      if (typeof global.firebase !== "undefined" && global.firebase.database) {
        global.firebase.initializeApp(cfg);
        firebaseRef = global.firebase.database().ref("painel/dias");
        firebaseRef.on("value", (snap) => {
          const val = snap.val();
          if (val) {
            // Snapshot real é a fonte da verdade: vence o espelho local.
            diasLocais = val;
            gravarEspelho();
            emitir(diasLocais);
          }
          modoLocal = false;
          if (!pronto) {
            pronto = true;
            for (const cb of callbacksProntos) cb();
            callbacksProntos = [];
          }
        });
        // Fallback de boot: sem snapshot em 8s (offline, bloqueado ou lento),
        // segue em modo local para não ficar "carregando…" para sempre.
        setTimeout(() => {
          if (!pronto) {
            modoLocal = true;
            pronto = true;
            for (const cb of callbacksProntos) cb();
            callbacksProntos = [];
          }
        }, 8000);
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
    gravarEspelho(); // backup offline: sobrevive a desligar a máquina sem rede
    if (firebaseRef) {
      firebaseRef.child(dia.data).set(dia).catch((err) => {
        console.error("painel: falha ao gravar dia", dia.data, err && err.message);
      });
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

  // emModoLocal — true enquanto o primeiro snapshot não chega
  // (sem rede, bloqueado ou lento) e o app segue com dados locais.
  function emModoLocal() {
    return modoLocal;
  }

  const api = { inicializar, salvarDia, obterDias, assinarEstado, quandoPronto, emModoLocal };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.deviceSync = api;
})(typeof window !== "undefined" ? window : this);