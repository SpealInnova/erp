const transferenciasRepositorio = require("../repositorios/transferenciasRepositorio");
const expedientesDisenoRepositorio = require("../repositorios/expedientesDisenoRepositorio");
const usuariosRepositorio = require("../repositorios/usuariosRepositorio");
const auditoria = require("./auditoria");
const { ESTADOS } = require("../dominio/estadoExpedienteDiseno");
const {
  ErrorExpedienteNoEncontrado,
  ErrorExpedienteNoEditable,
  ErrorResponsableNoExiste,
} = require("../dominio/erroresExpedientesDiseno");
const { ErrorTransferenciaNoEncontrada } = require("../dominio/erroresTransferencias");

const TABLA = "transferencias";

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

async function crearTransferencia(pool, expedienteId, datos, usuarioId) {
  const expediente = await obtenerExpediente(pool, expedienteId);
  asegurarEditable(expediente);

  const responsable = await usuariosRepositorio.buscarPorId(pool, datos.responsable_id);
  if (!responsable) {
    throw new ErrorResponsableNoExiste();
  }

  const id = await transferenciasRepositorio.crear(pool, expedienteId, {
    ...datos,
    created_by: usuarioId,
  });
  const transferencia = await transferenciasRepositorio.obtenerPorId(pool, id);

  await auditoria.registrar(pool, {
    tabla: TABLA,
    registroId: id,
    accion: "crear",
    usuarioId,
    datosAnteriores: null,
    datosNuevos: transferencia,
  });

  return transferencia;
}

async function listarTransferencias(pool, expedienteId) {
  await obtenerExpediente(pool, expedienteId);
  return transferenciasRepositorio.listarPorExpediente(pool, expedienteId);
}

async function obtenerTransferencia(pool, id) {
  const transferencia = await transferenciasRepositorio.obtenerPorId(pool, id);
  if (!transferencia) {
    throw new ErrorTransferenciaNoEncontrada();
  }
  return transferencia;
}

async function actualizarTransferencia(pool, id, datos, usuarioId) {
  const anterior = await obtenerTransferencia(pool, id);
  const expediente = await obtenerExpediente(pool, anterior.expediente_id);
  asegurarEditable(expediente);

  if (datos.responsable_id) {
    const responsable = await usuariosRepositorio.buscarPorId(pool, datos.responsable_id);
    if (!responsable) {
      throw new ErrorResponsableNoExiste();
    }
  }

  await transferenciasRepositorio.actualizar(pool, id, datos);
  const actualizada = await transferenciasRepositorio.obtenerPorId(pool, id);

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

async function eliminarTransferencia(pool, id, usuarioId) {
  const anterior = await obtenerTransferencia(pool, id);
  const expediente = await obtenerExpediente(pool, anterior.expediente_id);
  asegurarEditable(expediente);

  await transferenciasRepositorio.softDelete(pool, id);

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
  crearTransferencia,
  listarTransferencias,
  obtenerTransferencia,
  actualizarTransferencia,
  eliminarTransferencia,
};
