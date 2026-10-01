class ErrorCambioNoEncontrado extends Error {
  constructor() {
    super("Cambio de diseño no encontrado");
  }
}

module.exports = { ErrorCambioNoEncontrado };
