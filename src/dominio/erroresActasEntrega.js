class ErrorActaEntregaNoEncontrada extends Error {
  constructor() {
    super("Acta de entrega de equipos no encontrada");
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
    super("El acta debe tener al menos un equipo entregado");
  }
}

module.exports = {
  ErrorActaEntregaNoEncontrada,
  ErrorProyectoNoExiste,
  ErrorClienteNoExiste,
  ErrorItemsVacios,
};
