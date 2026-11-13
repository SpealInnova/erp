const reportesServicioTecnicoRepositorio = require("../repositorios/reportesServicioTecnicoRepositorio");
const expedientesDisenoRepositorio = require("../repositorios/expedientesDisenoRepositorio");
const clientesRepositorio = require("../repositorios/clientesRepositorio");
const proyectosRepositorio = require("../repositorios/proyectosRepositorio");
const auditoria = require("./auditoria");
const { insertarConCodigoUnico } = require("./codigoUnico");
const coherencia = require("./coherenciaProyecto");
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

// Equipo, proyecto y cliente deben coincidir. El equipo ya pertenece a un
// proyecto (por su expediente de diseño): si el reporte no indica proyecto,
// se toma ese; si indica otro, se rechaza. El cliente debe ser el del proyecto.
// Devuelve el id del proyecto con el que queda el reporte.
async function resolverReferencias(pool, { equipo_numero_serie, cliente_id, proyecto_id }) {
  const equipo = await expedientesDisenoRepositorio.buscarPorNumeroSerie(pool, equipo_numero_serie);
  if (!equipo) {
    throw new ErrorEquipoNoExiste();
  }
  const cliente = await clientesRepositorio.obtenerPorId(pool, cliente_id);
  if (!cliente) {
    throw new ErrorClienteNoExiste();
  }

  let proyecto;
  if (proyecto_id) {
    proyecto = await proyectosRepositorio.obtenerPorId(pool, proyecto_id);
    if (!proyecto) {
      throw new ErrorProyectoNoExiste();
    }
    await coherencia.exigirEquipoDelProyecto(pool, equipo, equipo_numero_serie, proyecto);
  } else {
    proyecto = await proyectosRepositorio.obtenerPorId(pool, equipo.proyecto_id);
  }

  if (!proyecto) return null;
  await coherencia.exigirClienteDelProyecto(pool, proyecto, cliente_id);
  return proyecto.id;
}

async function crearReporte(pool, datos, usuarioId) {
  const proyectoId = await resolverReferencias(pool, datos);

  const id = await insertarConCodigoUnico(
    "uq_reportes_servicio_numero",
    () => generarNumeroReporte(pool),
    (numero) =>
      reportesServicioTecnicoRepositorio.crear(pool, {
        ...datos,
        proyecto_id: proyectoId,
        numero_reporte: numero,
        tecnico_responsable_id: usuarioId,
        created_by: usuarioId,
      })
  );
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

  // Solo se revisan los enlaces si cambia alguno: editar hallazgos o fechas de
  // un reporte antiguo no debe quedar bloqueado por cómo se registró.
  let cambios = datos;
  if (datos.equipo_numero_serie || datos.cliente_id || datos.proyecto_id) {
    const cambiaEquipo =
      Boolean(datos.equipo_numero_serie) &&
      datos.equipo_numero_serie !== anterior.equipo_numero_serie;
    const proyectoId = await resolverReferencias(pool, {
      equipo_numero_serie: datos.equipo_numero_serie || anterior.equipo_numero_serie,
      cliente_id: datos.cliente_id || anterior.cliente_id,
      // con otro equipo y sin proyecto indicado, el proyecto sale del equipo nuevo
      proyecto_id: datos.proyecto_id || (cambiaEquipo ? null : anterior.proyecto_id),
    });
    cambios = { ...datos, proyecto_id: proyectoId };
  }

  await reportesServicioTecnicoRepositorio.actualizar(pool, id, cambios);
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
