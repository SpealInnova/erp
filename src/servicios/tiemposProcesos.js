const repo = require("../repositorios/tiemposRepositorio");
const transicionesRepositorio = require("../repositorios/transicionesRepositorio");
const { segundosEnCurso } = require("./transiciones");
const { ESTADOS } = require("../dominio/estadoProyecto");
const { ESTADOS_TRABAJO } = require("../dominio/trabajo");

/* Tiempos y KPI (tablero de los cargos directivos).

   No mide el tiempo conectado: mide cuánto tarda cada paso, con las
   transiciones de estado (transiciones_estado) y lo compara con el estándar,
   que son las fechas planeadas de las actividades.

   - Fase de un proyecto: real = días desde que entró hasta que salió;
     plan = de la primera fecha de inicio a la última fecha de fin de sus
     actividades. Una fase que terminó en cancelación no se cuenta.
   - Actividad o tarea: real = días desde que se inició (▶) o, si no se usó,
     desde su fecha de inicio planeada, hasta que se finalizó; plan = de su
     fecha de inicio a su fecha de fin. "Horas en curso" es el horómetro
     (tramos entre ▶ y la pausa o el fin) y "en espera" lo que estuvo abierta
     sin trabajarse (días reales menos horas en curso).
   Todo en días calendario, contando el día de inicio y el de fin. */

const UN_DIA_MS = 24 * 60 * 60 * 1000;
const PERIODOS = { trimestre: 90, anio: 365, todo: null };
const MAXIMO_LENTAS = 10;
// Fases que se miden (cerrado y cancelado no son etapas de trabajo).
const FASES = Object.values(ESTADOS).filter(
  (f) => f !== ESTADOS.CANCELADO && f !== ESTADOS.CERRADO
);

function soloFecha(valor) {
  if (!valor) return null;
  const d = new Date(valor);
  d.setHours(0, 0, 0, 0);
  return d;
}

function diasEntre(desde, hasta) {
  return Math.round((soloFecha(hasta) - soloFecha(desde)) / UN_DIA_MS);
}

function suma(valores) {
  return valores.reduce((s, v) => s + v, 0);
}

function promedio(valores) {
  return valores.length ? suma(valores) / valores.length : null;
}

function redondear(valor, decimales = 1) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return null;
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
}

function porcentaje(parte, total) {
  return total ? Math.round((parte * 100) / total) : null;
}

// Desviación frente al plan sobre pares (real, plan): +50 = tardó 50 % más.
function desviacion(pares) {
  const plan = suma(pares.map((p) => p.plan));
  return pares.length && plan > 0
    ? Math.round(((suma(pares.map((p) => p.real)) - plan) * 100) / plan)
    : null;
}

function agrupar(filas, clave) {
  const grupos = new Map();
  filas.forEach((f) => {
    const k = f[clave];
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(f);
  });
  return grupos;
}

function desdePeriodo(periodo, ahora) {
  const dias = PERIODOS[periodo];
  if (!dias) return null;
  const desde = soloFecha(ahora);
  desde.setDate(desde.getDate() - dias);
  return desde;
}

/* ---------- Fases ---------- */

// Tramos de cada proyecto en cada fase: entrada, salida (o abierto) y días.
function tramosDeFase(transiciones, ahora) {
  const tramos = [];
  agrupar(transiciones, "proyecto_id").forEach((lista) => {
    lista.forEach((t, i) => {
      if (!FASES.includes(t.estado_nuevo)) return;
      const siguiente = lista[i + 1];
      if (siguiente && siguiente.estado_nuevo === ESTADOS.CANCELADO) return;
      if (!siguiente && t.estado_proyecto !== t.estado_nuevo) return; // datos incompletos
      tramos.push({
        proyecto_id: t.proyecto_id,
        codigo_pry: t.codigo_pry,
        nombre_proyecto: t.nombre_proyecto,
        fase: t.estado_nuevo,
        salida: siguiente ? siguiente.created_at : null,
        dias: diasEntre(t.created_at, siguiente ? siguiente.created_at : ahora) + 1,
      });
    });
  });
  return tramos;
}

