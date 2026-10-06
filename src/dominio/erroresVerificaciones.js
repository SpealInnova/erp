class ErrorVerificacionNoEncontrada extends Error {
  constructor() {
    super("Verificación no encontrada");
  }
}

module.exports = { ErrorVerificacionNoEncontrada };
