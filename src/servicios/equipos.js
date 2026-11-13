const equiposRepositorio = require("../repositorios/equiposRepositorio");
const proyectosRepositorio = require("../repositorios/proyectosRepositorio");
const clientesRepositorio = require("../repositorios/clientesRepositorio");
const auditoria = require("./auditoria");
const coherencia = require("./coherenciaProyecto");
const {
  ErrorEquipoNoEncontrado,
  ErrorNumeroSerieEnUso,
  ErrorEquipoDeExpediente,
  ErrorEquipoConReportes,
} = require("../dominio/erroresEquipos");
const {
  ErrorClienteNoExiste,
  ErrorProyectoNoExiste,
} = require("../dominio/erroresReportesServicioTecnico");

// Registro de equipos instalados. Hay dos orígenes:
// - "expediente": se crea y actualiza solo, a partir del expediente de diseño
//   que tiene número de serie (ver sincronizarDesdeExpediente).
// - "historico": equipos anteriores al ERP, sin expediente, que se registran
//   a mano para poder hacerles reportes de servicio y tener su trazabilidad.
const TABLA = "equipos";

async function listarEquipos(pool, filtros) {
  return equiposRepositorio.listar(pool, filtros);
}

async function obtenerEquipo(pool, id) {
  const equipo = await equiposRepositorio.obtenerPorId(pool, id);
  if (!equipo) {
    throw new ErrorEquipoNoEncontrado();
  }
  const reportes = await equiposRepositorio.listarReportes(pool, equipo.numero_serie);
  return { ...equipo, historial_reportes: reportes };
}

async function validarClienteYProyecto(pool, clienteId, proyectoId) {
  const cliente = await clientesRepositorio.obtenerPorId(pool, clienteId);
  if (!cliente) {
    throw new ErrorClienteNoExiste();
  }
  const proyecto = await proyectosRepositorio.obtenerPorId(pool, proyectoId);
  if (!proyecto) {
    throw new ErrorProyectoNoExiste();
  }
  await coherencia.exigirClienteDelProyecto(pool, proyecto, clienteId);
}

async function exigirSerialLibre(pool, numeroSerie, equipoIdPropio = null) {
  const existente = await equiposRepositorio.buscarPorNumeroSerie(pool, numeroSerie, {
    incluirEliminados: true,
  });
  if (existente && existente.id !== equipoIdPropio) {
    throw new ErrorNumeroSerieEnUso(numeroSerie);
  }
}

async function crearEquipoHistorico(pool, datos, usuarioId) {
  await validarClienteYProyecto(pool, datos.cliente_id, datos.proyecto_id);
  await exigirSerialLibre(pool, datos.numero_serie);

  const id = await equiposRepositorio.crear(pool, {
    ...datos,
    origen: "historico",
    created_by: usuarioId,
  });
  const equipo = await equiposRepositorio.obtenerPorId(pool, id);
  await auditoria.registrar(pool, {
    tabla: TABLA,
    registroId: id,
    accion: "crear",
    usuarioId,
    datosAnteriores: null,
    datosNuevos: equipo,
  });
  return equipo;
}

async function actualizarEquipoHistorico(pool, id, datos, usuarioId) {
  const anterior = await equiposRepositorio.obtenerPorId(pool, id);
  if (!anterior) {
    throw new ErrorEquipoNoEncontrado();
  }
  if (anterior.origen !== "historico") {
    throw new ErrorEquipoDeExpediente();
  }
  if (datos.cliente_id || datos.proyecto_id) {
    await validarClienteYProyecto(
      pool,
      datos.cliente_id || anterior.cliente_id,
      datos.proyecto_id || anterior.proyecto_id
    );
  }
  if (datos.numero_serie && datos.numero_serie !== anterior.numero_serie) {
    if ((await equiposRepositorio.contarReportes(pool, anterior.numero_serie)) > 0) {
      throw new ErrorEquipoConReportes(anterior.numero_serie);
    }
    await exigirSerialLibre(pool, datos.numero_serie, id);
  }

  await equiposRepositorio.actualizar(pool, id, datos);
  const actualizado = await equiposRepositorio.obtenerPorId(pool, id);
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

// Antes de guardar un expediente: su número de serie no puede ser de otro
// equipo, y si el expediente ya tenía uno con reportes, no se puede cambiar.
async function validarSerialDeExpediente(pool, expedienteId, numeroSerieNuevo) {
  const propio = expedienteId
    ? await equiposRepositorio.buscarPorExpediente(pool, expedienteId)
    : null;
  if (propio && propio.numero_serie !== numeroSerieNuevo) {
    if ((await equiposRepositorio.contarReportes(pool, propio.numero_serie)) > 0) {
      throw new ErrorEquipoConReportes(propio.numero_serie);
    }
  }
  if (numeroSerieNuevo) {
    await exigirSerialLibre(pool, numeroSerieNuevo, propio ? propio.id : null);
  }
}

// Mantiene el registro de equipos al día con el expediente (ya guardado).
async function sincronizarDesdeExpediente(pool, expediente, usuarioId) {
  const propio = await equiposRepositorio.buscarPorExpediente(pool, expediente.id);
  const tieneSerie = Boolean(expediente.numero_serie) && !expediente.deleted_at;

  if (!tieneSerie) {
    if (propio && !propio.deleted_at) {
      await equiposRepositorio.actualizar(pool, propio.id, { deleted_at: new Date() });
    }
    return;
  }

  const proyecto = await proyectosRepositorio.obtenerPorId(pool, expediente.proyecto_id);
  const datos = {
    numero_serie: expediente.numero_serie,
    cliente_id: proyecto.cliente_id,
    proyecto_id: expediente.proyecto_id,
    descripcion: expediente.producto_nombre,
    modelo: expediente.modelo || null,
  };
  if (propio) {
    await equiposRepositorio.actualizar(pool, propio.id, { ...datos, deleted_at: null });
    return;
  }
  await equiposRepositorio.crear(pool, {
    ...datos,
    expediente_id: expediente.id,
    origen: "expediente",
    created_by: usuarioId,
  });
}

module.exports = {
  listarEquipos,
  obtenerEquipo,
  crearEquipoHistorico,
  actualizarEquipoHistorico,
  validarSerialDeExpediente,
  sincronizarDesdeExpediente,
};
