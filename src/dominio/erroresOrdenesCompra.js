class ErrorOrdenCompraNoEncontrada extends Error {
  constructor() {
    super("Orden de compra no encontrada");
  }
}

class ErrorRequisicionNoExiste extends Error {
  constructor() {
    super("La requisición indicada no existe");
  }
}

class ErrorProveedorNoExiste extends Error {
  constructor() {
    super("El proveedor indicado no existe");
  }
}

class ErrorOrdenCompraNoEditable extends Error {
  constructor() {
    super("Solo se puede editar una orden de compra en estado pte_aprobar");
  }
}

class ErrorItemsVacios extends Error {
  constructor() {
    super("La orden de compra debe tener al menos un ítem");
  }
}

module.exports = {
  ErrorOrdenCompraNoEncontrada,
  ErrorRequisicionNoExiste,
  ErrorProveedorNoExiste,
  ErrorOrdenCompraNoEditable,
  ErrorItemsVacios,
};
