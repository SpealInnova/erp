const verificacionesRepositorio = require("../repositorios/verificacionesRepositorio");
const expedientesDisenoRepositorio = require("../repositorios/expedientesDisenoRepositorio");
const auditoria = require("./auditoria");
const { ESTADOS } = require("../dominio/estadoExpedienteDiseno");
const {
  ErrorExpedienteNoEncontrado,
  ErrorExpedienteNoEditable,
} = require("../dominio/erroresExpedientesDiseno");
const { ErrorVerificacionNoEncontrada } = require("../dominio/erroresVerificaciones");

const TABLA = "verificaciones";

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

async function crearVerificacion(pool, expedienteId, datos, usuarioId) {
  const expediente = await obtenerExpediente(pool, expedienteId);
  asegurarEditable(expediente);

  const id = await verificacionesRepositorio.crear(pool, expedienteId, {
    ...datos,
    created_by: usuarioId,
  });
  const verificacion = await verificacionesRepositorio.obtenerPorId(pool, id);

  await auditoria.registrar(pool, {
    tabla: TABLA,
    registroId: id,
    accion: "crear",
    usuarioId,
    datosAnteriores: null,
    datosNuevos: verificacion,
  });

  return verificacion;
}

async function listarVerificaciones(pool, expedienteId) {
  await obtenerExpediente(pool, expedienteId);
  return verificacionesRepositorio.listarPorExpediente(pool, expedienteId);
}

async function obtenerVerificacion(pool, id) {
  const verificacion = await verificacionesRepositorio.obtenerPorId(pool, id);
  if (!verificacion) {
    throw new ErrorVerificacionNoEncontrada();
  }
  return verificacion;
}

async function actualizarVerificacion(pool, id, datos, usuarioId) {
  const anterior = await obtenerVerificacion(pool, id);
  const expediente = await obtenerExpediente(pool, anterior.expediente_id);
  asegurarEditable(expediente);

  await verificacionesRepositorio.actualizar(pool, id, datos);
  const actualizada = await verificacionesRepositorio.obtenerPorId(pool, id);

  await auditoria.registrar(pool, {
    tabla: TABLA,
    registroId: id,
    accion: "actualizar",
    usuarioId,
    datosAnteriores: anterior,
    datosNuevos: actualizada,
  });

  return actualizada;
}

async function eliminarVerificacion(pool, id, usuarioId) {
  const anterior = await obtenerVerificacion(pool, id);
  const expediente = await obtenerExpediente(pool, anterior.expediente_id);
  asegurarEditable(expediente);

  await verificacionesRepositorio.softDelete(pool, id);

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
  crearVerificacion,
  listarVerificaciones,
  obtenerVerificacion,
  actualizarVerificacion,
  eliminarVerificacion,
};
