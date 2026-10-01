const { ErrorTransicionInvalida } = require("./erroresEstado");

const ESTADOS = {
  PENDIENTE: "pendiente",
  APROBADO: "aprobado",
  APROBADO_CON_RESTRICCIONES: "aprobado_con_restricciones",
  RECHAZADO: "rechazado",
};

const TRANSICIONES_PERMITIDAS = {
  [ESTADOS.PENDIENTE]: [
    ESTADOS.APROBADO,
    ESTADOS.APROBADO_CON_RESTRICCIONES,
    ESTADOS.RECHAZADO,
  ],
  [ESTADOS.APROBADO]: [],
  [ESTADOS.APROBADO_CON_RESTRICCIONES]: [],
  [ESTADOS.RECHAZADO]: [],
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
