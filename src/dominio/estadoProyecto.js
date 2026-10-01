const ESTADOS = {
  PROSPECTO: "prospecto",
  COTIZADO: "cotizado",
  APROBADO: "aprobado",
  EN_EJECUCION: "en_ejecucion",
  CERRADO: "cerrado",
  CANCELADO: "cancelado",
};

const TRANSICIONES_PERMITIDAS = {
  [ESTADOS.PROSPECTO]: [ESTADOS.COTIZADO, ESTADOS.CANCELADO],
  [ESTADOS.COTIZADO]: [ESTADOS.APROBADO, ESTADOS.CANCELADO],
  [ESTADOS.APROBADO]: [ESTADOS.EN_EJECUCION, ESTADOS.CANCELADO],
  [ESTADOS.EN_EJECUCION]: [ESTADOS.CERRADO, ESTADOS.CANCELADO],
  [ESTADOS.CERRADO]: [],
  [ESTADOS.CANCELADO]: [],
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
    throw new Error(`Transición no permitida: ${estadoActual} -> ${estadoDestino}`);
  }
  return estadoDestino;
}

module.exports = { ESTADOS, puedeTransicionar, transicionar };
