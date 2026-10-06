const requisitosEntradaRepositorio = require("../repositorios/requisitosEntradaRepositorio");
const expedientesDisenoRepositorio = require("../repositorios/expedientesDisenoRepositorio");
const auditoria = require("./auditoria");
const { ESTADOS } = require("../dominio/estadoExpedienteDiseno");
const {
  ErrorExpedienteNoEncontrado,
  ErrorExpedienteNoEditable,
} = require("../dominio/erroresExpedientesDiseno");
const { ErrorRequisitoNoEncontrado } = require("../dominio/erroresRequisitosEntrada");

const TABLA = "requisitos_entrada";

async function obtenerExpedienteEditable(pool, expedienteId) {
  const expediente = await expedientesDisenoRepositorio.obtenerPorId(pool, expedienteId);
  if (!expediente) {
    throw new ErrorExpedienteNoEncontrado();
  }
  return expediente;
}

async function crearRequisito(pool, expedienteId, datos, usuarioId) {
  const expediente = await obtenerExpedienteEditable(pool, expedienteId);
  if (expediente.estado_liberacion !== ESTADOS.PENDIENTE) {
    throw new ErrorExpedienteNoEditable();
  }

  const id = await requisitosEntradaRepositorio.crear(pool, expedienteId, {
    ...datos,
    created_by: usuarioId,
  });
  const requisito = await requisitosEntradaRepositorio.obtenerPorId(pool, id);

  await auditoria.registrar(pool, {
    tabla: TABLA,
    registroId: id,
    accion: "crear",
    usuarioId,
    datosAnteriores: null,
    datosNuevos: requisito,
  });

  return requisito;
}

async function listarRequisitos(pool, expedienteId) {
  await obtenerExpedienteEditable(pool, expedienteId);
  return requisitosEntradaRepositorio.listarPorExpediente(pool, expedienteId);
}

async function obtenerRequisito(pool, id) {
  const requisito = await requisitosEntradaRepositorio.obtenerPorId(pool, id);
  if (!requisito) {
    throw new ErrorRequisitoNoEncontrado();
  }
  return requisito;
}

async function actualizarRequisito(pool, id, datos, usuarioId) {
  const anterior = await obtenerRequisito(pool, id);
  const expediente = await obtenerExpedienteEditable(pool, anterior.expediente_id);
  if (expediente.estado_liberacion !== ESTADOS.PENDIENTE) {
    throw new ErrorExpedienteNoEditable();
  }

  await requisitosEntradaRepositorio.actualizar(pool, id, datos);
  const actualizado = await requisitosEntradaRepositorio.obtenerPorId(pool, id);

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

async function eliminarRequisito(pool, id, usuarioId) {
  const anterior = await obtenerRequisito(pool, id);
  const expediente = await obtenerExpedienteEditable(pool, anterior.expediente_id);
  if (expediente.estado_liberacion !== ESTADOS.PENDIENTE) {
    throw new ErrorExpedienteNoEditable();
  }

  await requisitosEntradaRepositorio.softDelete(pool, id);

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
  crearRequisito,
  listarRequisitos,
  obtenerRequisito,
  actualizarRequisito,
  eliminarRequisito,
};
