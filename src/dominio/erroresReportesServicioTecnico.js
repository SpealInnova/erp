class ErrorReporteNoEncontrado extends Error {
  constructor() {
    super("Reporte de servicio técnico no encontrado");
  }
}

class ErrorEquipoNoExiste extends Error {
  constructor() {
    super(
      "No hay un equipo registrado con ese número de serie. Si es un equipo anterior al ERP, regístralo en Soporte técnico › Equipos"
    );
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

class ErrorTecnicoInvalido extends Error {
  constructor() {
    super("El técnico indicado no existe o está inactivo");
  }
}

module.exports = {
  ErrorReporteNoEncontrado,
  ErrorEquipoNoExiste,
  ErrorClienteNoExiste,
  ErrorProyectoNoExiste,
  ErrorTecnicoInvalido,
};
