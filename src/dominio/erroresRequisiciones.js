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

class ErrorNumeroRequisicionDuplicado extends Error {
  constructor() {
    super("Ya existe una requisición con ese número");
  }
}

module.exports = {
  ErrorRequisicionNoEncontrada,
  ErrorProyectoNoExiste,
  ErrorRequisicionNoEditable,
  ErrorItemsVacios,
  ErrorNumeroRequisicionDuplicado,
};
