const proyectosRepositorio = require("../repositorios/proyectosRepositorio");
const proyectoActividadesRepositorio = require("../repositorios/proyectoActividadesRepositorio");
const transicionesRepositorio = require("../repositorios/transicionesRepositorio");
const { ESTADOS } = require("../dominio/estadoProyecto");
const { ESTADOS_TRABAJO, PRIORIDADES } = require("../dominio/trabajo");
const { ErrorProyectoNoEncontrado } = require("../dominio/erroresProyectos");

const UN_DIA_MS = 24 * 60 * 60 * 1000;
const DIAS_POR_VENCER = 3;
// Fases en el orden del flujo (cancelado no es una etapa).
const FASES = Object.values(ESTADOS).filter((f) => f !== ESTADOS.CANCELADO);

function soloFecha(valor) {
  if (!valor) return null;
  const d = new Date(valor);
  d.setHours(0, 0, 0, 0);
  return d;
}

function diasEntre(desde, hasta) {
  return Math.round((soloFecha(hasta) - soloFecha(desde)) / UN_DIA_MS);
}

// Entrada y salida de cada fase según las transiciones del proyecto.
function periodosDeFase(transicionesProyecto) {
  const periodos = {};
  transicionesProyecto.forEach((t, i) => {
    if (!periodos[t.estado_nuevo]) {
      const siguiente = transicionesProyecto[i + 1];
      periodos[t.estado_nuevo] = {
        entrada: t.created_at,
        salida: siguiente ? siguiente.created_at : null,
      };
    }
  });
  return periodos;
}

// Resumen de cada etapa del proyecto: plan (fechas de sus actividades),
// tiempo real en la fase, avance, prioridades, vencimientos y evidencias.
async function obtenerResumenEtapas(pool, proyectoId, ahora = new Date()) {
  const proyecto = await proyectosRepositorio.obtenerPorId(pool, proyectoId);
  if (!proyecto) throw new ErrorProyectoNoEncontrado();

  const [actividades, transiciones, evidencias] = await Promise.all([
    proyectoActividadesRepositorio.listarPorProyecto(pool, proyectoId),
    transicionesRepositorio.listarPorProyecto(pool, proyectoId),
    proyectoActividadesRepositorio.contarEvidenciasPorFase(pool, proyectoId),
  ]);
  const periodos = periodosDeFase(transiciones.filter((t) => t.entidad === "proyecto"));
  const hoy = soloFecha(ahora);
  const indiceActual = FASES.indexOf(proyecto.estado);

  const etapas = FASES.map((fase, indice) => {
    const deFase = actividades.filter((a) => a.fase === fase);
    const abiertas = deFase.filter((a) => a.estado !== ESTADOS_TRABAJO.COMPLETADA);
    const inicios = deFase
      .map((a) => a.fecha_inicio)
      .filter(Boolean)
      .map(soloFecha);
    const fines = deFase
      .map((a) => a.fecha_fin)
      .filter(Boolean)
      .map(soloFecha);
    const planInicio = inicios.length ? new Date(Math.min(...inicios)) : null;
    const planFin = fines.length ? new Date(Math.max(...fines)) : null;
    const periodo = periodos[fase] || null;
    let estado = "por_iniciar";
    if (proyecto.estado === ESTADOS.CANCELADO) estado = periodo ? "completada" : "por_iniciar";
    else if (indice < indiceActual) estado = "completada";
    else if (indice === indiceActual) estado = "en_curso";

    return {
      fase,
      estado,
      plan_inicio: planInicio,
      plan_fin: planFin,
      plan_dias: planInicio && planFin ? diasEntre(planInicio, planFin) + 1 : null,
      entrada: periodo ? periodo.entrada : null,
      salida: periodo ? periodo.salida : null,
      dias_en_fase: periodo ? diasEntre(periodo.entrada, periodo.salida || ahora) + 1 : null,
      actividades_total: deFase.length,
      actividades_finalizadas: deFase.length - abiertas.length,
      actividades_en_curso: abiertas.filter((a) => a.estado === ESTADOS_TRABAJO.EN_CURSO).length,
      urgentes: abiertas.filter((a) => a.prioridad === PRIORIDADES.URGENTE).length,
      altas: abiertas.filter((a) => a.prioridad === PRIORIDADES.ALTA).length,
      vencidas: abiertas.filter((a) => a.fecha_fin && soloFecha(a.fecha_fin) < hoy).length,
      por_vencer: abiertas.filter((a) => {
        if (!a.fecha_fin) return false;
        const dias = diasEntre(hoy, a.fecha_fin);
        return dias >= 0 && dias <= DIAS_POR_VENCER;
      }).length,
      evidencias: evidencias[fase] || 0,
    };
  });

  return { fase_actual: proyecto.estado, etapas, transiciones };
}

module.exports = { obtenerResumenEtapas, periodosDeFase };
