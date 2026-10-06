class ErrorProveedorNoEncontrado extends Error {
  constructor() {
    super("Proveedor no encontrado");
  }
}

class ErrorNitDuplicado extends Error {
  constructor() {
    super("Ya existe un proveedor con ese NIT/CC");
  }
}

module.exports = { ErrorProveedorNoEncontrado, ErrorNitDuplicado };
