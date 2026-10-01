const verificacionesServicio = require("../servicios/verificaciones");
const {
  crearVerificacionSchema,
  actualizarVerificacionSchema,
} = require("../validaciones/verificacionesSchemas");

function crearVerificacionesControlador(pool) {
  async function crear(req, res) {
    const expedienteId = Number(req.params.expedienteId);
    const datos = crearVerificacionSchema.parse(req.body);
    const verificacion = await verificacionesServicio.crearVerificacion(
      pool,
      expedienteId,
      datos,
      req.usuario.id
    );
    res.status(201).json({ verificacion });
  }

  async function listar(req, res) {
    const expedienteId = Number(req.params.expedienteId);
    const verificaciones = await verificacionesServicio.listarVerificaciones(pool, expedienteId);
    res.status(200).json({ verificaciones });
  }

  async function obtener(req, res) {
    const id = Number(req.params.id);
    const verificacion = await verificacionesServicio.obtenerVerificacion(pool, id);
    res.status(200).json({ verificacion });
  }

  async function actualizar(req, res) {
    const id = Number(req.params.id);
    const datos = actualizarVerificacionSchema.parse(req.body);
    const verificacion = await verificacionesServicio.actualizarVerificacion(
      pool,
      id,
      datos,
      req.usuario.id
    );
    res.status(200).json({ verificacion });
  }

  async function eliminar(req, res) {
    const id = Number(req.params.id);
    await verificacionesServicio.eliminarVerificacion(pool, id, req.usuario.id);
    res.status(204).send();
  }

  return { crear, listar, obtener, actualizar, eliminar };
}

module.exports = { crearVerificacionesControlador };
