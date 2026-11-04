class ErrorCorreoDuplicado extends Error {
  constructor() {
    super("Ya existe un usuario con ese correo");
  }
}

class ErrorCedulaDuplicada extends Error {
  constructor() {
    super("Ya existe un usuario con esa cédula");
  }
}

module.exports = { ErrorCorreoDuplicado, ErrorCedulaDuplicada };
