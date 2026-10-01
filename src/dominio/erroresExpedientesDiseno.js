class ErrorExpedienteNoEncontrado extends Error {
  constructor() {
    super("Expediente de diseño no encontrado");
  }
}

class ErrorProyectoNoExiste extends Error {
  constructor() {
    super("El proyecto indicado no existe");
  }
}

class ErrorResponsableNoExiste extends Error {
  constructor() {
    super("El responsable de diseño indicado no existe o no está activo");
  }
}

class ErrorExpedienteNoEditable extends Error {
  constructor() {
    super("Solo se puede editar un expediente en estado pendiente");
  }
}

class ErrorNumeroSerieDuplicado extends Error {
  constructor() {
    super("Ya existe un expediente con ese número de serie");
  }
}

module.exports = {
  ErrorExpedienteNoEncontrado,
  ErrorProyectoNoExiste,
  ErrorResponsableNoExiste,
  ErrorExpedienteNoEditable,
  ErrorNumeroSerieDuplicado,
};
