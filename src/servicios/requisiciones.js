const requisicionesRepositorio = require("../repositorios/requisicionesRepositorio");
const requisicionItemsRepositorio = require("../repositorios/requisicionItemsRepositorio");
const proyectosRepositorio = require("../repositorios/proyectosRepositorio");
const auditoria = require("./auditoria");
const { formatearCodigoReq } = require("../dominio/codigoRequisicion");
const { transicionar, ESTADOS } = require("../dominio/estadoRequisicion");
const {
  ErrorRequisicionNoEncontrada,
  ErrorProyectoNoExiste,
  ErrorRequisicionNoEditable,
  ErrorItemsVacios,
} = require("../dominio/erroresRequisiciones");

const TABLA = "requisiciones";
const MAX_INTENTOS_CODIGO = 3;

async function generarNumeroRequisicion(pool) {
  const anio = new Date().getFullYear();
  const cantidadBase = await requisicionesRepositorio.contarPorAnio(pool, anio);

  for (let intento = 0; intento < MAX_INTENTOS_CODIGO; intento += 1) {
    const candidato = formatearCodigoReq(anio, cantidadBase + 1 + intento);
    const existente = await requisicionesRepositorio.buscarPorNumero(pool, candidato);
    if (!existente) {
      return candidato;
    }
  }
  throw new Error("No se pudo generar un número de requisición único");
}

async function obtenerConItems(pool, id) {
  const requisicion = await requisicionesRepositorio.obtenerPorId(pool, id);
  if (!requisicion) {
    throw new ErrorRequisicionNoEncontrada();
  }
  const items = await requisicionItemsRepositorio.listarPorRequisicion(pool, id);
  return { ...requisicion, items };
}

async function crearRequisicion(pool, datos, usuarioId) {
  if (!datos.items || datos.items.length === 0) {
    throw new ErrorItemsVacios();
  }
  const proyecto = await proyectosRepositorio.obtenerPorId(pool, datos.proyecto_id);
  if (!proyecto) {
    throw new ErrorProyectoNoExiste();
  }

  const numero = await generarNumeroRequisicion(pool);
  const id = await requisicionesRepositorio.crear(pool, {
    numero_requisicion: numero,
    proyecto_id: datos.proyecto_id,
    solicitante_id: usuarioId,
    procedencia: datos.procedencia,
    estado: ESTADOS.SOLICITADA,
  });
  await requisicionItemsRepositorio.insertarMuchos(pool, id, datos.items);

  const requisicion = await obtenerConItems(pool, id);

  await auditoria.registrar(pool, {
    tabla: TABLA,
    registroId: id,
    accion: "crear",
    usuarioId,
    datosAnteriores: null,
    datosNuevos: requisicion,
  });

  return requisicion;
}

async function listarRequisiciones(pool, { pagina, tamanoPagina }) {
  const limite = tamanoPagina;
  const offset = (pagina - 1) * tamanoPagina;
  return requisicionesRepositorio.listar(pool, { limite, offset });
}

async function actualizarRequisicion(pool, id, datos, usuarioId) {
  const anterior = await obtenerConItems(pool, id);
  if (anterior.estado !== ESTADOS.SOLICITADA) {
    throw new ErrorRequisicionNoEditable();
  }

  const { items, ...cabecera } = datos;
  if (Object.keys(cabecera).length > 0) {
    await requisicionesRepositorio.actualizar(pool, id, cabecera);
  }
  if (items) {
    if (items.length === 0) {
      throw new ErrorItemsVacios();
    }
    await requisicionItemsRepositorio.eliminarPorRequisicion(pool, id);
    await requisicionItemsRepositorio.insertarMuchos(pool, id, items);
  }

  const actualizada = await obtenerConItems(pool, id);

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

async function cambiarEstadoRequisicion(pool, id, estadoDestino, usuarioId) {
  const anterior = await obtenerConItems(pool, id);
  transicionar(anterior.estado, estadoDestino);

  await requisicionesRepositorio.actualizarEstado(pool, id, estadoDestino);
  const actualizada = await obtenerConItems(pool, id);

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

async function eliminarRequisicion(pool, id, usuarioId) {
  const anterior = await obtenerConItems(pool, id);
  await requisicionesRepositorio.softDelete(pool, id);

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
  crearRequisicion,
  obtenerConItems,
  listarRequisiciones,
  actualizarRequisicion,
  cambiarEstadoRequisicion,
  eliminarRequisicion,
};
