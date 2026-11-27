const listadoMaestro = require("../servicios/listadoMaestroServicios");
const { listadoMaestroQuerySchema } = require("../validaciones/listadoMaestroServiciosSchemas");

function crearListadoMaestroServiciosControlador(pool) {
  async function listar(req, res) {
    const query = listadoMaestroQuerySchema.parse(req.query);
    const { servicios, total } = await listadoMaestro.listarServicios(pool, query);
    res.status(200).json({
      servicios,
      total,
      pagina: query.pagina,
      tamanoPagina: query.tamanoPagina,
    });
  }

  // Mismos filtros que el listado, sin paginar (hasta MAXIMO_CSV filas).
  async function descargarCsv(req, res) {
    const query = listadoMaestroQuerySchema.parse(req.query);
    const csv = await listadoMaestro.generarCsv(pool, query);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${csv.nombre}"`);
    res.setHeader("X-Total-Servicios", String(csv.total));
    if (csv.recortado) res.setHeader("X-Recortado", String(listadoMaestro.MAXIMO_CSV));
    res.status(200).send(csv.contenido);
  }

  return { listar, descargarCsv };
}

module.exports = { crearListadoMaestroServiciosControlador };
