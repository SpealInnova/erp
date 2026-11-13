const actasCierreRepositorio = require("../repositorios/actasCierreRepositorio");
const actaItemsVerificadosRepositorio = require("../repositorios/actaItemsVerificadosRepositorio");
const proyectosRepositorio = require("../repositorios/proyectosRepositorio");
const clientesRepositorio = require("../repositorios/clientesRepositorio");
const actasEntregaRepositorio = require("../repositorios/actasEntregaRepositorio");
const auditoria = require("./auditoria");
const { insertarConCodigoUnico } = require("./codigoUnico");
const coherencia = require("./coherenciaProyecto");
const versiones = require("./versiones");
const { ErrorEliminacionBloqueada } = require("../dominio/erroresVersiones");
const { formatearCodigoACS } = require("../dominio/codigoActaCierre");
const {
  ErrorActaNoEncontrada,
  ErrorProyectoNoExiste,
  ErrorClienteNoExiste,
  ErrorItemsVacios,
  ErrorActaEntregaNoExiste,
} = require("../dominio/erroresActasCierre");

const TABLA = "actas_cierre_satisfaccion";
const MAX_INTENTOS_CODIGO = 3;

async function generarNumeroActa(pool) {
  const anio = new Date().getFullYear();
  const cantidadBase = await actasCierreRepositorio.contarPorAnio(pool, anio);

  for (let intento = 0; intento < MAX_INTENTOS_CODIGO; intento += 1) {
    const candidato = formatearCodigoACS(anio, cantidadBase + 1 + intento);
    const existente = await actasCierreRepositorio.buscarPorNumero(pool, candidato);
    if (!existente) {
      return candidato;
    }
  }
  throw new Error("No se pudo generar un número de acta único");
}

async function obtenerConItems(pool, id) {
  const acta = await actasCierreRepositorio.obtenerPorId(pool, id);
  if (!acta) {
    throw new ErrorActaNoEncontrada();
  }
  const items = await actaItemsVerificadosRepositorio.listarPorActa(pool, id);
  return { ...acta, items };
}

async function crearActa(pool, datos, usuarioId) {
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
  if (datos.acta_entrega_id) {
    const actaEntrega = await actasEntregaRepositorio.obtenerPorId(pool, datos.acta_entrega_id);
    if (!actaEntrega) {
      throw new ErrorActaEntregaNoExiste();
    }
    await coherencia.exigirActaEntregaDelProyecto(pool, actaEntrega, proyecto);
  }

  const id = await insertarConCodigoUnico(
    "uq_actas_cierre_numero",
    () => generarNumeroActa(pool),
    (numero) =>
      actasCierreRepositorio.crear(pool, {
        ...datos,
        numero_acta: numero,
        responsable_entrega_id: usuarioId,
        fecha_elaboracion: datos.fecha_elaboracion || new Date().toISOString().slice(0, 10),
        created_by: usuarioId,
      })
  );
  await actaItemsVerificadosRepositorio.insertarMuchos(pool, id, datos.items);

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

async function listarActas(pool, { pagina, tamanoPagina }) {
  const limite = tamanoPagina;
  const offset = (pagina - 1) * tamanoPagina;
  return actasCierreRepositorio.listar(pool, { limite, offset });
}

async function actualizarActa(pool, id, datos, usuarioId) {
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
  let actaEntrega = null;
  if (datos.acta_entrega_id) {
    actaEntrega = await actasEntregaRepositorio.obtenerPorId(pool, datos.acta_entrega_id);
    if (!actaEntrega) {
      throw new ErrorActaEntregaNoExiste();
    }
  }

  // Los enlaces se revisan solo si cambia el proyecto, el cliente o el acta de
  // entrega; así editar otros campos de un acta antigua no queda bloqueado.
  if (datos.proyecto_id || datos.cliente_id || datos.acta_entrega_id) {
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
    if (!actaEntrega && anterior.acta_entrega_id) {
      actaEntrega = await actasEntregaRepositorio.obtenerPorId(pool, anterior.acta_entrega_id);
    }
    if (actaEntrega) {
      await coherencia.exigirActaEntregaDelProyecto(pool, actaEntrega, proyecto);
    }
  }

  if (Object.keys(cabecera).length > 0) {
    await actasCierreRepositorio.actualizar(pool, id, cabecera);
  }
  if (items) {
    await actaItemsVerificadosRepositorio.eliminarPorActa(pool, id);
    await actaItemsVerificadosRepositorio.insertarMuchos(pool, id, items);
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

// Un acta de cierre firmada no se elimina: se corrige con una nueva versión.
async function eliminarActa(pool, id) {
  const acta = await obtenerConItems(pool, id);
  throw new ErrorEliminacionBloqueada(
    `El acta de cierre ${acta.numero_acta} no se puede eliminar. Para corregirla, crea una nueva versión.`
  );
}

async function crearVersionActa(pool, id, { motivo, ...datos }, usuarioId) {
  await versiones.crearNuevaVersion(pool, {
    tabla: TABLA,
    registroId: id,
    motivo,
    usuarioId,
    obtener: (conexion) => obtenerConItems(conexion, id),
    actualizar: (conexion) => actualizarActa(conexion, id, datos, usuarioId),
  });
  return obtenerConItems(pool, id);
}

module.exports = {
  crearActa,
  crearVersionActa,
  obtenerConItems,
  listarActas,
  actualizarActa,
  eliminarActa,
};
