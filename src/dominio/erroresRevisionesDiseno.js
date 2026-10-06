class ErrorRevisionNoEncontrada extends Error {
  constructor() {
    super("Revisión de diseño no encontrada");
  }
}

module.exports = { ErrorRevisionNoEncontrada };
