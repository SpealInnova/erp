class ErrorProyectoNoEncontrado extends Error {
  constructor() {
    super("Proyecto no encontrado");
  }
}

class ErrorClienteInvalido extends Error {
  constructor() {
    super("El cliente indicado no existe");
  }
}

class ErrorResponsableInvalido extends Error {
  constructor() {
    super("El responsable indicado no existe o no está activo");
  }
}

module.exports = { ErrorProyectoNoEncontrado, ErrorClienteInvalido, ErrorResponsableInvalido };
