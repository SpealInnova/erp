class ErrorCotizacionNoEncontrada extends Error {
  constructor() {
    super("Cotización no encontrada");
  }
}

class ErrorClienteNoExiste extends Error {
  constructor() {
    super("El cliente indicado no existe");
  }
}

class ErrorAsesorNoExiste extends Error {
  constructor() {
    super("El asesor comercial indicado no existe o no está activo");
  }
}

class ErrorCotizacionNoEditable extends Error {
  constructor() {
    super("Solo se puede editar una cotización en estado borrador");
  }
}

class ErrorItemsVacios extends Error {
  constructor() {
    super("La cotización debe tener al menos un ítem");
  }
}

module.exports = {
  ErrorCotizacionNoEncontrada,
  ErrorClienteNoExiste,
  ErrorAsesorNoExiste,
  ErrorCotizacionNoEditable,
  ErrorItemsVacios,
};
