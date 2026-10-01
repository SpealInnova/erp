class ErrorActaNoEncontrada extends Error {
  constructor() {
    super("Acta de cierre a satisfacción no encontrada");
  }
}

class ErrorProyectoNoExiste extends Error {
  constructor() {
    super("El proyecto indicado no existe");
  }
}

class ErrorClienteNoExiste extends Error {
  constructor() {
    super("El cliente indicado no existe");
  }
}

class ErrorItemsVacios extends Error {
  constructor() {
    super("El acta debe tener al menos un ítem verificado");
  }
}

module.exports = { ErrorActaNoEncontrada, ErrorProyectoNoExiste, ErrorClienteNoExiste, ErrorItemsVacios };
