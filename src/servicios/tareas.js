const tareasRepositorio = require("../repositorios/tareasRepositorio");
const usuariosRepositorio = require("../repositorios/usuariosRepositorio");
const clientesRepositorio = require("../repositorios/clientesRepositorio");
const proyectosRepositorio = require("../repositorios/proyectosRepositorio");
const auditoria = require("./auditoria");
const notificacionesServicio = require("./notificaciones");
const transiciones = require("./transiciones");
const { esSuperusuario } = require("../dominio/permisos");
const { ESTADOS_TRABAJO, PRIORIDADES, TEXTO_PRIORIDAD } = require("../dominio/trabajo");
const { ErrorTareaNoEncontrada } = require("../dominio/erroresTareas");
const { ErrorSinPermiso } = require("../dominio/erroresPermisos");
const {
  ErrorResponsableInvalido,
  ErrorProyectoNoEncontrado,
} = require("../dominio/erroresProyectos");
const { ErrorClienteNoEncontrado } = require("../dominio/erroresClientes");

const TABLA = "tareas";

function enlaceTarea(id) {
  return `#/tareas/${id}`;
}

async function validarEnlaces(pool, datos) {
  if (datos.responsable_id) {
    const responsable = await usuariosRepositorio.buscarPorId(pool, datos.responsable_id);
    if (!responsable || !responsable.activo) throw new ErrorResponsableInvalido();
  }
  if (datos.cliente_id && !(await clientesRepositorio.obtenerPorId(pool, datos.cliente_id))) {
    throw new ErrorClienteNoEncontrado();
  }
  if (datos.proyecto_id && !(await proyectosRepositorio.obtenerPorId(pool, datos.proyecto_id))) {
    throw new ErrorProyectoNoEncontrado();
  }
}

async function obtenerTarea(pool, id) {
  const tarea = await tareasRepositorio.obtenerPorId(pool, id);
  if (!tarea) throw new ErrorTareaNoEncontrada();
  return tarea;
}

// Tareas del usuario con los segundos que han estado en curso (horómetro).
async function listarTareas(pool, usuarioId, filtros) {
  const tareas = await tareasRepositorio.listarDeUsuario(pool, usuarioId, filtros);
  const segundos = await transiciones.segundosEnCursoPorRegistro(
    pool,
    "tarea",
    tareas.map((t) => t.id)
  );
  return tareas.map((t) => ({ ...t, segundos_en_curso: segundos[t.id] || 0 }));
}

async function crearTarea(pool, datos, usuarioId) {
  const responsableId = datos.responsable_id || usuarioId;
  await validarEnlaces(pool, { ...datos, responsable_id: responsableId });
  const id = await tareasRepositorio.crear(pool, {
    ...datos,
    responsable_id: responsableId,
    created_by: usuarioId,
  });
  const tarea = await tareasRepositorio.obtenerPorId(pool, id);
  await auditoria.registrar(pool, {
    tabla: TABLA,
    registroId: id,
    accion: "crear",
    usuarioId,
    datosAnteriores: null,
    datosNuevos: tarea,
  });
  if (responsableId !== usuarioId) {
    const prioridad = TEXTO_PRIORIDAD[tarea.prioridad];
    await notificacionesServicio.notificar(pool, {
      usuarioId: responsableId,
      tipo: "tarea_asignada",
      mensaje: `${tarea.creador_nombre} te asignó la tarea "${tarea.titulo.slice(0, 120)}"${
        tarea.prioridad !== PRIORIDADES.NORMAL ? ` (prioridad ${prioridad})` : ""
      }.`,
      enlace: enlaceTarea(id),
    });
  }
  return { ...tarea, segundos_en_curso: 0 };
}

// Cambian una tarea quien la creó y su responsable.
function exigirParticipante(tarea, usuarioId) {
  if (tarea.created_by !== usuarioId && tarea.responsable_id !== usuarioId) {
    throw new ErrorSinPermiso("Solo quien creó la tarea o su responsable pueden cambiarla.");
  }
}

