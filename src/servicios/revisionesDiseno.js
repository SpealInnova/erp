const revisionesDisenoRepositorio = require("../repositorios/revisionesDisenoRepositorio");
const expedientesDisenoRepositorio = require("../repositorios/expedientesDisenoRepositorio");
const usuariosRepositorio = require("../repositorios/usuariosRepositorio");
const auditoria = require("./auditoria");
const { ESTADOS } = require("../dominio/estadoExpedienteDiseno");
const {
  ErrorExpedienteNoEncontrado,
  ErrorExpedienteNoEditable,
  ErrorResponsableNoExiste,
} = require("../dominio/erroresExpedientesDiseno");
const { ErrorRevisionNoEncontrada } = require("../dominio/erroresRevisionesDiseno");

const TABLA = "revisiones_diseno";

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

async function crearRevision(pool, expedienteId, datos, usuarioId) {
  const expediente = await obtenerExpediente(pool, expedienteId);
  asegurarEditable(expediente);

  const responsable = await usuariosRepositorio.buscarPorId(pool, datos.responsable_id);
  if (!responsable) {
    throw new ErrorResponsableNoExiste();
  }

  const cantidadActual = await revisionesDisenoRepositorio.contarPorExpediente(pool, expedienteId);
  const numero = cantidadActual + 1;

  const id = await revisionesDisenoRepositorio.crear(pool, expedienteId, {
    ...datos,
    numero,
    created_by: usuarioId,
  });
  const revision = await revisionesDisenoRepositorio.obtenerPorId(pool, id);

  await auditoria.registrar(pool, {
    tabla: TABLA,
    registroId: id,
    accion: "crear",
    usuarioId,
    datosAnteriores: null,
    datosNuevos: revision,
  });

  return revision;
}

async function listarRevisiones(pool, expedienteId) {
  await obtenerExpediente(pool, expedienteId);
  return revisionesDisenoRepositorio.listarPorExpediente(pool, expedienteId);
}

async function obtenerRevision(pool, id) {
  const revision = await revisionesDisenoRepositorio.obtenerPorId(pool, id);
  if (!revision) {
    throw new ErrorRevisionNoEncontrada();
  }
  return revision;
}

async function actualizarRevision(pool, id, datos, usuarioId) {
  const anterior = await obtenerRevision(pool, id);
  const expediente = await obtenerExpediente(pool, anterior.expediente_id);
  asegurarEditable(expediente);

  if (datos.responsable_id) {
    const responsable = await usuariosRepositorio.buscarPorId(pool, datos.responsable_id);
    if (!responsable) {
      throw new ErrorResponsableNoExiste();
    }
  }

  await revisionesDisenoRepositorio.actualizar(pool, id, datos);
  const actualizada = await revisionesDisenoRepositorio.obtenerPorId(pool, id);

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

async function eliminarRevision(pool, id, usuarioId) {
  const anterior = await obtenerRevision(pool, id);
  const expediente = await obtenerExpediente(pool, anterior.expediente_id);
  asegurarEditable(expediente);

  await revisionesDisenoRepositorio.softDelete(pool, id);

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
  crearRevision,
  listarRevisiones,
  obtenerRevision,
  actualizarRevision,
  eliminarRevision,
};
