const ordenesCompraRepositorio = require("../repositorios/ordenesCompraRepositorio");
const ordenCompraItemsRepositorio = require("../repositorios/ordenCompraItemsRepositorio");
const requisicionesRepositorio = require("../repositorios/requisicionesRepositorio");
const proveedoresRepositorio = require("../repositorios/proveedoresRepositorio");
const auditoria = require("./auditoria");
const { aLimites } = require("../repositorios/consultaListado");
const { insertarConCodigoUnico } = require("./codigoUnico");
const versiones = require("./versiones");
const { exigirPermiso, exigirOtroAprobador } = require("./autorizacion");
const { ErrorEliminacionBloqueada } = require("../dominio/erroresVersiones");
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

  const id = await insertarConCodigoUnico(
    "uq_ordenes_compra_numero",
    () => generarNumeroOC(pool),
    (numero) =>
      ordenesCompraRepositorio.crear(pool, {
        numero_oc: numero,
        requisicion_id: datos.requisicion_id,
        proveedor_id: datos.proveedor_id,
        estado: ESTADOS.PTE_APROBAR,
        created_by: usuarioId,
      })
  );
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

// Página de la lista con búsqueda y filtro; devuelve { filas, total }.
async function listarOrdenesCompra(pool, { pagina, tamanoPagina, q, estado }) {
  return ordenesCompraRepositorio.listar(pool, {
    ...aLimites({ pagina, tamanoPagina }),
    q,
    estado,
  });
}

// opciones.comoVersion: una nueva versión corrige la OC en cualquier estado
// (la edición normal solo se permite pendiente de aprobar).
async function actualizarOrdenCompra(pool, id, datos, usuarioId, opciones = {}) {
  const anterior = await obtenerConItems(pool, id);
  if (!opciones.comoVersion && anterior.estado !== ESTADOS.PTE_APROBAR) {
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

// Permiso que exige cada estado destino (matriz en dominio/permisos.js).
const PERMISO_POR_DESTINO = {
  [ESTADOS.APROBADA_PTE_PAGO]: "aprobar_oc",
  [ESTADOS.PAGA]: "pagar_oc",
  [ESTADOS.CONTABILIZADA]: "pagar_oc",
};

async function cambiarEstadoOrdenCompra(pool, id, estadoDestino, usuarioId) {
  const anterior = await obtenerConItems(pool, id);
  transicionar(anterior.estado, estadoDestino);

  const permiso = PERMISO_POR_DESTINO[estadoDestino];
  if (permiso) {
    const usuario = await exigirPermiso(pool, usuarioId, permiso);
    if (estadoDestino === ESTADOS.APROBADA_PTE_PAGO) {
      exigirOtroAprobador(usuario, anterior.created_by);
    }
  }

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
  if (anterior.estado !== ESTADOS.PTE_APROBAR) {
    throw new ErrorEliminacionBloqueada(
      `La orden de compra ${anterior.numero_oc} ya fue aprobada: no se puede eliminar. Para corregirla, crea una nueva versión.`,
      { estado: anterior.estado }
    );
  }
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

// Nueva versión de una OC. Si estaba aprobada (pendiente de pago) y cambian
// sus ítems o el proveedor, vuelve a "pendiente de aprobar": la aprobación se
// dio sobre otros valores. Si ya se pagó, conserva su estado.
async function crearVersionOrdenCompra(pool, id, { motivo, ...datos }, usuarioId) {
  await exigirPermiso(pool, usuarioId, "versionar_oc");
  await versiones.crearNuevaVersion(pool, {
    tabla: TABLA,
    registroId: id,
    motivo,
    usuarioId,
    obtener: (conexion) => obtenerConItems(conexion, id),
    actualizar: async (conexion, anterior) => {
      await actualizarOrdenCompra(conexion, id, datos, usuarioId, { comoVersion: true });
      const cambiaValor =
        Boolean(datos.items) ||
        (datos.proveedor_id && datos.proveedor_id !== anterior.proveedor_id);
      if (anterior.estado === ESTADOS.APROBADA_PTE_PAGO && cambiaValor) {
        await ordenesCompraRepositorio.actualizar(conexion, id, {
          estado: ESTADOS.PTE_APROBAR,
          aprobado_por: null,
          aprobado_en: null,
        });
      }
    },
  });
  return obtenerConItems(pool, id);
}

module.exports = {
  crearOrdenCompra,
  crearVersionOrdenCompra,
  obtenerConItems,
  listarOrdenesCompra,
  actualizarOrdenCompra,
  cambiarEstadoOrdenCompra,
  eliminarOrdenCompra,
};