function resumirFases(tramos, planes, desde) {
  return FASES.map((fase) => {
    const deFase = tramos.filter((t) => t.fase === fase);
    const plan = (t) => planes.get(`${t.proyecto_id}|${fase}`) || null;
    const cerrados = deFase.filter((t) => t.salida && (!desde || new Date(t.salida) >= desde));
    const abiertos = deFase.filter((t) => !t.salida).sort((a, b) => b.dias - a.dias);
    const pares = cerrados.filter(plan).map((t) => ({ real: t.dias, plan: plan(t) }));
    const masTiempo = abiertos[0];
    return {
      fase,
      cerrados: cerrados.length,
      real_promedio_dias: redondear(promedio(cerrados.map((t) => t.dias))),
      plan_promedio_dias: redondear(promedio(cerrados.map(plan).filter(Boolean))),
      comparados: pares.length,
      desviacion_pct: desviacion(pares),
      en_fase_ahora: abiertos.length,
      mas_tiempo_ahora: masTiempo
        ? {
            proyecto_id: masTiempo.proyecto_id,
            codigo_pry: masTiempo.codigo_pry,
            dias: masTiempo.dias,
            plan_dias: plan(masTiempo),
          }
        : null,
    };
  });
}

/* ---------- Actividades y tareas ---------- */

// Medidas de un trabajo (actividad o tarea) a partir de sus fechas y de sus
// transiciones de estado.
function medir(item, transiciones, ahora) {
  const hoy = soloFecha(ahora);
  const finalizada = item.estado === ESTADOS_TRABAJO.COMPLETADA && Boolean(item.completada_en);
  const plan =
    item.fecha_inicio && item.fecha_fin ? diasEntre(item.fecha_inicio, item.fecha_fin) + 1 : null;
  const inicio = item.iniciada_en || item.fecha_inicio || (finalizada ? item.created_at : null);
  let real = null;
  if (inicio && (finalizada || soloFecha(inicio) <= hoy)) {
    real = Math.max(1, diasEntre(inicio, finalizada ? item.completada_en : ahora) + 1);
  }
  const horas = segundosEnCurso(transiciones, ahora) / 3600;
  return {
    finalizada,
    plan,
    real,
    a_tiempo:
      finalizada && item.fecha_fin
        ? soloFecha(item.completada_en) <= soloFecha(item.fecha_fin)
        : null,
    vencida: !finalizada && Boolean(item.fecha_fin) && soloFecha(item.fecha_fin) < hoy,
    retraso_inicio:
      item.iniciada_en && item.fecha_inicio ? diasEntre(item.fecha_inicio, item.iniciada_en) : null,
    con_horometro: Boolean(item.iniciada_en),
    horas_en_curso: horas,
    espera_dias: item.iniciada_en && real ? Math.max(0, real - horas / 24) : null,
  };
}

function indicadores(medidas) {
  const finalizadas = medidas.filter((m) => m.finalizada);
  const conFin = finalizadas.filter((m) => m.a_tiempo !== null);
  const conHorometro = finalizadas.filter((m) => m.con_horometro);
  const pares = finalizadas
    .filter((m) => m.plan && m.real)
    .map((m) => ({ real: m.real, plan: m.plan }));
  const retrasos = medidas.map((m) => m.retraso_inicio).filter((v) => v !== null);
  return {
    finalizadas: finalizadas.length,
    abiertas: medidas.length - finalizadas.length,
    vencidas: medidas.filter((m) => m.vencida).length,
    a_tiempo_pct: porcentaje(conFin.filter((m) => m.a_tiempo).length, conFin.length),
    plan_promedio_dias: redondear(promedio(finalizadas.map((m) => m.plan).filter(Boolean))),
    real_promedio_dias: redondear(promedio(finalizadas.map((m) => m.real).filter(Boolean))),
    desviacion_pct: desviacion(pares),
    retraso_inicio_promedio_dias: redondear(promedio(retrasos)),
    horas_en_curso_promedio: redondear(promedio(conHorometro.map((m) => m.horas_en_curso))),
    espera_promedio_dias: redondear(
      promedio(conHorometro.map((m) => m.espera_dias).filter((v) => v !== null))
    ),
    con_horometro: conHorometro.length,
  };
}

