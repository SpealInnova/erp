const parametrosMedidosRepositorio = require("../repositorios/parametrosMedidosRepositorio");
const reportesServicioTecnicoRepositorio = require("../repositorios/reportesServicioTecnicoRepositorio");
const auditoria = require("./auditoria");
const { ErrorReporteNoEncontrado } = require("../dominio/erroresReportesServicioTecnico");
const { ErrorParametroNoEncontrado } = require("../dominio/erroresParametrosMedidos");

const TABLA = "parametros_medidos";

async function obtenerReporte(pool, reporteId) {
  const reporte = await reportesServicioTecnicoRepositorio.obtenerPorId(pool, reporteId);
  if (!reporte) {
    throw new ErrorReporteNoEncontrado();
  }
  return reporte;
}

async function crearParametro(pool, reporteId, datos, usuarioId) {
  await obtenerReporte(pool, reporteId);

  const id = await parametrosMedidosRepositorio.crear(pool, reporteId, {
    ...datos,
    created_by: usuarioId,
  });
  const parametro = await parametrosMedidosRepositorio.obtenerPorId(pool, id);

  await auditoria.registrar(pool, {
    tabla: TABLA,
    registroId: id,
    accion: "crear",
    usuarioId,
    datosAnteriores: null,
    datosNuevos: parametro,
  });

  return parametro;
}

async function listarParametros(pool, reporteId) {
  await obtenerReporte(pool, reporteId);
  return parametrosMedidosRepositorio.listarPorReporte(pool, reporteId);
}

// El parámetro debe ser del reporte de la ruta: si es de otro, se responde
// como si no existiera (no se puede leer ni cambiar a través de otro reporte).
async function obtenerParametro(pool, reporteId, id) {
  const parametro = await parametrosMedidosRepositorio.obtenerPorId(pool, id);
  if (!parametro || parametro.reporte_id !== Number(reporteId)) {
    throw new ErrorParametroNoEncontrado();
  }
  return parametro;
}

async function actualizarParametro(pool, reporteId, id, datos, usuarioId) {
  const anterior = await obtenerParametro(pool, reporteId, id);

  await parametrosMedidosRepositorio.actualizar(pool, id, datos);
  const actualizado = await parametrosMedidosRepositorio.obtenerPorId(pool, id);

  await auditoria.registrar(pool, {
    tabla: TABLA,
    registroId: id,
    accion: "actualizar",
    usuarioId,
    datosAnteriores: anterior,
    datosNuevos: actualizado,
  });

  return actualizado;
}

async function eliminarParametro(pool, reporteId, id, usuarioId) {
  const anterior = await obtenerParametro(pool, reporteId, id);
  await parametrosMedidosRepositorio.softDelete(pool, id);

  await auditoria.registrar(pool, {
    tabla: TABLA,
    registroId: id,
    accion: "eliminar",
    usuarioId,
    datosAnteriores: anterior,
    datosNuevos: null,
  });
}

module.exports = {
  crearParametro,
  listarParametros,
  obtenerParametro,
  actualizarParametro,
  eliminarParametro,
};
