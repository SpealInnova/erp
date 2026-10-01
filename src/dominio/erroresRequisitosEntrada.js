class ErrorRequisitoNoEncontrado extends Error {
  constructor() {
    super("Requisito de entrada no encontrado");
  }
}

module.exports = { ErrorRequisitoNoEncontrado };
