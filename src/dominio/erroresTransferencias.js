class ErrorTransferenciaNoEncontrada extends Error {
  constructor() {
    super("Transferencia no encontrada");
  }
}

module.exports = { ErrorTransferenciaNoEncontrada };
