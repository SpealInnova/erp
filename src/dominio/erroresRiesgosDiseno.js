class ErrorRiesgoNoEncontrado extends Error {
  constructor() {
    super("Riesgo de diseño no encontrado");
  }
}

module.exports = { ErrorRiesgoNoEncontrado };
