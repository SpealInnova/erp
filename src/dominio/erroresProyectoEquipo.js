class ErrorMiembroYaEnEquipo extends Error {
  constructor() {
    super("El usuario ya forma parte del equipo del proyecto");
  }
}

class ErrorMiembroNoEncontrado extends Error {
  constructor() {
    super("Miembro de equipo no encontrado");
  }
}

class ErrorUsuarioInvalido extends Error {
  constructor() {
    super("El usuario indicado no existe");
  }
}

module.exports = { ErrorMiembroYaEnEquipo, ErrorMiembroNoEncontrado, ErrorUsuarioInvalido };
