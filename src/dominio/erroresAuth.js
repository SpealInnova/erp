class ErrorCredencialesInvalidas extends Error {
  constructor() {
    super("Correo o contraseña incorrectos");
  }
}

class ErrorUsuarioInactivo extends Error {
  constructor() {
    super("Usuario inactivo");
  }
}

class ErrorUsuarioBloqueado extends Error {
  constructor(bloqueadoHasta) {
    super("Usuario bloqueado temporalmente");
    this.bloqueadoHasta = bloqueadoHasta;
  }
}

class ErrorTokenInvalido extends Error {
  constructor() {
    super("Token de recuperación inválido o expirado");
  }
}

module.exports = {
  ErrorCredencialesInvalidas,
  ErrorUsuarioInactivo,
  ErrorUsuarioBloqueado,
  ErrorTokenInvalido,
};
