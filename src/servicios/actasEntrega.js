const actasEntregaRepositorio = require("../repositorios/actasEntregaRepositorio");
const actaEntregaItemsRepositorio = require("../repositorios/actaEntregaItemsRepositorio");
const proyectosRepositorio = require("../repositorios/proyectosRepositorio");
const clientesRepositorio = require("../repositorios/clientesRepositorio");
const expedientesDisenoRepositorio = require("../repositorios/expedientesDisenoRepositorio");
const auditoria = require("./auditoria");
const { insertarConCodigoUnico } = require("./codigoUnico");
const coherencia = require("./coherenciaProyecto");
const versiones = require("./versiones");
const { exigirPermiso } = require("./autorizacion");
const { ErrorEliminacionBloqueada } = require("../dominio/erroresVersiones");
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

// Enlaza cada ítem con el expediente de su número de serie. Un serial que no
// existe se acepta sin enlazar (accesorios, equipos sin expediente); uno que
// existe pero es de otro proyecto se rechaza.
async function enlazarExpedientes(pool, items, proyecto) {
  const resultado = [];
  for (const item of items) {
    let expedienteId = null;
    if (item.numero_serie) {
      const expediente = await expedientesDisenoRepositorio.buscarPorNumeroSerie(
        pool,
        item.numero_serie
      );
      if (expediente) {
        await coherencia.exigirEquipoDelProyecto(pool, expediente, item.numero_serie, proyecto);
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
  await coherencia.exigirClienteDelProyecto(pool, proyecto, datos.cliente_id);
  // se valida todo antes de escribir para no dejar un acta a medias
  const itemsEnlazados = await enlazarExpedientes(pool, datos.items, proyecto);

  const id = await insertarConCodigoUnico(
    "uq_actas_entrega_equipos_numero",
    () => generarNumeroActa(pool),
    (numero) =>
      actasEntregaRepositorio.crear(pool, {
        ...datos,
        numero_acta: numero,
        entregante_id: usuarioId,
        fecha_elaboracion: datos.fecha_elaboracion || new Date().toISOString().slice(0, 10),
        created_by: usuarioId,
      })
  );
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
  const { items, ...cabecera } = datos;
  if (items && items.length === 0) {
    throw new ErrorItemsVacios();
  }

  if (datos.cliente_id) {
    const cliente = await clientesRepositorio.obtenerPorId(pool, datos.cliente_id);
    if (!cliente) {
      throw new ErrorClienteNoExiste();
    }
  }

  // Los enlaces se revisan solo si cambia el proyecto, el cliente o los
  // equipos; así editar otros campos de un acta antigua no queda bloqueado.
  let itemsEnlazados = null;
  if (datos.proyecto_id || datos.cliente_id || items) {
    const proyecto = await proyectosRepositorio.obtenerPorId(
      pool,
      datos.proyecto_id || anterior.proyecto_id
    );
    if (!proyecto) {
      throw new ErrorProyectoNoExiste();
    }
    await coherencia.exigirClienteDelProyecto(
      pool,
      proyecto,
      datos.cliente_id || anterior.cliente_id
    );
    const cambiaProyecto =
      Boolean(datos.proyecto_id) && Number(datos.proyecto_id) !== Number(anterior.proyecto_id);
    // si cambia el proyecto, los equipos ya registrados también deben ser suyos
    if (items || cambiaProyecto) {
      itemsEnlazados = await enlazarExpedientes(pool, items || anterior.items, proyecto);
    }
  }

  if (Object.keys(cabecera).length > 0) {
    await actasEntregaRepositorio.actualizar(pool, id, cabecera);
  }
  if (itemsEnlazados) {
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

// Un acta elaborada es un documento firmado: no se elimina, se corrige con una
// nueva versión (la anterior queda en el historial).
async function eliminarActaEntrega(pool, id) {
  const acta = await obtenerConItems(pool, id);
  throw new ErrorEliminacionBloqueada(
    `El acta de entrega ${acta.numero_acta} no se puede eliminar. Para corregirla, crea una nueva versión.`
  );
}

async function crearVersionActaEntrega(pool, id, { motivo, ...datos }, usuarioId) {
  await exigirPermiso(pool, usuarioId, "versionar_acta");
  await versiones.crearNuevaVersion(pool, {
    tabla: TABLA,
    registroId: id,
    motivo,
    usuarioId,
    obtener: (conexion) => obtenerConItems(conexion, id),
    actualizar: (conexion) => actualizarActaEntrega(conexion, id, datos, usuarioId),
  });
  return obtenerConItems(pool, id);
}

module.exports = {
  crearActaEntrega,
  crearVersionActaEntrega,
  obtenerConItems,
  listarActasEntrega,
  actualizarActaEntrega,
  eliminarActaEntrega,
};
