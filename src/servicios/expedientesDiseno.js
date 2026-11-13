const expedientesDisenoRepositorio = require("../repositorios/expedientesDisenoRepositorio");
const proyectosRepositorio = require("../repositorios/proyectosRepositorio");
const usuariosRepositorio = require("../repositorios/usuariosRepositorio");
const auditoria = require("./auditoria");
const { insertarConCodigoUnico } = require("./codigoUnico");
const equiposServicio = require("./equipos");
const { exigirPermiso } = require("./autorizacion");
const { formatearCodigoExp } = require("../dominio/codigoExpedienteDiseno");
const { transicionar, ESTADOS } = require("../dominio/estadoExpedienteDiseno");
const {
  ErrorExpedienteNoEncontrado,
  ErrorProyectoNoExiste,
  ErrorResponsableNoExiste,
  ErrorExpedienteNoEditable,
  ErrorNumeroSerieDuplicado,
} = require("../dominio/erroresExpedientesDiseno");

const TABLA = "expedientes_diseno";
const MAX_INTENTOS_CODIGO = 3;

async function generarCodigoExpediente(pool) {
  const anio = new Date().getFullYear();
  const cantidadBase = await expedientesDisenoRepositorio.contarPorAnio(pool, anio);

  for (let intento = 0; intento < MAX_INTENTOS_CODIGO; intento += 1) {
    const candidato = formatearCodigoExp(anio, cantidadBase + 1 + intento);
    const existente = await expedientesDisenoRepositorio.buscarPorCodigo(pool, candidato);
    if (!existente) {
      return candidato;
    }
  }
  throw new Error("No se pudo generar un código de expediente único");
}

async function crearExpediente(pool, datos, usuarioId) {
  const proyecto = await proyectosRepositorio.obtenerPorId(pool, datos.proyecto_id);
  if (!proyecto) {
    throw new ErrorProyectoNoExiste();
  }
  const responsable = await usuariosRepositorio.buscarPorId(pool, datos.responsable_diseno_id);
  if (!responsable) {
    throw new ErrorResponsableNoExiste();
  }
  if (datos.numero_serie) {
    const existente = await expedientesDisenoRepositorio.buscarPorNumeroSerie(
      pool,
      datos.numero_serie
    );
    if (existente) {
      throw new ErrorNumeroSerieDuplicado();
    }
    // tampoco puede ser el serial de un equipo histórico ya registrado
    await equiposServicio.validarSerialDeExpediente(pool, null, datos.numero_serie);
  }

  const id = await insertarConCodigoUnico(
    "uq_expedientes_codigo",
    () => generarCodigoExpediente(pool),
    (codigo) =>
      expedientesDisenoRepositorio.crear(pool, {
        ...datos,
        codigo_expediente: codigo,
        estado_liberacion: ESTADOS.PENDIENTE,
        created_by: usuarioId,
      })
  );
  const expediente = await expedientesDisenoRepositorio.obtenerPorId(pool, id);
  await equiposServicio.sincronizarDesdeExpediente(pool, expediente, usuarioId);

  await auditoria.registrar(pool, {
    tabla: TABLA,
    registroId: id,
    accion: "crear",
    usuarioId,
    datosAnteriores: null,
    datosNuevos: expediente,
  });

  return expediente;
}

async function obtenerExpediente(pool, id) {
  const expediente = await expedientesDisenoRepositorio.obtenerPorId(pool, id);
  if (!expediente) {
    throw new ErrorExpedienteNoEncontrado();
  }
  return expediente;
}

async function listarExpedientes(pool, { pagina, tamanoPagina }) {
  const limite = tamanoPagina;
  const offset = (pagina - 1) * tamanoPagina;
  return expedientesDisenoRepositorio.listar(pool, { limite, offset });
}

async function actualizarExpediente(pool, id, datos, usuarioId) {
  const anterior = await obtenerExpediente(pool, id);
  if (anterior.estado_liberacion !== ESTADOS.PENDIENTE) {
    throw new ErrorExpedienteNoEditable();
  }

  if (datos.responsable_diseno_id) {
    const responsable = await usuariosRepositorio.buscarPorId(pool, datos.responsable_diseno_id);
    if (!responsable) {
      throw new ErrorResponsableNoExiste();
    }
  }
  if (datos.numero_serie) {
    const existente = await expedientesDisenoRepositorio.buscarPorNumeroSerie(
      pool,
      datos.numero_serie,
      id
    );
    if (existente) {
      throw new ErrorNumeroSerieDuplicado();
    }
  }
  if (datos.numero_serie !== undefined && datos.numero_serie !== anterior.numero_serie) {
    await equiposServicio.validarSerialDeExpediente(pool, id, datos.numero_serie);
  }

  await expedientesDisenoRepositorio.actualizar(pool, id, datos);
  const actualizado = await expedientesDisenoRepositorio.obtenerPorId(pool, id);
  await equiposServicio.sincronizarDesdeExpediente(pool, actualizado, usuarioId);

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

async function cambiarEstadoExpediente(pool, id, estadoDestino, usuarioId) {
  const anterior = await obtenerExpediente(pool, id);
  transicionar(anterior.estado_liberacion, estadoDestino);
  // Toda transición sale de "pendiente" hacia una decisión final (liberar o rechazar).
  await exigirPermiso(pool, usuarioId, "aprobar_diseno");

  await expedientesDisenoRepositorio.actualizarEstado(pool, id, estadoDestino);
  const actualizado = await expedientesDisenoRepositorio.obtenerPorId(pool, id);

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

async function eliminarExpediente(pool, id, usuarioId) {
  const anterior = await obtenerExpediente(pool, id);
  await expedientesDisenoRepositorio.softDelete(pool, id);
  await equiposServicio.sincronizarDesdeExpediente(
    pool,
    { ...anterior, deleted_at: new Date() },
    usuarioId
  );

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
  crearExpediente,
  obtenerExpediente,
  listarExpedientes,
  actualizarExpediente,
  cambiarEstadoExpediente,
  eliminarExpediente,
};
