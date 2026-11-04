const actasEntregaServicio = require("../servicios/actasEntrega");
const {
  crearActaEntregaSchema,
  actualizarActaEntregaSchema,
  listarActasEntregaQuerySchema,
} = require("../validaciones/actasEntregaSchemas");

function crearActasEntregaControlador(pool) {
  async function crear(req, res) {
    const datos = crearActaEntregaSchema.parse(req.body);
    const acta = await actasEntregaServicio.crearActaEntrega(pool, datos, req.usuario.id);
    res.status(201).json({ acta });
  }

  async function listar(req, res) {
    const query = listarActasEntregaQuerySchema.parse(req.query);
    const actas = await actasEntregaServicio.listarActasEntrega(pool, query);
    res.status(200).json({ actas });
  }

  async function obtener(req, res) {
    const id = Number(req.params.id);
    const acta = await actasEntregaServicio.obtenerConItems(pool, id);
    res.status(200).json({ acta });
  }

  async function actualizar(req, res) {
    const id = Number(req.params.id);
    const datos = actualizarActaEntregaSchema.parse(req.body);
    const acta = await actasEntregaServicio.actualizarActaEntrega(pool, id, datos, req.usuario.id);
    res.status(200).json({ acta });
  }

  async function eliminar(req, res) {
    const id = Number(req.params.id);
    await actasEntregaServicio.eliminarActaEntrega(pool, id, req.usuario.id);
    res.status(204).send();
  }

  return { crear, listar, obtener, actualizar, eliminar };
}

module.exports = { crearActasEntregaControlador };
