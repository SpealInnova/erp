class ErrorClienteNoEncontrado extends Error {
  constructor() {
    super("Cliente no encontrado");
  }
}

class ErrorIdentificacionDuplicada extends Error {
  constructor() {
    super("Ya existe un cliente con ese número de identificación");
  }
}

module.exports = { ErrorClienteNoEncontrado, ErrorIdentificacionDuplicada };
