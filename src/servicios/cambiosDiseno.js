const cambiosDisenoRepositorio = require("../repositorios/cambiosDisenoRepositorio");
const expedientesDisenoRepositorio = require("../repositorios/expedientesDisenoRepositorio");
const auditoria = require("./auditoria");
const { exigirPermiso, exigirOtroAprobador } = require("./autorizacion");
const { ESTADOS } = require("../dominio/estadoExpedienteDiseno");
const {
  ErrorExpedienteNoEncontrado,
  ErrorExpedienteNoEditable,
} = require("../dominio/erroresExpedientesDiseno");
const { ErrorCambioNoEncontrado } = require("../dominio/erroresCambiosDiseno");

const TABLA = "cambios_diseno";

async function obtenerExpediente(pool, expedienteId) {
  const expediente = await expedientesDisenoRepositorio.obtenerPorId(pool, expedienteId);
  if (!expediente) {
    throw new ErrorExpedienteNoEncontrado();
  }
  return expediente;
}

function asegurarEditable(expediente) {
  if (expediente.estado_liberacion !== ESTADOS.PENDIENTE) {
    throw new ErrorExpedienteNoEditable();
  }
}

const DECISIONES = ["aprobado", "rechazado"];

// Decidir un cambio (aprobarlo o rechazarlo) exige el permiso aprobar_diseno y
// que lo decida alguien distinto de quien lo creó. Modificar uno ya decidido
// también exige el permiso. "anterior" es null en un alta (el creador es el
// propio usuario).
async function exigirPermisoDeDecision(pool, datos, anterior, usuarioId) {
  const estadoAnterior = anterior ? anterior.estado : "pendiente";
  const decide = DECISIONES.includes(datos.estado) && datos.estado !== estadoAnterior;
  const tocaDecidido = DECISIONES.includes(estadoAnterior);
  if (!decide && !tocaDecidido) {
    return;
  }
  const usuario = await exigirPermiso(pool, usuarioId, "aprobar_diseno");
  if (decide) {
    exigirOtroAprobador(usuario, anterior ? anterior.created_by : usuarioId);
  }
}

// Quién aprobó y cuándo se registra solo al pasar a "aprobado" (reenviar el
// mismo estado no lo cambia); al salir de "aprobado" se limpia.
function conAprobacionAutomatica(datos, usuarioId, estadoAnterior = null) {
  if (!datos.estado || datos.estado === estadoAnterior) {
    return datos;
  }
  if (datos.estado === "aprobado") {
    return { ...datos, aprobado_por: usuarioId, aprobado_en: new Date() };
  }
  return { ...datos, aprobado_por: null, aprobado_en: null };
}

async function crearCambio(pool, expedienteId, datos, usuarioId) {
  const expediente = await obtenerExpediente(pool, expedienteId);
  asegurarEditable(expediente);
  await exigirPermisoDeDecision(pool, datos, null, usuarioId);

  const cantidadActual = await cambiosDisenoRepositorio.contarPorExpediente(pool, expedienteId);
  const numero = cantidadActual + 1;

  const datosCompletos = conAprobacionAutomatica(
    { ...datos, estado: datos.estado || "pendiente", numero },
    usuarioId
  );

  const id = await cambiosDisenoRepositorio.crear(pool, expedienteId, {
    ...datosCompletos,
    created_by: usuarioId,
  });
  const cambio = await cambiosDisenoRepositorio.obtenerPorId(pool, id);

  await auditoria.registrar(pool, {
    tabla: TABLA,
    registroId: id,
    accion: "crear",
    usuarioId,
    datosAnteriores: null,
    datosNuevos: cambio,
  });

  return cambio;
}

async function listarCambios(pool, expedienteId) {
  await obtenerExpediente(pool, expedienteId);
  return cambiosDisenoRepositorio.listarPorExpediente(pool, expedienteId);
}

async function obtenerCambio(pool, id) {
  const cambio = await cambiosDisenoRepositorio.obtenerPorId(pool, id);
  if (!cambio) {
    throw new ErrorCambioNoEncontrado();
  }
  return cambio;
}

async function actualizarCambio(pool, id, datos, usuarioId) {
  const anterior = await obtenerCambio(pool, id);
  const expediente = await obtenerExpediente(pool, anterior.expediente_id);
  asegurarEditable(expediente);
  await exigirPermisoDeDecision(pool, datos, anterior, usuarioId);

  const datosCompletos = conAprobacionAutomatica(datos, usuarioId, anterior.estado);

  await cambiosDisenoRepositorio.actualizar(pool, id, datosCompletos);
  const actualizado = await cambiosDisenoRepositorio.obtenerPorId(pool, id);

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

async function eliminarCambio(pool, id, usuarioId) {
  const anterior = await obtenerCambio(pool, id);
  const expediente = await obtenerExpediente(pool, anterior.expediente_id);
  asegurarEditable(expediente);

  await cambiosDisenoRepositorio.softDelete(pool, id);

  await auditoria.registrar(pool, {
    tabla: TABLA,
    registroId: id,
    accion: "eliminar",
    usuarioId,
    datosAnteriores: anterior,
    datosNuevos: null,
  });
}

module.exports = { crearCambio, listarCambios, obtenerCambio, actualizarCambio, eliminarCambio };
