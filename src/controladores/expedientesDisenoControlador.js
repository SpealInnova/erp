const expedientesDisenoServicio = require("../servicios/expedientesDiseno");
const {
  crearExpedienteSchema,
  actualizarExpedienteSchema,
  cambiarEstadoSchema,
  listarExpedientesQuerySchema,
} = require("../validaciones/expedientesDisenoSchemas");

function crearExpedientesDisenoControlador(pool) {
  async function crear(req, res) {
    const datos = crearExpedienteSchema.parse(req.body);
    const expediente = await expedientesDisenoServicio.crearExpediente(pool, datos, req.usuario.id);
    res.status(201).json({ expediente });
  }

  async function listar(req, res) {
    const query = listarExpedientesQuerySchema.parse(req.query);
    const expedientes = await expedientesDisenoServicio.listarExpedientes(pool, query);
    res.status(200).json({ expedientes });
  }

  async function obtener(req, res) {
    const id = Number(req.params.id);
    const expediente = await expedientesDisenoServicio.obtenerExpediente(pool, id);
    res.status(200).json({ expediente });
  }

  async function actualizar(req, res) {
    const id = Number(req.params.id);
    const datos = actualizarExpedienteSchema.parse(req.body);
    const expediente = await expedientesDisenoServicio.actualizarExpediente(
      pool,
      id,
      datos,
      req.usuario.id
    );
    res.status(200).json({ expediente });
  }

  async function cambiarEstado(req, res) {
    const id = Number(req.params.id);
    const { estado } = cambiarEstadoSchema.parse(req.body);
    const expediente = await expedientesDisenoServicio.cambiarEstadoExpediente(
      pool,
      id,
      estado,
      req.usuario.id
    );
    res.status(200).json({ expediente });
  }

  async function eliminar(req, res) {
    const id = Number(req.params.id);
    await expedientesDisenoServicio.eliminarExpediente(pool, id, req.usuario.id);
    res.status(204).send();
  }

  return { crear, listar, obtener, actualizar, cambiarEstado, eliminar };
}

module.exports = { crearExpedientesDisenoControlador };
