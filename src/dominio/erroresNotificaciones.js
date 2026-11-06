class ErrorNotificacionNoEncontrada extends Error {
  constructor() {
    super("Notificación no encontrada");
  }
}

module.exports = { ErrorNotificacionNoEncontrada };
