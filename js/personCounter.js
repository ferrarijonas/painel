(function (global) {
  "use strict";

  // personCounter — informa quantas pessoas estão presentes (1..4) (Eng §3).
  const MIN = 1;
  const MAX = 4;
  let atual = 1;

  // definir — atualiza o nº de pessoas; valida 1..4.
  function definir(n) {
    if (!Number.isInteger(n) || n < MIN || n > MAX) throw new Error("PESSOAS_INVALIDA");
    atual = n;
    return atual;
  }

  function obter() {
    return atual;
  }

  const api = { definir, obter, MIN, MAX };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.personCounter = api;
})(typeof window !== "undefined" ? window : this);