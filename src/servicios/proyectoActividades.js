const proyectoActividadesRepositorio = require("../repositorios/proyectoActividadesRepositorio");
const proyectosRepositorio = require("../repositorios/proyectosRepositorio");
const usuariosRepositorio = require("../repositorios/usuariosRepositorio");
const auditoria = require("./auditoria");
const notificacionesServicio = require("./notificaciones");
const { obtenerActividadesPorFase } = require("../dominio/actividadesCatalogoProyecto");
const { ErrorProyectoNoEncontrado, ErrorResponsableInvalido } = require("../dominio/erroresProyectos");
const { ErrorActividadNoEncontrada } = require("../dominio/erroresProyectoActividades");
const transiciones = require("./transiciones");
const { ESTADOS_TRABAJO, PRIORIDADES, TEXTO_PRIORIDAD } = require("../dominio/trabajo");

const TABLA = "proyecto_actividades";

async function obtenerProyectoExistente(pool, proyectoId) {
  const proyecto = await proyectosRepositorio.obtenerPorId(pool, proyectoId);
  if (!proyecto) {
    throw new ErrorProyectoNoEncontrado();
  }
  return proyecto;
}

// Se llama desde proyectosServicio.cambiarEstadoProyecto al entrar a una fase
// nueva: siembra las actividades preestablecidas del catálogo para esa fase,
// una sola vez por proyecto+fase.
async function generarActividadesParaFase(pool, proyectoId, fase, usuarioId) {
  const plantillas = obtenerActividadesPorFase(fase);
  if (plantillas.length === 0) {
    return;
  }
  const yaGeneradas = await proyectoActividadesRepositorio.contarPorProyectoYFase(
    pool,
    proyectoId,
    fase
  );
  if (yaGeneradas > 0) {
    return;
  }
  await proyectoActividadesRepositorio.crearMuchas(pool, proyectoId, plantillas, usuarioId);
}

async function listarActividades(pool, proyectoId) {
  await obtenerProyectoExistente(pool, proyectoId);
  return proyectoActividadesRepositorio.listarPorProyecto(pool, proyectoId);
}

async function agregarActividad(pool, proyectoId, datos, usuarioId) {
  const proyecto = await obtenerProyectoExistente(pool, proyectoId);
  if (datos.responsable_id) {
    const responsable = await usuariosRepositorio.buscarPorId(pool, datos.responsable_id);
    if (!responsable) {
      throw new ErrorResponsableInvalido();
    }
  }

  const id = await proyectoActividadesRepositorio.crear(pool, proyectoId, {
    fase: datos.fase || proyecto.estado,
    categoria: datos.categoria,
    descripcion: datos.descripcion,
    responsable_id: datos.responsable_id,
    orden: 0,
    created_by: usuarioId,
  });
  const actividad = await proyectoActividadesRepositorio.obtenerPorId(pool, id);

  await auditoria.registrar(pool, {
    tabla: TABLA,
    registroId: id,
    accion: "crear",
    usuarioId,
    datosAnteriores: null,
    datosNuevos: actividad,
  });

  if (actividad.responsable_id) {
    await notificacionesServicio.notificar(pool, {
      usuarioId: actividad.responsable_id,
      tipo: "actividad_asignada",
      mensaje: `Te asignaron la actividad "${actividad.descripcion}" en el proyecto ${proyecto.codigo_pry}.`,
      enlace: `#/proyectos/${proyectoId}`,
    });
  }

  return actividad;
}

async function obtenerActividad(pool, id) {
  const actividad = await proyectoActividadesRepositorio.obtenerPorId(pool, id);
  if (!actividad) {
    throw new ErrorActividadNoEncontrada();
  }
  return actividad;
}

