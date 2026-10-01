const ordenesCompraRepositorio = require("../repositorios/ordenesCompraRepositorio");
const ordenCompraItemsRepositorio = require("../repositorios/ordenCompraItemsRepositorio");
const requisicionesRepositorio = require("../repositorios/requisicionesRepositorio");
const proveedoresRepositorio = require("../repositorios/proveedoresRepositorio");
const auditoria = require("./auditoria");
const { formatearCodigoOC } = require("../dominio/codigoOrdenCompra");
const { transicionar, ESTADOS } = require("../dominio/estadoOrdenCompra");
const {
  ErrorOrdenCompraNoEncontrada,
  ErrorRequisicionNoExiste,
  ErrorProveedorNoExiste,
  ErrorOrdenCompraNoEditable,
  ErrorItemsVacios,
} = require("../dominio/erroresOrdenesCompra");

const TABLA = "ordenes_compra";
const MAX_INTENTOS_CODIGO = 3;

async function generarNumeroOC(pool) {
  const anio = new Date().getFullYear();
  const cantidadBase = await ordenesCompraRepositorio.contarPorAnio(pool, anio);

  for (let intento = 0; intento < MAX_INTENTOS_CODIGO; intento += 1) {
    const candidato = formatearCodigoOC(anio, cantidadBase + 1 + intento);
    const existente = await ordenesCompraRepositorio.buscarPorNumero(pool, candidato);
    if (!existente) {
      return candidato;
    }
  }
  throw new Error("No se pudo generar un número de orden de compra único");
}

async function obtenerConItems(pool, id) {
  const orden = await ordenesCompraRepositorio.obtenerPorId(pool, id);
  if (!orden) {
    throw new ErrorOrdenCompraNoEncontrada();
  }
  const items = await ordenCompraItemsRepositorio.listarPorOrden(pool, id);
  return { ...orden, items };
}

async function crearOrdenCompra(pool, datos, usuarioId) {
  if (!datos.items || datos.items.length === 0) {
    throw new ErrorItemsVacios();
  }
  const requisicion = await requisicionesRepositorio.obtenerPorId(pool, datos.requisicion_id);
  if (!requisicion) {
    throw new ErrorRequisicionNoExiste();
  }
  const proveedor = await proveedoresRepositorio.obtenerPorId(pool, datos.proveedor_id);
  if (!proveedor) {
    throw new ErrorProveedorNoExiste();
  }

  const numero = await generarNumeroOC(pool);
  const id = await ordenesCompraRepositorio.crear(pool, {
    numero_oc: numero,
    requisicion_id: datos.requisicion_id,
    proveedor_id: datos.proveedor_id,
    estado: ESTADOS.PTE_APROBAR,
    created_by: usuarioId,
  });
  await ordenCompraItemsRepositorio.insertarMuchos(pool, id, datos.items);

  const orden = await obtenerConItems(pool, id);

  await auditoria.registrar(pool, {
    tabla: TABLA,
    registroId: id,
    accion: "crear",
    usuarioId,
    datosAnteriores: null,
    datosNuevos: orden,
  });

  return orden;
}

async function listarOrdenesCompra(pool, { pagina, tamanoPagina }) {
  const limite = tamanoPagina;
  const offset = (pagina - 1) * tamanoPagina;
  return ordenesCompraRepositorio.listar(pool, { limite, offset });
}

async function actualizarOrdenCompra(pool, id, datos, usuarioId) {
  const anterior = await obtenerConItems(pool, id);
  if (anterior.estado !== ESTADOS.PTE_APROBAR) {
    throw new ErrorOrdenCompraNoEditable();
  }

  if (datos.proveedor_id) {
    const proveedor = await proveedoresRepositorio.obtenerPorId(pool, datos.proveedor_id);
    if (!proveedor) {
      throw new ErrorProveedorNoExiste();
    }
  }

  const { items, ...cabecera } = datos;
  if (Object.keys(cabecera).length > 0) {
    await ordenesCompraRepositorio.actualizar(pool, id, cabecera);
  }
  if (items) {
    if (items.length === 0) {
      throw new ErrorItemsVacios();
    }
    await ordenCompraItemsRepositorio.eliminarPorOrden(pool, id);
    await ordenCompraItemsRepositorio.insertarMuchos(pool, id, items);
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

async function cambiarEstadoOrdenCompra(pool, id, estadoDestino, usuarioId) {
  const anterior = await obtenerConItems(pool, id);
  transicionar(anterior.estado, estadoDestino);

  const opciones =
    estadoDestino === ESTADOS.APROBADA_PTE_PAGO
      ? { aprobadoPor: usuarioId, aprobadoEn: new Date() }
      : {};
  await ordenesCompraRepositorio.actualizarEstado(pool, id, estadoDestino, opciones);
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

async function eliminarOrdenCompra(pool, id, usuarioId) {
  const anterior = await obtenerConItems(pool, id);
  await ordenesCompraRepositorio.softDelete(pool, id);

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
  crearOrdenCompra,
  obtenerConItems,
  listarOrdenesCompra,
  actualizarOrdenCompra,
  cambiarEstadoOrdenCompra,
  eliminarOrdenCompra,
};
