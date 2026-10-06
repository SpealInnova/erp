const proyectosRepositorio = require("../repositorios/proyectosRepositorio");
const clientesRepositorio = require("../repositorios/clientesRepositorio");
const usuariosRepositorio = require("../repositorios/usuariosRepositorio");
const auditoria = require("./auditoria");
const { formatearCodigoPry } = require("../dominio/codigoProyecto");
const { transicionar, ESTADOS } = require("../dominio/estadoProyecto");
const {
  ErrorProyectoNoEncontrado,
  ErrorClienteInvalido,
  ErrorResponsableInvalido,
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

async function crearProyecto(pool, datos, usuarioId) {
  const cliente = await clientesRepositorio.obtenerPorId(pool, datos.cliente_id);
  if (!cliente) {
    throw new ErrorClienteInvalido();
  }
  const responsable = await usuariosRepositorio.buscarPorId(pool, datos.responsable_id);
  if (!responsable) {
    throw new ErrorResponsableInvalido();
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

  await proyectosRepositorio.actualizar(pool, id, datos);
  const actualizado = await proyectosRepositorio.obtenerPorId(pool, id);

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

async function cambiarEstadoProyecto(pool, id, estadoDestino, usuarioId) {
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
    datosNuevos: actualizado,
  });

  return actualizado;
}

async function eliminarProyecto(pool, id, usuarioId) {
  const anterior = await obtenerProyecto(pool, id);
  await proyectosRepositorio.softDelete(pool, id);

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
  crearProyecto,
  obtenerProyecto,
  listarProyectos,
  actualizarProyecto,
  cambiarEstadoProyecto,
  eliminarProyecto,
};
