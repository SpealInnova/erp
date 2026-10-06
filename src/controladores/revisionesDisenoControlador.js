const revisionesDisenoServicio = require("../servicios/revisionesDiseno");
const {
  crearRevisionSchema,
  actualizarRevisionSchema,
} = require("../validaciones/revisionesDisenoSchemas");

function crearRevisionesDisenoControlador(pool) {
  async function crear(req, res) {
    const expedienteId = Number(req.params.expedienteId);
    const datos = crearRevisionSchema.parse(req.body);
    const revision = await revisionesDisenoServicio.crearRevision(
      pool,
      expedienteId,
      datos,
      req.usuario.id
    );
    res.status(201).json({ revision });
  }

  async function listar(req, res) {
    const expedienteId = Number(req.params.expedienteId);
    const revisiones = await revisionesDisenoServicio.listarRevisiones(pool, expedienteId);
    res.status(200).json({ revisiones });
  }

  async function obtener(req, res) {
    const id = Number(req.params.id);
    const revision = await revisionesDisenoServicio.obtenerRevision(pool, id);
    res.status(200).json({ revision });
  }

  async function actualizar(req, res) {
    const id = Number(req.params.id);
    const datos = actualizarRevisionSchema.parse(req.body);
    const revision = await revisionesDisenoServicio.actualizarRevision(
      pool,
      id,
      datos,
      req.usuario.id
    );
    res.status(200).json({ revision });
  }

  async function eliminar(req, res) {
    const id = Number(req.params.id);
    await revisionesDisenoServicio.eliminarRevision(pool, id, req.usuario.id);
    res.status(204).send();
  }

  return { crear, listar, obtener, actualizar, eliminar };
}

module.exports = { crearRevisionesDisenoControlador };
