const salidasDisenoRepositorio = require("../repositorios/salidasDisenoRepositorio");
const expedientesDisenoRepositorio = require("../repositorios/expedientesDisenoRepositorio");
const usuariosRepositorio = require("../repositorios/usuariosRepositorio");
const auditoria = require("./auditoria");
const { ESTADOS } = require("../dominio/estadoExpedienteDiseno");
const {
  ErrorExpedienteNoEncontrado,
  ErrorExpedienteNoEditable,
  ErrorResponsableNoExiste,
} = require("../dominio/erroresExpedientesDiseno");
const { ErrorSalidaNoEncontrada } = require("../dominio/erroresSalidasDiseno");

const TABLA = "salidas_diseno";

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

async function crearSalida(pool, expedienteId, datos, usuarioId) {
  const expediente = await obtenerExpediente(pool, expedienteId);
  asegurarEditable(expediente);

  const responsable = await usuariosRepositorio.buscarPorId(pool, datos.responsable_id);
  if (!responsable) {
    throw new ErrorResponsableNoExiste();
  }

  const id = await salidasDisenoRepositorio.crear(pool, expedienteId, {
    ...datos,
    created_by: usuarioId,
  });
  const salida = await salidasDisenoRepositorio.obtenerPorId(pool, id);

  await auditoria.registrar(pool, {
    tabla: TABLA,
    registroId: id,
    accion: "crear",
    usuarioId,
    datosAnteriores: null,
    datosNuevos: salida,
  });

  return salida;
}

async function listarSalidas(pool, expedienteId) {
  await obtenerExpediente(pool, expedienteId);
  return salidasDisenoRepositorio.listarPorExpediente(pool, expedienteId);
}

async function obtenerSalida(pool, id) {
  const salida = await salidasDisenoRepositorio.obtenerPorId(pool, id);
  if (!salida) {
    throw new ErrorSalidaNoEncontrada();
  }
  return salida;
}

async function actualizarSalida(pool, id, datos, usuarioId) {
  const anterior = await obtenerSalida(pool, id);
  const expediente = await obtenerExpediente(pool, anterior.expediente_id);
  asegurarEditable(expediente);

  if (datos.responsable_id) {
    const responsable = await usuariosRepositorio.buscarPorId(pool, datos.responsable_id);
    if (!responsable) {
      throw new ErrorResponsableNoExiste();
    }
  }

  await salidasDisenoRepositorio.actualizar(pool, id, datos);
  const actualizada = await salidasDisenoRepositorio.obtenerPorId(pool, id);

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

async function eliminarSalida(pool, id, usuarioId) {
  const anterior = await obtenerSalida(pool, id);
  const expediente = await obtenerExpediente(pool, anterior.expediente_id);
  asegurarEditable(expediente);

  await salidasDisenoRepositorio.softDelete(pool, id);

  await auditoria.registrar(pool, {
    tabla: TABLA,
    registroId: id,
    accion: "eliminar",
    usuarioId,
    datosAnteriores: anterior,
    datosNuevos: null,
  });
}

module.exports = { crearSalida, listarSalidas, obtenerSalida, actualizarSalida, eliminarSalida };
