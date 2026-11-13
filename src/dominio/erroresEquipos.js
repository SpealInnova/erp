class ErrorEquipoNoEncontrado extends Error {
  constructor() {
    super("Equipo no encontrado");
  }
}

class ErrorNumeroSerieEnUso extends Error {
  constructor(numeroSerie) {
    super(`El número de serie ${numeroSerie} ya está registrado en otro equipo`);
  }
}

class ErrorEquipoDeExpediente extends Error {
  constructor() {
    super("Este equipo sale de un expediente de diseño: sus datos se corrigen desde el expediente");
  }
}

class ErrorEquipoConReportes extends Error {
  constructor(numeroSerie) {
    super(
      `El equipo ${numeroSerie} ya tiene reportes de servicio: su número de serie no se puede cambiar ni quitar`
    );
  }
}

module.exports = {
  ErrorEquipoNoEncontrado,
  ErrorNumeroSerieEnUso,
  ErrorEquipoDeExpediente,
  ErrorEquipoConReportes,
};
