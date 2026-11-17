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

class ErrorCotizacionInvalida extends Error {
  constructor() {
    super("La cotización indicada no existe, no está aceptada, o no corresponde al cliente del proyecto");
  }
}

class ErrorCodigoPryDuplicado extends Error {
  constructor() {
    super("Ya existe un proyecto con ese código");
  }
}

class ErrorPasswordInvalida extends Error {
  constructor() {
    super("Contraseña incorrecta");
  }
}

module.exports = {
  ErrorProyectoNoEncontrado,
  ErrorClienteInvalido,
  ErrorResponsableInvalido,
  ErrorCotizacionInvalida,
  ErrorCodigoPryDuplicado,
  ErrorPasswordInvalida,
};