async function actualizarTarea(pool, id, datos, usuarioId) {
  const anterior = await obtenerTarea(pool, id);
  exigirParticipante(anterior, usuarioId);
  await validarEnlaces(pool, datos);

  const cambios = { ...datos, updated_by: usuarioId };
  const cambiaEstado = Boolean(datos.estado) && datos.estado !== anterior.estado;
  if (
    datos.estado === ESTADOS_TRABAJO.COMPLETADA &&
    anterior.estado !== ESTADOS_TRABAJO.COMPLETADA
  ) {
    cambios.completada_por = usuarioId;
    cambios.completada_en = new Date();
  } else if (datos.estado && datos.estado !== ESTADOS_TRABAJO.COMPLETADA) {
    cambios.completada_por = null;
    cambios.completada_en = null;
  }
  if (cambiaEstado && datos.estado === ESTADOS_TRABAJO.EN_CURSO && !anterior.iniciada_en) {
    cambios.iniciada_en = new Date();
  }
  await tareasRepositorio.actualizar(pool, id, cambios);
  const actualizada = await tareasRepositorio.obtenerPorId(pool, id);

  await auditoria.registrar(pool, {
    tabla: TABLA,
    registroId: id,
    accion: "actualizar",
    usuarioId,
    datosAnteriores: anterior,
    datosNuevos: actualizada,
  });
  if (cambiaEstado) {
    await transiciones.registrar(pool, {
      entidad: "tarea",
      registroId: id,
      proyectoId: actualizada.proyecto_id,
      estadoAnterior: anterior.estado,
      estadoNuevo: actualizada.estado,
      usuarioId,
    });
  }

  // Avisos: nueva asignación y prioridad Alta o Urgente (nunca a quien cambió).
  const avisar = new Map();
  if (datos.responsable_id && datos.responsable_id !== anterior.responsable_id) {
    avisar.set(
      actualizada.responsable_id,
      `Te asignaron la tarea "${actualizada.titulo.slice(0, 120)}".`
    );
  }
  if (
    datos.prioridad &&
    datos.prioridad !== anterior.prioridad &&
    datos.prioridad !== PRIORIDADES.NORMAL
  ) {
    const texto = `La tarea "${actualizada.titulo.slice(0, 120)}" pasó a prioridad ${
      TEXTO_PRIORIDAD[actualizada.prioridad]
    }.`;
    [actualizada.responsable_id, actualizada.created_by].forEach((destino) => {
      if (!avisar.has(destino)) avisar.set(destino, texto);
    });
  }
  avisar.delete(usuarioId);
  for (const [destino, mensaje] of avisar) {
    await notificacionesServicio.notificar(pool, {
      usuarioId: destino,
      tipo: "tarea_actualizada",
      mensaje,
      enlace: enlaceTarea(id),
    });
  }

  const segundos = await transiciones.segundosEnCursoPorRegistro(pool, "tarea", [id]);
  return { ...actualizada, segundos_en_curso: segundos[id] || 0 };
}

// Una tarea (enlace de un aviso): la ven quien la creó, su responsable y
// administración / Gerencia.
async function verTarea(pool, id, usuarioId) {
  const tarea = await obtenerTarea(pool, id);
  if (tarea.created_by !== usuarioId && tarea.responsable_id !== usuarioId) {
    const usuario = await usuariosRepositorio.buscarPorId(pool, usuarioId);
    if (!esSuperusuario(usuario)) throw new ErrorTareaNoEncontrada();
  }
  const segundos = await transiciones.segundosEnCursoPorRegistro(pool, "tarea", [id]);
  return { ...tarea, segundos_en_curso: segundos[id] || 0 };
}

// La elimina quien la creó (o administración / Gerencia).
async function eliminarTarea(pool, id, usuarioId) {
  const anterior = await obtenerTarea(pool, id);
  if (anterior.created_by !== usuarioId) {
    const usuario = await usuariosRepositorio.buscarPorId(pool, usuarioId);
    if (!esSuperusuario(usuario)) {
      throw new ErrorSinPermiso("Solo quien creó la tarea puede eliminarla.");
    }
  }
  await tareasRepositorio.softDelete(pool, id);
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
  listarTareas,
  crearTarea,
  actualizarTarea,
  eliminarTarea,
  obtenerTarea,
  verTarea,
  enlaceTarea,
};
