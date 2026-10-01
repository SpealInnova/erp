const cotizacionesRepositorio = require("../repositorios/cotizacionesRepositorio");
const cotizacionItemsRepositorio = require("../repositorios/cotizacionItemsRepositorio");
const clientesRepositorio = require("../repositorios/clientesRepositorio");
const usuariosRepositorio = require("../repositorios/usuariosRepositorio");
const auditoria = require("./auditoria");
const { formatearCodigoCot } = require("../dominio/codigoCotizacion");
const { transicionar, ESTADOS } = require("../dominio/estadoCotizacion");
const {
  ErrorCotizacionNoEncontrada,
  ErrorClienteNoExiste,
  ErrorAsesorNoExiste,
  ErrorCotizacionNoEditable,
  ErrorItemsVacios,
} = require("../dominio/erroresCotizaciones");

const TABLA = "cotizaciones";
const MAX_INTENTOS_CODIGO = 3;

async function generarNumeroCotizacion(pool) {
  const anio = new Date().getFullYear();
  const cantidadBase = await cotizacionesRepositorio.contarPorAnio(pool, anio);

  for (let intento = 0; intento < MAX_INTENTOS_CODIGO; intento += 1) {
    const candidato = formatearCodigoCot(anio, cantidadBase + 1 + intento);
    const existente = await cotizacionesRepositorio.buscarPorNumero(pool, candidato);
    if (!existente) {
      return candidato;
    }
  }
  throw new Error("No se pudo generar un número de cotización único");
}

async function obtenerConItems(pool, id) {
  const cotizacion = await cotizacionesRepositorio.obtenerPorId(pool, id);
  if (!cotizacion) {
    throw new ErrorCotizacionNoEncontrada();
  }
  const items = await cotizacionItemsRepositorio.listarPorCotizacion(pool, id);
  return { ...cotizacion, items };
}

async function crearCotizacion(pool, datos, usuarioId) {
  if (!datos.items || datos.items.length === 0) {
    throw new ErrorItemsVacios();
  }
  const cliente = await clientesRepositorio.obtenerPorId(pool, datos.cliente_id);
  if (!cliente) {
    throw new ErrorClienteNoExiste();
  }
  const asesor = await usuariosRepositorio.buscarPorId(pool, datos.asesor_comercial_id);
  if (!asesor) {
    throw new ErrorAsesorNoExiste();
  }

  const numero = await generarNumeroCotizacion(pool);
  const id = await cotizacionesRepositorio.crear(pool, {
    numero_cotizacion: numero,
    cliente_id: datos.cliente_id,
    asesor_comercial_id: datos.asesor_comercial_id,
    estado: ESTADOS.BORRADOR,
    fecha_validez: datos.fecha_validez,
    created_by: usuarioId,
  });
  await cotizacionItemsRepositorio.insertarMuchos(pool, id, datos.items);

  const cotizacion = await obtenerConItems(pool, id);

  await auditoria.registrar(pool, {
    tabla: TABLA,
    registroId: id,
    accion: "crear",
    usuarioId,
    datosAnteriores: null,
    datosNuevos: cotizacion,
  });

  return cotizacion;
}

async function listarCotizaciones(pool, { pagina, tamanoPagina }) {
  const limite = tamanoPagina;
  const offset = (pagina - 1) * tamanoPagina;
  return cotizacionesRepositorio.listar(pool, { limite, offset });
}

async function actualizarCotizacion(pool, id, datos, usuarioId) {
  const anterior = await obtenerConItems(pool, id);
  if (anterior.estado !== ESTADOS.BORRADOR) {
    throw new ErrorCotizacionNoEditable();
  }

  if (datos.asesor_comercial_id) {
    const asesor = await usuariosRepositorio.buscarPorId(pool, datos.asesor_comercial_id);
    if (!asesor) {
      throw new ErrorAsesorNoExiste();
    }
  }

  const { items, ...cabecera } = datos;
  if (Object.keys(cabecera).length > 0) {
    await cotizacionesRepositorio.actualizar(pool, id, cabecera);
  }
  if (items) {
    if (items.length === 0) {
      throw new ErrorItemsVacios();
    }
    await cotizacionItemsRepositorio.eliminarPorCotizacion(pool, id);
    await cotizacionItemsRepositorio.insertarMuchos(pool, id, items);
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

async function cambiarEstadoCotizacion(pool, id, estadoDestino, usuarioId) {
  const anterior = await obtenerConItems(pool, id);
  transicionar(anterior.estado, estadoDestino);

  await cotizacionesRepositorio.actualizarEstado(pool, id, estadoDestino);
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

async function eliminarCotizacion(pool, id, usuarioId) {
  const anterior = await obtenerConItems(pool, id);
  await cotizacionesRepositorio.softDelete(pool, id);

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
  crearCotizacion,
  obtenerConItems,
  listarCotizaciones,
  actualizarCotizacion,
  cambiarEstadoCotizacion,
  eliminarCotizacion,
};
