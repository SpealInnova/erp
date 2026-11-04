const actasEntregaRepositorio = require("../repositorios/actasEntregaRepositorio");
const actaEntregaItemsRepositorio = require("../repositorios/actaEntregaItemsRepositorio");
const proyectosRepositorio = require("../repositorios/proyectosRepositorio");
const clientesRepositorio = require("../repositorios/clientesRepositorio");
const expedientesDisenoRepositorio = require("../repositorios/expedientesDisenoRepositorio");
const auditoria = require("./auditoria");
const { formatearCodigoAEE } = require("../dominio/codigoActaEntrega");
const {
  ErrorActaEntregaNoEncontrada,
  ErrorProyectoNoExiste,
  ErrorClienteNoExiste,
  ErrorItemsVacios,
} = require("../dominio/erroresActasEntrega");

const TABLA = "actas_entrega_equipos";
const MAX_INTENTOS_CODIGO = 3;

async function generarNumeroActa(pool) {
  const anio = new Date().getFullYear();
  const cantidadBase = await actasEntregaRepositorio.contarPorAnio(pool, anio);

  for (let intento = 0; intento < MAX_INTENTOS_CODIGO; intento += 1) {
    const candidato = formatearCodigoAEE(anio, cantidadBase + 1 + intento);
    const existente = await actasEntregaRepositorio.buscarPorNumero(pool, candidato);
    if (!existente) {
      return candidato;
    }
  }
  throw new Error("No se pudo generar un número de acta único");
}

async function enlazarExpedientes(pool, items) {
  const resultado = [];
  for (const item of items) {
    let expedienteId = null;
    if (item.numero_serie) {
      const expediente = await expedientesDisenoRepositorio.buscarPorNumeroSerie(
        pool,
        item.numero_serie
      );
      if (expediente) {
        expedienteId = expediente.id;
      }
    }
    resultado.push({ ...item, expediente_id: expedienteId });
  }
  return resultado;
}

async function obtenerConItems(pool, id) {
  const acta = await actasEntregaRepositorio.obtenerPorId(pool, id);
  if (!acta) {
    throw new ErrorActaEntregaNoEncontrada();
  }
  const items = await actaEntregaItemsRepositorio.listarPorActa(pool, id);
  return { ...acta, items };
}

async function crearActaEntrega(pool, datos, usuarioId) {
  if (!datos.items || datos.items.length === 0) {
    throw new ErrorItemsVacios();
  }
  const proyecto = await proyectosRepositorio.obtenerPorId(pool, datos.proyecto_id);
  if (!proyecto) {
    throw new ErrorProyectoNoExiste();
  }
  const cliente = await clientesRepositorio.obtenerPorId(pool, datos.cliente_id);
  if (!cliente) {
    throw new ErrorClienteNoExiste();
  }

  const numero = await generarNumeroActa(pool);
  const id = await actasEntregaRepositorio.crear(pool, {
    ...datos,
    numero_acta: numero,
    entregante_id: usuarioId,
    fecha_elaboracion: datos.fecha_elaboracion || new Date().toISOString().slice(0, 10),
    created_by: usuarioId,
  });
  const itemsEnlazados = await enlazarExpedientes(pool, datos.items);
  await actaEntregaItemsRepositorio.insertarMuchos(pool, id, itemsEnlazados);

  const acta = await obtenerConItems(pool, id);

  await auditoria.registrar(pool, {
    tabla: TABLA,
    registroId: id,
    accion: "crear",
    usuarioId,
    datosAnteriores: null,
    datosNuevos: acta,
  });

  return acta;
}

async function listarActasEntrega(pool, { pagina, tamanoPagina }) {
  const limite = tamanoPagina;
  const offset = (pagina - 1) * tamanoPagina;
  return actasEntregaRepositorio.listar(pool, { limite, offset });
}

async function actualizarActaEntrega(pool, id, datos, usuarioId) {
  const anterior = await obtenerConItems(pool, id);

  if (datos.proyecto_id) {
    const proyecto = await proyectosRepositorio.obtenerPorId(pool, datos.proyecto_id);
    if (!proyecto) {
      throw new ErrorProyectoNoExiste();
    }
  }
  if (datos.cliente_id) {
    const cliente = await clientesRepositorio.obtenerPorId(pool, datos.cliente_id);
    if (!cliente) {
      throw new ErrorClienteNoExiste();
    }
  }

  const { items, ...cabecera } = datos;
  if (Object.keys(cabecera).length > 0) {
    await actasEntregaRepositorio.actualizar(pool, id, cabecera);
  }
  if (items) {
    if (items.length === 0) {
      throw new ErrorItemsVacios();
    }
    const itemsEnlazados = await enlazarExpedientes(pool, items);
    await actaEntregaItemsRepositorio.eliminarPorActa(pool, id);
    await actaEntregaItemsRepositorio.insertarMuchos(pool, id, itemsEnlazados);
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

async function eliminarActaEntrega(pool, id, usuarioId) {
  const anterior = await obtenerConItems(pool, id);
  await actasEntregaRepositorio.softDelete(pool, id);

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
  crearActaEntrega,
  obtenerConItems,
  listarActasEntrega,
  actualizarActaEntrega,
  eliminarActaEntrega,
};