async function actualizarActividad(pool, id, datos, usuarioId) {
  const anterior = await obtenerActividad(pool, id);

  if (datos.responsable_id) {
    const responsable = await usuariosRepositorio.buscarPorId(pool, datos.responsable_id);
    if (!responsable) {
      throw new ErrorResponsableInvalido();
    }
  }

  const cambios = { ...datos, updated_by: usuarioId };
  const cambiaEstado = Boolean(datos.estado) && datos.estado !== anterior.estado;
  if (datos.estado === ESTADOS_TRABAJO.COMPLETADA && anterior.estado !== ESTADOS_TRABAJO.COMPLETADA) {
    cambios.completada_por = usuarioId;
    cambios.completada_en = new Date();
  } else if (datos.estado && datos.estado !== ESTADOS_TRABAJO.COMPLETADA) {
    cambios.completada_por = null;
    cambios.completada_en = null;
  }
  // iniciada_en guarda el primer arranque: el tiempo de espera va hasta ahí.
  if (cambiaEstado && datos.estado === ESTADOS_TRABAJO.EN_CURSO && !anterior.iniciada_en) {
    cambios.iniciada_en = new Date();
  }

  await proyectoActividadesRepositorio.actualizar(pool, id, cambios);
  const actualizada = await proyectoActividadesRepositorio.obtenerPorId(pool, id);

  if (cambiaEstado) {
    await transiciones.registrar(pool, {
      entidad: "actividad",
      registroId: id,
      proyectoId: actualizada.proyecto_id,
      estadoAnterior: anterior.estado,
      estadoNuevo: actualizada.estado,
      usuarioId,
    });
  }

  await auditoria.registrar(pool, {
    tabla: TABLA,
    registroId: id,
    accion: "actualizar",
    usuarioId,
    datosAnteriores: anterior,
    datosNuevos: actualizada,
  });

  if (datos.responsable_id && datos.responsable_id !== anterior.responsable_id) {
    const proyecto = await proyectosRepositorio.obtenerPorId(pool, actualizada.proyecto_id);
    await notificacionesServicio.notificar(pool, {
      usuarioId: actualizada.responsable_id,
      tipo: "actividad_asignada",
      mensaje: `Te asignaron la actividad "${actualizada.descripcion}" en el proyecto ${proyecto.codigo_pry}.`,
      enlace: `#/proyectos/${actualizada.proyecto_id}`,
    });
  }

  if (
    datos.prioridad &&
    datos.prioridad !== anterior.prioridad &&
    datos.prioridad !== PRIORIDADES.NORMAL
  ) {
    await avisarPrioridad(pool, actualizada, usuarioId);
  }

  return actualizada;
}

// Al marcar una actividad Alta o Urgente se avisa a su responsable, a los
// responsables de las demás actividades de la misma fase y al responsable del
// proyecto (nunca a quien hizo el cambio).
async function avisarPrioridad(pool, actividad, usuarioId) {
  const proyecto = await proyectosRepositorio.obtenerPorId(pool, actividad.proyecto_id);
  const deLaFase = await proyectoActividadesRepositorio.listarResponsablesDeFase(
    pool,
    actividad.proyecto_id,
    actividad.fase
  );
  const destinatarios = new Set(
    [actividad.responsable_id, proyecto && proyecto.responsable_id, ...deLaFase].filter(Boolean)
  );
  destinatarios.delete(usuarioId);
  const prioridad = TEXTO_PRIORIDAD[actividad.prioridad];
  for (const destinatario of destinatarios) {
    await notificacionesServicio.notificar(pool, {
      usuarioId: destinatario,
      tipo: "actividad_prioridad",
      mensaje: `La actividad "${actividad.descripcion.slice(0, 120)}" del proyecto ${proyecto.codigo_pry} pasó a prioridad ${prioridad}.`,
      enlace: `#/proyectos/${actividad.proyecto_id}/actividades/${actividad.id}`,
    });
  }
}

async function eliminarActividad(pool, id, usuarioId) {
  const anterior = await obtenerActividad(pool, id);
  await proyectoActividadesRepositorio.softDelete(pool, id);

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
  generarActividadesParaFase,
  listarActividades,
  agregarActividad,
  obtenerActividad,
  actualizarActividad,
  eliminarActividad,
};
