const actasCierreRepositorio = require("../repositorios/actasCierreRepositorio");
const actaItemsVerificadosRepositorio = require("../repositorios/actaItemsVerificadosRepositorio");
const proyectosRepositorio = require("../repositorios/proyectosRepositorio");
const clientesRepositorio = require("../repositorios/clientesRepositorio");
const auditoria = require("./auditoria");
const { formatearCodigoACS } = require("../dominio/codigoActaCierre");
const {
  ErrorActaNoEncontrada,
  ErrorProyectoNoExiste,
  ErrorClienteNoExiste,
  ErrorItemsVacios,
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

  const numero = await generarNumeroActa(pool);
  const id = await actasCierreRepositorio.crear(pool, {
    ...datos,
    numero_acta: numero,
    responsable_entrega_id: usuarioId,
    fecha_elaboracion: datos.fecha_elaboracion || new Date().toISOString().slice(0, 10),
    created_by: usuarioId,
  });
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
    await actasCierreRepositorio.actualizar(pool, id, cabecera);
  }
  if (items) {
    if (items.length === 0) {
      throw new ErrorItemsVacios();
    }
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

async function eliminarActa(pool, id, usuarioId) {
  const anterior = await obtenerConItems(pool, id);
  await actasCierreRepositorio.softDelete(pool, id);

  await auditoria.registrar(pool, {
    tabla: TABLA,
    registroId: id,
    accion: "eliminar",
    usuarioId,
    datosAnteriores: anterior,
    datosNuevos: null,
  });
}

module.exports = { crearActa, obtenerConItems, listarActas, actualizarActa, eliminarActa };
