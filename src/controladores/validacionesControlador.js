const validacionesServicio = require("../servicios/validaciones");
const {
  crearValidacionSchema,
  actualizarValidacionSchema,
} = require("../validaciones/validacionesSchemas");

function crearValidacionesControlador(pool) {
  async function crear(req, res) {
    const expedienteId = Number(req.params.expedienteId);
    const datos = crearValidacionSchema.parse(req.body);
    const validacion = await validacionesServicio.crearValidacion(
      pool,
      expedienteId,
      datos,
      req.usuario.id
    );
    res.status(201).json({ validacion });
  }

  async function listar(req, res) {
    const expedienteId = Number(req.params.expedienteId);
    const validaciones = await validacionesServicio.listarValidaciones(pool, expedienteId);
    res.status(200).json({ validaciones });
  }

  async function obtener(req, res) {
    const id = Number(req.params.id);
    const validacion = await validacionesServicio.obtenerValidacion(pool, id);
    res.status(200).json({ validacion });
  }

  async function actualizar(req, res) {
    const id = Number(req.params.id);
    const datos = actualizarValidacionSchema.parse(req.body);
    const validacion = await validacionesServicio.actualizarValidacion(
      pool,
      id,
      datos,
      req.usuario.id
    );
    res.status(200).json({ validacion });
  }

  async function eliminar(req, res) {
    const id = Number(req.params.id);
    await validacionesServicio.eliminarValidacion(pool, id, req.usuario.id);
    res.status(204).send();
  }

  return { crear, listar, obtener, actualizar, eliminar };
}

module.exports = { crearValidacionesControlador };
