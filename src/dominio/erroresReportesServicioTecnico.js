class ErrorReporteNoEncontrado extends Error {
  constructor() {
    super("Reporte de servicio técnico no encontrado");
  }
}

class ErrorEquipoNoExiste extends Error {
  constructor() {
    super("No existe un expediente de diseño con ese número de serie");
  }
}

class ErrorClienteNoExiste extends Error {
  constructor() {
    super("El cliente indicado no existe");
  }
}

class ErrorProyectoNoExiste extends Error {
  constructor() {
    super("El proyecto indicado no existe");
  }
}

module.exports = {
  ErrorReporteNoEncontrado,
  ErrorEquipoNoExiste,
  ErrorClienteNoExiste,
  ErrorProyectoNoExiste,
};
