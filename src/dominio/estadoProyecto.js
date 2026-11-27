const { ErrorTransicionInvalida } = require("./erroresEstado");

const ESTADOS = {
  PROSPECTO: "prospecto",
  PLANEACION: "planeacion",
  DISENO: "diseno",
  COMPRAS: "compras",
  PRODUCCION: "produccion",
  CALIDAD_FAT: "calidad_fat",
  LOGISTICA: "logistica",
  INSTALACION: "instalacion",
  SAT: "sat",
  SEGUIMIENTO: "seguimiento",
  CERRADO: "cerrado",
  CANCELADO: "cancelado",
};

const TRANSICIONES_PERMITIDAS = {
  [ESTADOS.PROSPECTO]: [ESTADOS.PLANEACION, ESTADOS.CANCELADO],
  [ESTADOS.PLANEACION]: [ESTADOS.DISENO, ESTADOS.CANCELADO],
  [ESTADOS.DISENO]: [ESTADOS.COMPRAS, ESTADOS.CANCELADO],
  [ESTADOS.COMPRAS]: [ESTADOS.PRODUCCION, ESTADOS.CANCELADO],
  [ESTADOS.PRODUCCION]: [ESTADOS.CALIDAD_FAT, ESTADOS.CANCELADO],
  [ESTADOS.CALIDAD_FAT]: [ESTADOS.LOGISTICA, ESTADOS.CANCELADO],
  [ESTADOS.LOGISTICA]: [ESTADOS.INSTALACION, ESTADOS.CANCELADO],
  [ESTADOS.INSTALACION]: [ESTADOS.SAT, ESTADOS.CANCELADO],
  [ESTADOS.SAT]: [ESTADOS.SEGUIMIENTO, ESTADOS.CANCELADO],
  [ESTADOS.SEGUIMIENTO]: [ESTADOS.CERRADO, ESTADOS.CANCELADO],
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
    throw new ErrorTransicionInvalida(estadoActual, estadoDestino);
  }
  return estadoDestino;
}

// Nombre de cada fase para mensajes y avisos (el mismo de la interfaz).
const TEXTO_ESTADO = {
  [ESTADOS.PROSPECTO]: "Prospecto",
  [ESTADOS.PLANEACION]: "Planeación",
  [ESTADOS.DISENO]: "Diseño",
  [ESTADOS.COMPRAS]: "Compras",
  [ESTADOS.PRODUCCION]: "Producción",
  [ESTADOS.CALIDAD_FAT]: "Calidad / FAT",
  [ESTADOS.LOGISTICA]: "Logística",
  [ESTADOS.INSTALACION]: "Instalación",
  [ESTADOS.SAT]: "SAT",
  [ESTADOS.SEGUIMIENTO]: "Seguimiento",
  [ESTADOS.CERRADO]: "Cerrado",
  [ESTADOS.CANCELADO]: "Cancelado",
};

module.exports = { ESTADOS, TEXTO_ESTADO, puedeTransicionar, transicionar, ErrorTransicionInvalida };
