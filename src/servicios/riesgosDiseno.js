const riesgosDisenoRepositorio = require("../repositorios/riesgosDisenoRepositorio");
const expedientesDisenoRepositorio = require("../repositorios/expedientesDisenoRepositorio");
const usuariosRepositorio = require("../repositorios/usuariosRepositorio");
const auditoria = require("./auditoria");
const { ESTADOS } = require("../dominio/estadoExpedienteDiseno");
const {
  ErrorExpedienteNoEncontrado,
  ErrorExpedienteNoEditable,
  ErrorResponsableNoExiste,
} = require("../dominio/erroresExpedientesDiseno");
const { ErrorRiesgoNoEncontrado } = require("../dominio/erroresRiesgosDiseno");

const TABLA = "riesgos_diseno";

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

async function crearRiesgo(pool, expedienteId, datos, usuarioId) {
  const expediente = await obtenerExpediente(pool, expedienteId);
  asegurarEditable(expediente);

  const responsable = await usuariosRepositorio.buscarPorId(pool, datos.responsable_id);
  if (!responsable) {
    throw new ErrorResponsableNoExiste();
  }

  const id = await riesgosDisenoRepositorio.crear(pool, expedienteId, {
    ...datos,
    created_by: usuarioId,
  });
  const riesgo = await riesgosDisenoRepositorio.obtenerPorId(pool, id);

  await auditoria.registrar(pool, {
    tabla: TABLA,
    registroId: id,
    accion: "crear",
    usuarioId,
    datosAnteriores: null,
    datosNuevos: riesgo,
  });

  return riesgo;
}

async function listarRiesgos(pool, expedienteId) {
  await obtenerExpediente(pool, expedienteId);
  return riesgosDisenoRepositorio.listarPorExpediente(pool, expedienteId);
}

async function obtenerRiesgo(pool, id) {
  const riesgo = await riesgosDisenoRepositorio.obtenerPorId(pool, id);
  if (!riesgo) {
    throw new ErrorRiesgoNoEncontrado();
  }
  return riesgo;
}

async function actualizarRiesgo(pool, id, datos, usuarioId) {
  const anterior = await obtenerRiesgo(pool, id);
  const expediente = await obtenerExpediente(pool, anterior.expediente_id);
  asegurarEditable(expediente);

  if (datos.responsable_id) {
    const responsable = await usuariosRepositorio.buscarPorId(pool, datos.responsable_id);
    if (!responsable) {
      throw new ErrorResponsableNoExiste();
    }
  }

  await riesgosDisenoRepositorio.actualizar(pool, id, datos);
  const actualizado = await riesgosDisenoRepositorio.obtenerPorId(pool, id);

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

async function eliminarRiesgo(pool, id, usuarioId) {
  const anterior = await obtenerRiesgo(pool, id);
  const expediente = await obtenerExpediente(pool, anterior.expediente_id);
  asegurarEditable(expediente);

  await riesgosDisenoRepositorio.softDelete(pool, id);

  await auditoria.registrar(pool, {
    tabla: TABLA,
    registroId: id,
    accion: "eliminar",
    usuarioId,
    datosAnteriores: anterior,
    datosNuevos: null,
  });
}

module.exports = { crearRiesgo, listarRiesgos, obtenerRiesgo, actualizarRiesgo, eliminarRiesgo };
