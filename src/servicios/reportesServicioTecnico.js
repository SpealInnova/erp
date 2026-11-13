const reportesServicioTecnicoRepositorio = require("../repositorios/reportesServicioTecnicoRepositorio");
const equiposRepositorio = require("../repositorios/equiposRepositorio");
const clientesRepositorio = require("../repositorios/clientesRepositorio");
const proyectosRepositorio = require("../repositorios/proyectosRepositorio");
const auditoria = require("./auditoria");
const { insertarConCodigoUnico } = require("./codigoUnico");
const coherencia = require("./coherenciaProyecto");
const versiones = require("./versiones");
const { ErrorEliminacionBloqueada } = require("../dominio/erroresVersiones");
const { formatearCodigoRST } = require("../dominio/codigoReporteServicio");
const {
  ErrorReporteNoEncontrado,
  ErrorEquipoNoExiste,
  ErrorClienteNoExiste,
  ErrorProyectoNoExiste,
} = require("../dominio/erroresReportesServicioTecnico");
const { ErrorEnlaceInconsistente } = require("../dominio/erroresEnlaces");

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

// Todo reporte queda asociado a un proyecto. El equipo sale del registro de
// equipos (con o sin expediente). Si el reporte no indica proyecto, se toma el
// del equipo; si indica otro, debe ser del mismo cliente del equipo (p. ej. un
// contrato de mantenimiento). El cliente del reporte es el del proyecto.
// Devuelve el id del proyecto con el que queda el reporte.
async function resolverReferencias(pool, { equipo_numero_serie, cliente_id, proyecto_id }) {
  const equipo = await equiposRepositorio.buscarPorNumeroSerie(pool, equipo_numero_serie);
  if (!equipo) {
    throw new ErrorEquipoNoExiste();
  }
  const cliente = await clientesRepositorio.obtenerPorId(pool, cliente_id);
  if (!cliente) {
    throw new ErrorClienteNoExiste();
  }

  const proyecto = await proyectosRepositorio.obtenerPorId(pool, proyecto_id || equipo.proyecto_id);
  if (!proyecto) {
    if (proyecto_id) throw new ErrorProyectoNoExiste();
    throw new ErrorEnlaceInconsistente(
      `El proyecto del equipo ${equipo_numero_serie} ya no existe: indica un proyecto del mismo cliente para el reporte.`
    );
  }
  await coherencia.exigirEquipoDelCliente(pool, equipo, proyecto);
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

// Un reporte de servicio es parte de la historia del equipo: no se elimina,
// se corrige con una nueva versión.
async function eliminarReporte(pool, id) {
  const reporte = await obtenerReporte(pool, id);
  throw new ErrorEliminacionBloqueada(
    `El reporte ${reporte.numero_reporte} no se puede eliminar. Para corregirlo, crea una nueva versión.`
  );
}

async function crearVersionReporte(pool, id, { motivo, ...datos }, usuarioId) {
  await versiones.crearNuevaVersion(pool, {
    tabla: TABLA,
    registroId: id,
    motivo,
    usuarioId,
    obtener: (conexion) => obtenerReporte(conexion, id),
    actualizar: (conexion) => actualizarReporte(conexion, id, datos, usuarioId),
  });
  return obtenerReporte(pool, id);
}

module.exports = {
  crearReporte,
  crearVersionReporte,
  obtenerReporte,
  listarReportes,
  actualizarReporte,
  eliminarReporte,
};
