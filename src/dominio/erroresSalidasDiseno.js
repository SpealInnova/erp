class ErrorSalidaNoEncontrada extends Error {
  constructor() {
    super("Salida de diseño no encontrada");
  }
}

module.exports = { ErrorSalidaNoEncontrada };
