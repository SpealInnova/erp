const validacionesRepositorio = require("../repositorios/validacionesRepositorio");
const expedientesDisenoRepositorio = require("../repositorios/expedientesDisenoRepositorio");
const auditoria = require("./auditoria");
const { ESTADOS } = require("../dominio/estadoExpedienteDiseno");
const {
  ErrorExpedienteNoEncontrado,
  ErrorExpedienteNoEditable,
} = require("../dominio/erroresExpedientesDiseno");
const { ErrorValidacionNoEncontrada } = require("../dominio/erroresValidaciones");

const TABLA = "validaciones";

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

async function crearValidacion(pool, expedienteId, datos, usuarioId) {
  const expediente = await obtenerExpediente(pool, expedienteId);
  asegurarEditable(expediente);

  const id = await validacionesRepositorio.crear(pool, expedienteId, {
    ...datos,
    created_by: usuarioId,
  });
  const validacion = await validacionesRepositorio.obtenerPorId(pool, id);

  await auditoria.registrar(pool, {
    tabla: TABLA,
    registroId: id,
    accion: "crear",
    usuarioId,
    datosAnteriores: null,
    datosNuevos: validacion,
  });

  return validacion;
}

async function listarValidaciones(pool, expedienteId) {
  await obtenerExpediente(pool, expedienteId);
  return validacionesRepositorio.listarPorExpediente(pool, expedienteId);
}

async function obtenerValidacion(pool, id) {
  const validacion = await validacionesRepositorio.obtenerPorId(pool, id);
  if (!validacion) {
    throw new ErrorValidacionNoEncontrada();
  }
  return validacion;
}

async function actualizarValidacion(pool, id, datos, usuarioId) {
  const anterior = await obtenerValidacion(pool, id);
  const expediente = await obtenerExpediente(pool, anterior.expediente_id);
  asegurarEditable(expediente);

  await validacionesRepositorio.actualizar(pool, id, datos);
  const actualizada = await validacionesRepositorio.obtenerPorId(pool, id);

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

async function eliminarValidacion(pool, id, usuarioId) {
  const anterior = await obtenerValidacion(pool, id);
  const expediente = await obtenerExpediente(pool, anterior.expediente_id);
  asegurarEditable(expediente);

  await validacionesRepositorio.softDelete(pool, id);

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
  crearValidacion,
  listarValidaciones,
  obtenerValidacion,
  actualizarValidacion,
  eliminarValidacion,
};
