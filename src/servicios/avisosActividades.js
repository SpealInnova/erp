const proyectoActividadesRepositorio = require("../repositorios/proyectoActividadesRepositorio");
const notificacionesRepositorio = require("../repositorios/notificacionesRepositorio");
const notificacionesServicio = require("./notificaciones");
const tareasRepositorio = require("../repositorios/tareasRepositorio");
const transiciones = require("./transiciones");

// "Por vencer": vence hoy o en los próximos DIAS_AVISO días.
const DIAS_AVISO = 3;
// Se avisa de una vencida solo si venció hace DIAS_VENCIDA días o menos: al
// desplegar no llega un aviso por cada actividad atrasada de hace meses
// (esas siguen a la vista en "Actividades pendientes").
const DIAS_VENCIDA = 7;
// Un aviso por actividad y tipo mientras dure su ventana.
const VIGENCIA_DIAS = {
  actividad_por_vencer: DIAS_AVISO + 1,
  actividad_vencida: DIAS_VENCIDA + 1,
};
const SEIS_HORAS_MS = 6 * 60 * 60 * 1000;
const LARGO_MAXIMO_DESCRIPCION = 120; // notificaciones.mensaje es VARCHAR(255)

function enlaceActividad(actividad) {
  return `#/proyectos/${actividad.proyecto_id}/actividades/${actividad.id}`;
}

function fechaTexto(valor) {
  const d = new Date(valor);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function cuandoVence(dias, fecha) {
  if (dias < -1) return `venció el ${fecha} (hace ${-dias} días)`;
  if (dias === -1) return `venció ayer (${fecha})`;
  if (dias === 0) return "vence hoy";
  if (dias === 1) return "vence mañana";
  return `vence el ${fecha} (en ${dias} días)`;
}

function mensajeAvisoTarea(tarea) {
  const titulo =
    tarea.titulo.length > LARGO_MAXIMO_DESCRIPCION
      ? `${tarea.titulo.slice(0, LARGO_MAXIMO_DESCRIPCION - 1)}…`
      : tarea.titulo;
  return `La tarea "${titulo}" ${cuandoVence(Number(tarea.dias_restantes), fechaTexto(tarea.fecha_fin))}.`;
}

function mensajeAviso(actividad) {
  const descripcion =
    actividad.descripcion.length > LARGO_MAXIMO_DESCRIPCION
      ? `${actividad.descripcion.slice(0, LARGO_MAXIMO_DESCRIPCION - 1)}…`
      : actividad.descripcion;
  const dias = Number(actividad.dias_restantes);
  return `La actividad "${descripcion}" del proyecto ${actividad.codigo_pry} ${cuandoVence(
    dias,
    fechaTexto(actividad.fecha_fin)
  )}.`;
}

// Crea las notificaciones de actividades por vencer o recién vencidas que
// aún no se avisaron. Con usuarioId, solo las de ese usuario. Es
// idempotente: se puede llamar cuantas veces se quiera.
async function generarAvisosVencimiento(pool, { usuarioId } = {}) {
  const candidatas = await proyectoActividadesRepositorio.listarParaAviso(pool, {
    diasAviso: DIAS_AVISO,
    diasVencida: DIAS_VENCIDA,
    usuarioId,
  });
  const tareas = await tareasRepositorio.listarParaAviso(pool, {
    diasAviso: DIAS_AVISO,
    diasVencida: DIAS_VENCIDA,
    usuarioId,
  });
  const todas = [
    ...candidatas.map((a) => ({ ...a, enlace: enlaceActividad(a), mensaje: mensajeAviso(a) })),
    ...tareas.map((t) => ({ ...t, enlace: `#/tareas/${t.id}`, mensaje: mensajeAvisoTarea(t) })),
  ];
  let creadas = 0;
  for (const actividad of todas) {
    const tipo =
      Number(actividad.dias_restantes) < 0 ? "actividad_vencida" : "actividad_por_vencer";
    const { enlace } = actividad;
    const yaAvisada = await notificacionesRepositorio.existeReciente(pool, {
      usuarioId: actividad.destinatario_id,
      tipo,
      enlace,
      dias: VIGENCIA_DIAS[tipo],
    });
    if (yaAvisada) continue;
    // Solo en la aplicación (campana): staging usa una BD con usuarios
    // reales y no debe mandarles correos.
    await notificacionesServicio.notificar(pool, {
      usuarioId: actividad.destinatario_id,
      tipo,
      mensaje: actividad.mensaje,
      enlace,
    });
    creadas += 1;
  }
  return creadas;
}

// Actividades pendientes del usuario para la ventana "Actividades
// pendientes". De paso pone al día sus avisos: así llegan aunque el
// proceso periódico no haya corrido (p. ej. tras un reinicio del hosting).
async function listarMisActividades(pool, usuarioId) {
  await generarAvisosVencimiento(pool, { usuarioId });
  const [actividades, tareas] = await Promise.all([
    proyectoActividadesRepositorio.listarPendientesDeUsuario(pool, usuarioId),
    tareasRepositorio.listarDeUsuario(pool, usuarioId, { origen: "todas", estado: "abiertas" }),
  ]);
  // horómetro: segundos en curso de cada actividad
  const segundos = await transiciones.segundosEnCursoPorRegistro(
    pool,
    "actividad",
    actividades.map((a) => a.id)
  );
  return {
    actividades: actividades.map((a) => ({ ...a, segundos_en_curso: segundos[a.id] || 0 })),
    // solo las tareas de las que es responsable
    tareas: tareas.filter((t) => t.responsable_id === usuarioId),
    dias_aviso: DIAS_AVISO,
  };
}

// Revisión periódica para todos los usuarios (la llama index.js al arrancar).
function programarAvisos(pool, { cadaMs = SEIS_HORAS_MS, retrasoInicialMs = 30000 } = {}) {
  const ejecutar = () =>
    generarAvisosVencimiento(pool)
      .then((n) => {
        if (n > 0) console.log(`Avisos de vencimiento: ${n} notificaciones nuevas.`);
      })
      .catch((error) => {
        console.error("No se pudieron generar los avisos de vencimiento:", error.message);
      });
  const inicial = setTimeout(ejecutar, retrasoInicialMs);
  const periodico = setInterval(ejecutar, cadaMs);
  inicial.unref();
  periodico.unref();
  return () => {
    clearTimeout(inicial);
    clearInterval(periodico);
  };
}

module.exports = {
  DIAS_AVISO,
  DIAS_VENCIDA,
  generarAvisosVencimiento,
  listarMisActividades,
  programarAvisos,
  mensajeAviso,
};
