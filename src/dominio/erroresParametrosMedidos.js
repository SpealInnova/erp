class ErrorParametroNoEncontrado extends Error {
  constructor() {
    super("Parámetro medido no encontrado");
  }
}

module.exports = { ErrorParametroNoEncontrado };
