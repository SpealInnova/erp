class ErrorRequisicionNoEncontrada extends Error {
  constructor() {
    super("Requisición no encontrada");
  }
}

class ErrorProyectoNoExiste extends Error {
  constructor() {
    super("El proyecto indicado no existe");
  }
}

class ErrorRequisicionNoEditable extends Error {
  constructor() {
    super("Solo se puede editar una requisición en estado solicitada");
  }
}

class ErrorItemsVacios extends Error {
  constructor() {
    super("La requisición debe tener al menos un ítem");
  }
}

module.exports = {
  ErrorRequisicionNoEncontrada,
  ErrorProyectoNoExiste,
  ErrorRequisicionNoEditable,
  ErrorItemsVacios,
};
