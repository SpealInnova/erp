class ErrorTareaNoEncontrada extends Error {
  constructor() {
    super("Tarea no encontrada");
  }
}

module.exports = { ErrorTareaNoEncontrada };
