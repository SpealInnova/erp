const reportesServicioTecnicoRepositorio = require("../repositorios/reportesServicioTecnicoRepositorio");
const expedientesDisenoRepositorio = require("../repositorios/expedientesDisenoRepositorio");
const clientesRepositorio = require("../repositorios/clientesRepositorio");
const proyectosRepositorio = require("../repositorios/proyectosRepositorio");
const auditoria = require("./auditoria");
const { formatearCodigoRST } = require("../dominio/codigoReporteServicio");
const {
  ErrorReporteNoEncontrado,
  ErrorEquipoNoExiste,
  ErrorClienteNoExiste,
  ErrorProyectoNoExiste,
} = require("../dominio/erroresReportesServicioTecnico");

const TABLA = "reportes_servicio_tecnico";
const MAX_INTENTOS_CODIGO = 3;

async function generarNumeroReporte(pool) {
  const anio = new Date().getFullYear();
  const cantidadBase = await reportesServicioTecnicoRepositorio.contarPorAnio(pool, anio);

  for (let intento = 0; intento < MAX_INTENTOS_CODIGO; intento += 1) {
    const candidato = formatearCodigoRST(anio, cantidadBase + 1 + intento);
    const existente = await reportesServicioTecnicoRepositorio.buscarPorNumero(pool, candidato);
    if (!existente) {
      return candidato;
    }
  }
  throw new Error("No se pudo generar un número de reporte único");
}

async function validarReferencias(pool, datos) {
  const equipo = await expedientesDisenoRepositorio.buscarPorNumeroSerie(
    pool,
    datos.equipo_numero_serie
  );
  if (!equipo) {
    throw new ErrorEquipoNoExiste();
  }
  const cliente = await clientesRepositorio.obtenerPorId(pool, datos.cliente_id);
  if (!cliente) {
    throw new ErrorClienteNoExiste();
  }
  if (datos.proyecto_id) {
    const proyecto = await proyectosRepositorio.obtenerPorId(pool, datos.proyecto_id);
    if (!proyecto) {
      throw new ErrorProyectoNoExiste();
    }
  }
}

async function crearReporte(pool, datos, usuarioId) {
  await validarReferencias(pool, datos);

  const numero = await generarNumeroReporte(pool);
  const id = await reportesServicioTecnicoRepositorio.crear(pool, {
    ...datos,
    numero_reporte: numero,
    tecnico_responsable_id: usuarioId,
    created_by: usuarioId,
  });
  const reporte = await reportesServicioTecnicoRepositorio.obtenerPorId(pool, id);

  await auditoria.registrar(pool, {
    tabla: TABLA,
    registroId: id,
    accion: "crear",
    usuarioId,
    datosAnteriores: null,
    datosNuevos: reporte,
  });

  return reporte;
}

async function obtenerReporte(pool, id) {
  const reporte = await reportesServicioTecnicoRepositorio.obtenerPorId(pool, id);
  if (!reporte) {
    throw new ErrorReporteNoEncontrado();
  }
  return reporte;
}

async function listarReportes(pool, { pagina, tamanoPagina }) {
  const limite = tamanoPagina;
  const offset = (pagina - 1) * tamanoPagina;
  return reportesServicioTecnicoRepositorio.listar(pool, { limite, offset });
}

async function actualizarReporte(pool, id, datos, usuarioId) {
  const anterior = await obtenerReporte(pool, id);

  if (datos.equipo_numero_serie || datos.cliente_id || datos.proyecto_id) {
    await validarReferencias(pool, {
      equipo_numero_serie: datos.equipo_numero_serie || anterior.equipo_numero_serie,
      cliente_id: datos.cliente_id || anterior.cliente_id,
      proyecto_id: datos.proyecto_id,
    });
  }

  await reportesServicioTecnicoRepositorio.actualizar(pool, id, datos);
  const actualizado = await reportesServicioTecnicoRepositorio.obtenerPorId(pool, id);

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

async function eliminarReporte(pool, id, usuarioId) {
  const anterior = await obtenerReporte(pool, id);
  await reportesServicioTecnicoRepositorio.softDelete(pool, id);

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
  crearReporte,
  obtenerReporte,
  listarReportes,
  actualizarReporte,
  eliminarReporte,
};
