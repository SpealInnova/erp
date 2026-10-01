class ErrorValidacionNoEncontrada extends Error {
  constructor() {
    super("Validación no encontrada");
  }
}

module.exports = { ErrorValidacionNoEncontrada };
