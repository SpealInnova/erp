const { ZodError } = require("zod");
const {
  ErrorCredencialesInvalidas,
  ErrorUsuarioInactivo,
  ErrorUsuarioBloqueado,
  ErrorTokenInvalido,
} = require("../dominio/erroresAuth");
const { ErrorClienteNoEncontrado, ErrorIdentificacionDuplicada } = require("../dominio/erroresClientes");

// eslint-disable-next-line no-unused-vars
function manejadorErrores(error, req, res, next) {
  if (error instanceof ZodError) {
    return res.status(400).json({ error: "Datos inválidos", detalles: error.issues });
  }
  if (error instanceof ErrorCredencialesInvalidas) {
    return res.status(401).json({ error: error.message });
  }
  if (error instanceof ErrorUsuarioInactivo) {
    return res.status(403).json({ error: error.message });
  }
  if (error instanceof ErrorUsuarioBloqueado) {
    return res.status(423).json({ error: error.message, bloqueadoHasta: error.bloqueadoHasta });
  }
  if (error instanceof ErrorTokenInvalido) {
    return res.status(400).json({ error: error.message });
  }
  if (error instanceof ErrorClienteNoEncontrado) {
    return res.status(404).json({ error: error.message });
  }
  if (error instanceof ErrorIdentificacionDuplicada) {
    return res.status(409).json({ error: error.message });
  }

  console.error(error);
  return res.status(500).json({ error: "Error interno" });
}

module.exports = { manejadorErrores };
