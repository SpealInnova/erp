const parametrosMedidosServicio = require("../servicios/parametrosMedidos");
const {
  crearParametroSchema,
  actualizarParametroSchema,
} = require("../validaciones/parametrosMedidosSchemas");

function crearParametrosMedidosControlador(pool) {
  async function crear(req, res) {
    const reporteId = Number(req.params.reporteId);
    const datos = crearParametroSchema.parse(req.body);
    const parametro = await parametrosMedidosServicio.crearParametro(
      pool,
      reporteId,
      datos,
      req.usuario.id
    );
    res.status(201).json({ parametro });
  }

  async function listar(req, res) {
    const reporteId = Number(req.params.reporteId);
    const parametros = await parametrosMedidosServicio.listarParametros(pool, reporteId);
    res.status(200).json({ parametros });
  }

  async function obtener(req, res) {
    const id = Number(req.params.id);
    const parametro = await parametrosMedidosServicio.obtenerParametro(pool, id);
    res.status(200).json({ parametro });
  }

  async function actualizar(req, res) {
    const id = Number(req.params.id);
    const datos = actualizarParametroSchema.parse(req.body);
    const parametro = await parametrosMedidosServicio.actualizarParametro(
      pool,
      id,
      datos,
      req.usuario.id
    );
    res.status(200).json({ parametro });
  }

  async function eliminar(req, res) {
    const id = Number(req.params.id);
    await parametrosMedidosServicio.eliminarParametro(pool, id, req.usuario.id);
    res.status(204).send();
  }

  return { crear, listar, obtener, actualizar, eliminar };
}

module.exports = { crearParametrosMedidosControlador };
