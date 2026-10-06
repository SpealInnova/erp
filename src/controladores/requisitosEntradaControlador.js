const requisitosEntradaServicio = require("../servicios/requisitosEntrada");
const {
  crearRequisitoSchema,
  actualizarRequisitoSchema,
} = require("../validaciones/requisitosEntradaSchemas");

function crearRequisitosEntradaControlador(pool) {
  async function crear(req, res) {
    const expedienteId = Number(req.params.expedienteId);
    const datos = crearRequisitoSchema.parse(req.body);
    const requisito = await requisitosEntradaServicio.crearRequisito(
      pool,
      expedienteId,
      datos,
      req.usuario.id
    );
    res.status(201).json({ requisito });
  }

  async function listar(req, res) {
    const expedienteId = Number(req.params.expedienteId);
    const requisitos = await requisitosEntradaServicio.listarRequisitos(pool, expedienteId);
    res.status(200).json({ requisitos });
  }

  async function obtener(req, res) {
    const id = Number(req.params.id);
    const requisito = await requisitosEntradaServicio.obtenerRequisito(pool, id);
    res.status(200).json({ requisito });
  }

  async function actualizar(req, res) {
    const id = Number(req.params.id);
    const datos = actualizarRequisitoSchema.parse(req.body);
    const requisito = await requisitosEntradaServicio.actualizarRequisito(
      pool,
      id,
      datos,
      req.usuario.id
    );
    res.status(200).json({ requisito });
  }

  async function eliminar(req, res) {
    const id = Number(req.params.id);
    await requisitosEntradaServicio.eliminarRequisito(pool, id, req.usuario.id);
    res.status(204).send();
  }

  return { crear, listar, obtener, actualizar, eliminar };
}

module.exports = { crearRequisitosEntradaControlador };
