const { ErrorTransicionInvalida } = require("./erroresEstado");

const ESTADOS = {
  BORRADOR: "borrador",
  REVISION: "revision",
  APROBACION: "aprobacion",
  ENVIADA: "enviada",
  ACEPTADA: "aceptada",
  RECHAZADA: "rechazada",
};

const TRANSICIONES_PERMITIDAS = {
  [ESTADOS.BORRADOR]: [ESTADOS.REVISION],
  [ESTADOS.REVISION]: [ESTADOS.APROBACION, ESTADOS.BORRADOR],
  [ESTADOS.APROBACION]: [ESTADOS.ENVIADA, ESTADOS.BORRADOR],
  [ESTADOS.ENVIADA]: [ESTADOS.ACEPTADA, ESTADOS.RECHAZADA],
  [ESTADOS.ACEPTADA]: [],
  [ESTADOS.RECHAZADA]: [],
};

function puedeTransicionar(estadoActual, estadoDestino) {
  const permitidos = TRANSICIONES_PERMITIDAS[estadoActual];
  if (!permitidos) {
    throw new Error(`Estado actual desconocido: ${estadoActual}`);
  }
  return permitidos.includes(estadoDestino);
}

function transicionar(estadoActual, estadoDestino) {
  if (!puedeTransicionar(estadoActual, estadoDestino)) {
    throw new ErrorTransicionInvalida(estadoActual, estadoDestino);
  }
  return estadoDestino;
}

module.exports = { ESTADOS, puedeTransicionar, transicionar };
