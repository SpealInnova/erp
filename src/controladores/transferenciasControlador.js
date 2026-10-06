const transferenciasServicio = require("../servicios/transferencias");
const {
  crearTransferenciaSchema,
  actualizarTransferenciaSchema,
} = require("../validaciones/transferenciasSchemas");

function crearTransferenciasControlador(pool) {
  async function crear(req, res) {
    const expedienteId = Number(req.params.expedienteId);
    const datos = crearTransferenciaSchema.parse(req.body);
    const transferencia = await transferenciasServicio.crearTransferencia(
      pool,
      expedienteId,
      datos,
      req.usuario.id
    );
    res.status(201).json({ transferencia });
  }

  async function listar(req, res) {
    const expedienteId = Number(req.params.expedienteId);
    const transferencias = await transferenciasServicio.listarTransferencias(pool, expedienteId);
    res.status(200).json({ transferencias });
  }

  async function obtener(req, res) {
    const id = Number(req.params.id);
    const transferencia = await transferenciasServicio.obtenerTransferencia(pool, id);
    res.status(200).json({ transferencia });
  }

  async function actualizar(req, res) {
    const id = Number(req.params.id);
    const datos = actualizarTransferenciaSchema.parse(req.body);
    const transferencia = await transferenciasServicio.actualizarTransferencia(
      pool,
      id,
      datos,
      req.usuario.id
    );
    res.status(200).json({ transferencia });
  }

  async function eliminar(req, res) {
    const id = Number(req.params.id);
    await transferenciasServicio.eliminarTransferencia(pool, id, req.usuario.id);
    res.status(204).send();
  }

  return { crear, listar, obtener, actualizar, eliminar };
}

module.exports = { crearTransferenciasControlador };
