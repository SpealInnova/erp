const requisicionesServicio = require("../servicios/requisiciones");
const {
  crearRequisicionSchema,
  actualizarRequisicionSchema,
  cambiarEstadoSchema,
  listarRequisicionesQuerySchema,
} = require("../validaciones/requisicionesSchemas");

function crearRequisicionesControlador(pool) {
  async function crear(req, res) {
    const datos = crearRequisicionSchema.parse(req.body);
    const requisicion = await requisicionesServicio.crearRequisicion(pool, datos, req.usuario.id);
    res.status(201).json({ requisicion });
  }

  async function listar(req, res) {
    const query = listarRequisicionesQuerySchema.parse(req.query);
    const requisiciones = await requisicionesServicio.listarRequisiciones(pool, query);
    res.status(200).json({ requisiciones });
  }

  async function obtener(req, res) {
    const id = Number(req.params.id);
    const requisicion = await requisicionesServicio.obtenerConItems(pool, id);
    res.status(200).json({ requisicion });
  }

  async function actualizar(req, res) {
    const id = Number(req.params.id);
    const datos = actualizarRequisicionSchema.parse(req.body);
    const requisicion = await requisicionesServicio.actualizarRequisicion(
      pool,
      id,
      datos,
      req.usuario.id
    );
    res.status(200).json({ requisicion });
  }

  async function cambiarEstado(req, res) {
    const id = Number(req.params.id);
    const { estado } = cambiarEstadoSchema.parse(req.body);
    const requisicion = await requisicionesServicio.cambiarEstadoRequisicion(
      pool,
      id,
      estado,
      req.usuario.id
    );
    res.status(200).json({ requisicion });
  }

  async function eliminar(req, res) {
    const id = Number(req.params.id);
    await requisicionesServicio.eliminarRequisicion(pool, id, req.usuario.id);
    res.status(204).send();
  }

  return { crear, listar, obtener, actualizar, cambiarEstado, eliminar };
}

module.exports = { crearRequisicionesControlador };
