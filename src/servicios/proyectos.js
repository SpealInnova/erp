const bcrypt = require("bcryptjs");
const proyectosRepositorio = require("../repositorios/proyectosRepositorio");
const clientesRepositorio = require("../repositorios/clientesRepositorio");
const usuariosRepositorio = require("../repositorios/usuariosRepositorio");
const cotizacionesRepositorio = require("../repositorios/cotizacionesRepositorio");
const auditoria = require("./auditoria");
const proyectoActividadesServicio = require("./proyectoActividades");
const notificacionesServicio = require("./notificaciones");
const archivosDrive = require("./archivosDrive");
const { formatearCodigoPry } = require("../dominio/codigoProyecto");
const { transicionar, ESTADOS } = require("../dominio/estadoProyecto");
const { ESTADOS: ESTADOS_COTIZACION } = require("../dominio/estadoCotizacion");
const {
  ErrorProyectoNoEncontrado,
  ErrorClienteInvalido,
  ErrorResponsableInvalido,
  ErrorCotizacionInvalida,
  ErrorCodigoPryDuplicado,
  ErrorPasswordInvalida,
} = require("../dominio/erroresProyectos");

const TABLA = "proyectos";
const MAX_INTENTOS_CODIGO = 3;

async function generarCodigoPry(pool) {
  const anio = new Date().getFullYear();
  const cantidadBase = await proyectosRepositorio.contarPorAnio(pool, anio);

  for (let intento = 0; intento < MAX_INTENTOS_CODIGO; intento += 1) {
    const candidato = formatearCodigoPry(anio, cantidadBase + 1 + intento);
    const existente = await proyectosRepositorio.buscarPorCodigoPry(pool, candidato);
    if (!existente) {
      return candidato;
    }
  }
  throw new Error("No se pudo generar un código de proyecto único");
}

async function validarCotizacion(pool, cotizacionId, clienteId) {
  const cotizacion = await cotizacionesRepositorio.obtenerPorId(pool, cotizacionId);
  if (
    !cotizacion ||
    cotizacion.estado !== ESTADOS_COTIZACION.ACEPTADA ||
    cotizacion.cliente_id !== clienteId
  ) {
    throw new ErrorCotizacionInvalida();
  }
}

async function crearProyecto(pool, datos, usuarioId) {
  const cliente = await clientesRepositorio.obtenerPorId(pool, datos.cliente_id);
  if (!cliente) {
    throw new ErrorClienteInvalido();
  }
  const responsable = await usuariosRepositorio.buscarPorId(pool, datos.responsable_id);
  if (!responsable) {
    throw new ErrorResponsableInvalido();
  }
  if (datos.cotizacion_id) {
    await validarCotizacion(pool, datos.cotizacion_id, datos.cliente_id);
  }

  const codigoPry = await generarCodigoPry(pool);

  const id = await proyectosRepositorio.crear(pool, {
    ...datos,
    codigo_pry: codigoPry,
    estado: ESTADOS.PROSPECTO,
  });
  const proyecto = await proyectosRepositorio.obtenerPorId(pool, id);

  await auditoria.registrar(pool, {
    tabla: TABLA,
    registroId: id,
    accion: "crear",
    usuarioId,
    datosAnteriores: null,
    datosNuevos: proyecto,
  });

  return proyecto;
}

async function obtenerProyecto(pool, id) {
  const proyecto = await proyectosRepositorio.obtenerPorId(pool, id);
  if (!proyecto) {
    throw new ErrorProyectoNoEncontrado();
  }
  return proyecto;
}

async function obtenerProyectoConResumen(pool, id) {
  const proyecto = await obtenerProyecto(pool, id);
  const gastoReal = await proyectosRepositorio.obtenerGastoReal(pool, id);
  return { ...proyecto, gasto_real: gastoReal };
}

async function listarProyectos(pool, { pagina, tamanoPagina }) {
  const limite = tamanoPagina;
  const offset = (pagina - 1) * tamanoPagina;
  return proyectosRepositorio.listar(pool, { limite, offset });
}

async function actualizarProyecto(pool, id, datos, usuarioId) {
  const anterior = await obtenerProyecto(pool, id);

  if (datos.responsable_id) {
    const responsable = await usuariosRepositorio.buscarPorId(pool, datos.responsable_id);
    if (!responsable) {
      throw new ErrorResponsableInvalido();
    }
  }
  if (datos.cotizacion_id) {
    await validarCotizacion(pool, datos.cotizacion_id, anterior.cliente_id);
  }
  if (datos.codigo_pry && datos.codigo_pry !== anterior.codigo_pry) {
    const existente = await proyectosRepositorio.buscarPorCodigoPry(pool, datos.codigo_pry);
    if (existente && existente.id !== id) {
      throw new ErrorCodigoPryDuplicado();
    }
  }

  await proyectosRepositorio.actualizar(pool, id, datos);
  const actualizado = await proyectosRepositorio.obtenerPorId(pool, id);

  if (datos.codigo_pry && datos.codigo_pry !== anterior.codigo_pry && anterior.drive_folder_id) {
    await archivosDrive.renombrarCarpeta({
      carpetaId: anterior.drive_folder_id,
      nombre: datos.codigo_pry,
    });
  }

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

async function cambiarEstadoProyecto(pool, id, estadoDestino, usuarioId, observacion) {
  const anterior = await obtenerProyecto(pool, id);
  transicionar(anterior.estado, estadoDestino);

  await proyectosRepositorio.actualizarEstado(pool, id, estadoDestino);
  const actualizado = await proyectosRepositorio.obtenerPorId(pool, id);

  await auditoria.registrar(pool, {
    tabla: TABLA,
    registroId: id,
    accion: "actualizar",
    usuarioId,
    datosAnteriores: anterior,
    datosNuevos: observacion ? { ...actualizado, observacion } : actualizado,
  });

  await proyectoActividadesServicio.generarActividadesParaFase(
    pool,
    id,
    estadoDestino,
    usuarioId
  );

  await notificacionesServicio.notificar(pool, {
    usuarioId: actualizado.responsable_id,
    tipo: "proyecto_cambio_fase",
    mensaje: `El proyecto ${actualizado.codigo_pry} cambió de fase a "${estadoDestino}".`,
    enlace: `#/proyectos/${id}`,
    enviarCorreo: true,
  });

  return actualizado;
}

async function eliminarProyecto(pool, id, { password, justificacion }, usuarioId) {
  const anterior = await obtenerProyecto(pool, id);

  const usuario = await usuariosRepositorio.buscarPorId(pool, usuarioId);
  const passwordValida = usuario && (await bcrypt.compare(password, usuario.password_hash));
  if (!passwordValida) {
    throw new ErrorPasswordInvalida();
  }

  await proyectosRepositorio.softDelete(pool, id);

  await auditoria.registrar(pool, {
    tabla: TABLA,
    registroId: id,
    accion: "eliminar",
    usuarioId,
    datosAnteriores: anterior,
    datosNuevos: { justificacion },
  });
}

module.exports = {
  crearProyecto,
  obtenerProyecto,
  obtenerProyectoConResumen,
  listarProyectos,
  actualizarProyecto,
  cambiarEstadoProyecto,
  eliminarProyecto,
};
