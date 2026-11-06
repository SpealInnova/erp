class ErrorActividadNoEncontrada extends Error {
  constructor() {
    super("Actividad de proyecto no encontrada");
  }
}

module.exports = { ErrorActividadNoEncontrada };
