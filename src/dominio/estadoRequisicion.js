const { ErrorTransicionInvalida } = require("./erroresEstado");

const ESTADOS = {
  SOLICITADA: "solicitada",
  EN_COTIZACION: "en_cotizacion",
  CONVERTIDA_OC: "convertida_oc",
  CERRADA: "cerrada",
};

const TRANSICIONES_PERMITIDAS = {
  [ESTADOS.SOLICITADA]: [ESTADOS.EN_COTIZACION],
  [ESTADOS.EN_COTIZACION]: [ESTADOS.CONVERTIDA_OC],
  [ESTADOS.CONVERTIDA_OC]: [ESTADOS.CERRADA],
  [ESTADOS.CERRADA]: [],
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
