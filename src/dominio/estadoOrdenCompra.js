const { ErrorTransicionInvalida } = require("./erroresEstado");

const ESTADOS = {
  PTE_APROBAR: "pte_aprobar",
  APROBADA_PTE_PAGO: "aprobada_pte_pago",
  PAGA: "paga",
  CONTABILIZADA: "contabilizada",
};

const TRANSICIONES_PERMITIDAS = {
  [ESTADOS.PTE_APROBAR]: [ESTADOS.APROBADA_PTE_PAGO],
  [ESTADOS.APROBADA_PTE_PAGO]: [ESTADOS.PAGA],
  [ESTADOS.PAGA]: [ESTADOS.CONTABILIZADA],
  [ESTADOS.CONTABILIZADA]: [],
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