function porRegistro(transiciones) {
  return agrupar(transiciones, "registro_id");
}

async function obtenerTiemposProcesos(pool, { periodo = "trimestre", ahora = new Date() } = {}) {
  const desde = desdePeriodo(periodo, ahora);
  const [transProyectos, planes, actividades, tareas] = await Promise.all([
    repo.transicionesDeProyectos(pool),
    repo.planPorFase(pool),
    repo.actividades(pool, desde),
    repo.tareasFinalizadas(pool, desde),
  ]);
  const [transActividades, transTareas] = await Promise.all([
    transicionesRepositorio.listarPorRegistros(
      pool,
      "actividad",
      actividades.map((a) => a.id)
    ),
    transicionesRepositorio.listarPorRegistros(
      pool,
      "tarea",
      tareas.map((t) => t.id)
    ),
  ]);

  // Fases
  const mapaPlanes = new Map(
    planes.map((p) => [`${p.proyecto_id}|${p.fase}`, diasEntre(p.plan_inicio, p.plan_fin) + 1])
  );
  const fases = resumirFases(tramosDeFase(transProyectos, ahora), mapaPlanes, desde);

  // Actividades por categoría
  const transPorActividad = porRegistro(transActividades);
  const medidas = actividades.map((a) => ({
    ...a,
    ...medir(a, transPorActividad.get(a.id) || [], ahora),
  }));
  const categorias = [...agrupar(medidas, "categoria")]
    .map(([categoria, lista]) => ({ categoria, ...indicadores(lista) }))
    .sort(
      (a, b) =>
        (b.desviacion_pct ?? -Infinity) - (a.desviacion_pct ?? -Infinity) ||
        b.finalizadas - a.finalizadas
    );

  // Las más demoradas frente a su plan (finalizadas en el periodo o abiertas)
  const lentas = medidas
    .filter((m) => m.plan && m.real && m.real > m.plan)
    .map((m) => ({
      id: m.id,
      proyecto_id: m.proyecto_id,
      codigo_pry: m.codigo_pry,
      descripcion: m.descripcion,
      categoria: m.categoria,
      fase: m.fase,
      plan_dias: m.plan,
      real_dias: m.real,
      exceso_dias: m.real - m.plan,
      finalizada: m.finalizada,
      enlace: `#/proyectos/${m.proyecto_id}/actividades/${m.id}`,
    }))
    .sort((a, b) => b.exceso_dias - a.exceso_dias || b.real_dias - a.real_dias)
    .slice(0, MAXIMO_LENTAS);

  // Tareas fuera de proyectos
  const transPorTarea = porRegistro(transTareas);
  const resumenTareas = indicadores(
    tareas.map((t) => medir({ ...t, estado: "completada" }, transPorTarea.get(t.id) || [], ahora))
  );

  const general = indicadores(medidas);
  const conDesviacion = fases.filter((f) => f.desviacion_pct !== null);
  const faseMasLenta = conDesviacion.sort((a, b) => b.desviacion_pct - a.desviacion_pct)[0];
  return {
    periodo,
    desde,
    resumen: {
      actividades_finalizadas: general.finalizadas,
      a_tiempo_pct: general.a_tiempo_pct,
      desviacion_pct: general.desviacion_pct,
      abiertas_vencidas: general.vencidas,
      fase_mas_lenta: faseMasLenta
        ? { fase: faseMasLenta.fase, desviacion_pct: faseMasLenta.desviacion_pct }
        : null,
    },
    fases,
    categorias,
    lentas,
    tareas: resumenTareas,
  };
}

module.exports = { obtenerTiemposProcesos, PERIODOS, medir, tramosDeFase };
