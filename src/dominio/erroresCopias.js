class ErrorCopiaEnCurso extends Error {
  constructor() {
    super("Ya hay una copia de seguridad en curso. Espera a que termine.");
  }
}

module.exports = { ErrorCopiaEnCurso };
