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

class ErrorUsuarioNoEncontrado extends Error {
  constructor() {
    super("Usuario no encontrado");
  }
}

module.exports = { ErrorCorreoDuplicado, ErrorCedulaDuplicada, ErrorUsuarioNoEncontrado };
