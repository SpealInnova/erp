const reportesServicioTecnicoServicio = require("../servicios/reportesServicioTecnico");
const {
  crearReporteSchema,
  actualizarReporteSchema,
  listarReportesQuerySchema,
} = require("../validaciones/reportesServicioTecnicoSchemas");
const { conMotivo } = require("../validaciones/versionesSchemas");

function crearReportesServicioTecnicoControlador(pool) {
  async function crear(req, res) {
    const datos = crearReporteSchema.parse(req.body);
    const reporte = await reportesServicioTecnicoServicio.crearReporte(pool, datos, req.usuario.id);
    res.status(201).json({ reporte });
  }

  async function listar(req, res) {
    const query = listarReportesQuerySchema.parse(req.query);
    const { filas, total } = await reportesServicioTecnicoServicio.listarReportes(pool, query);
    res.status(200).json({
      reportes: filas,
      total,
      pagina: query.pagina,
      tamanoPagina: query.tamanoPagina,
    });
  }

  async function obtener(req, res) {
    const id = Number(req.params.id);
    const reporte = await reportesServicioTecnicoServicio.obtenerReporte(pool, id);
    res.status(200).json({ reporte });
  }

  async function actualizar(req, res) {
    const id = Number(req.params.id);
    const datos = actualizarReporteSchema.parse(req.body);
    const reporte = await reportesServicioTecnicoServicio.actualizarReporte(
      pool,
      id,
      datos,
      req.usuario.id
    );
    res.status(200).json({ reporte });
  }

  async function eliminar(req, res) {
    const id = Number(req.params.id);
    await reportesServicioTecnicoServicio.eliminarReporte(pool, id, req.usuario.id);
    res.status(204).send();
  }

  async function crearVersion(req, res) {
    const id = Number(req.params.id);
    const datos = conMotivo(actualizarReporteSchema).parse(req.body);
    const reporte = await reportesServicioTecnicoServicio.crearVersionReporte(
      pool,
      id,
      datos,
      req.usuario.id
    );
    res.status(200).json({ reporte });
  }

  return { crear, listar, obtener, actualizar, eliminar, crearVersion };
}

module.exports = { crearReportesServicioTecnicoControlador };
