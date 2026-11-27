const repo = require("../repositorios/tablerosOperacionRepositorio");
const tablerosRepositorio = require("../repositorios/tablerosRepositorio");
const {
  aTextoFecha,
  diasEntre,
  ultimosMeses,
  promedio,
  entradaAlEstado,
  MESES_HISTORIA,
} = require("./tableros");
const { ESTADOS: ESTADOS_PROYECTO } = require("../dominio/estadoProyecto");
const { ESTADOS: ESTADOS_EXPEDIENTE } = require("../dominio/estadoExpedienteDiseno");
const { hoyEnColombia } = require("../dominio/fechaColombia");

/* Resúmenes de solo lectura de Diseño I+D+i, Soporte técnico y Entregas y
   cierre. Siguen el patrón de los de Comercial y Compras (servicios/tableros):
   reciben "hoy" para que las pruebas fijen la fecha. */

// Mes anterior hasta el mismo día del mes (o su último día, si es más corto):
// el mes en curso va a medias y se compara contra un corte equivalente.
function corteMesAnterior(hoy) {
  const mesAnterior = aTextoFecha(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)).slice(0, 7);
  const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth(), 0).getDate();
  const dia = String(Math.min(hoy.getDate(), ultimoDia)).padStart(2, "0");
  return { mesAnterior, corte: `${mesAnterior}-${dia}` };
}

const haceUnAnio = (hoy) =>
  aTextoFecha(new Date(hoy.getFullYear() - 1, hoy.getMonth(), hoy.getDate()));

function agruparPor(lista, clave) {
  const mapa = new Map();
  lista.forEach((x) => {
    const k = x[clave];
    if (!mapa.has(k)) mapa.set(k, []);
    mapa.get(k).push(x);
  });
  return mapa;
}

/* ==================================================================
   Diseño I+D+i
   ================================================================== */
const NIVEL_RIESGO_ALTO = 10; // severidad × probabilidad (1 a 5 cada una)

function normal(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}
const esConforme = (v) => ["conforme", "si", "ok", "cumple"].includes(normal(v));
const esAprobada = (v) => ["aprobada", "aprobado"].includes(normal(v));

// Qué falta para liberar el expediente: la misma revisión, paso por paso, que
// muestra el expediente guiado (public/js/expedienteGuiado.js).
function evaluarExpediente(expediente, pasos, cambiosPendientes) {
  const de = (lista) => lista.filter((x) => x.expediente_id === expediente.id);
  const req = de(pasos.requisitos);
  const sal = de(pasos.salidas);
  const rev = de(pasos.revisiones);
  const rie = de(pasos.riesgos);
  const ver = de(pasos.verificaciones);
  const val = de(pasos.validaciones);
  const tra = de(pasos.transferencias);
  const salAprobadas = sal.filter((s) => esAprobada(s.estado)).length;
  const revCerradas = rev.filter((r) => r.cierre === "si").length;
  const verificados = req.filter((r) =>
    ver.some(
      (v) => normal(v.requisito_verificado) === normal(r.requisito) && esConforme(v.resultado)
    )
  ).length;
  const riesgosAltos = rie.filter(
    (r) =>
      (parseInt(r.severidad, 10) || 0) * (parseInt(r.probabilidad, 10) || 0) >= NIVEL_RIESGO_ALTO
  ).length;

  const pasosEvaluados = [
    { ok: req.length > 0, falta: "Requisitos de entrada" },
    {
      ok: sal.length > 0 && salAprobadas === sal.length,
      falta: sal.length ? `Salidas aprobadas (${salAprobadas}/${sal.length})` : "Salidas de diseño",
    },
    {
      ok: rev.length > 0 && revCerradas === rev.length,
      falta: rev.length
        ? `Revisiones cerradas (${revCerradas}/${rev.length})`
        : "Revisión de diseño",
    },
    { ok: rie.length > 0, falta: "Evaluar riesgos" },
    {
      ok: req.length > 0 && verificados === req.length,
      falta: req.length ? `Verificaciones (${verificados}/${req.length})` : "Verificaciones",
    },
    { ok: val.some((v) => esConforme(v.resultado)), falta: "Validación conforme" },
    {
      ok: cambiosPendientes === 0,
      falta: `${cambiosPendientes} ${cambiosPendientes === 1 ? "cambio sin decidir" : "cambios sin decidir"}`,
    },
    { ok: tra.length > 0, falta: "Transferencia a producción" },
    { ok: Boolean(expediente.numero_serie), falta: "Número de serie" },
  ];
  return {
    pasos_listos: pasosEvaluados.filter((p) => p.ok).length,
    pasos_total: pasosEvaluados.length,
    faltan: pasosEvaluados.filter((p) => !p.ok).map((p) => p.falta),
    riesgos_altos: riesgosAltos,
  };
}

async function obtenerTableroDiseno(pool, { hoy = hoyEnColombia() } = {}) {
  const hoyTexto = aTextoFecha(hoy);
  const meses = ultimosMeses(hoy, MESES_HISTORIA);
  const desde6Meses = `${meses[0]}-01`;

  const [expedientes, cambiosPendientes] = await Promise.all([
    repo.listarExpedientes(pool),
    tablerosRepositorio.listarCambiosDisenoPendientes(pool),
  ]);
  const pendientes = expedientes.filter(
    (e) => e.estado_liberacion === ESTADOS_EXPEDIENTE.PENDIENTE
  );
  const decididos = expedientes.filter((e) => e.estado_liberacion !== ESTADOS_EXPEDIENTE.PENDIENTE);
  const [pasos, cambiosLiberacion] = await Promise.all([
    repo.listarPasosDeExpedientes(
      pool,
      pendientes.map((e) => e.id)
    ),
    tablerosRepositorio.listarCambiosDeEstado(
      pool,
      "expedientes_diseno",
      decididos.map((e) => e.id),
      "estado_liberacion"
    ),
  ]);

  const cambiosPorExpediente = agruparPor(cambiosPendientes, "expediente_id");
  const filasPendientes = pendientes
    .map((e) => ({
      id: e.id,
      codigo_expediente: e.codigo_expediente,
      producto_nombre: e.producto_nombre,
      proyecto_id: e.proyecto_id,
      codigo_pry: e.codigo_pry,
      responsable: e.responsable,
      creada: e.creada,
      dias: diasEntre(e.creada, hoyTexto),
      ...evaluarExpediente(e, pasos, (cambiosPorExpediente.get(e.id) || []).length),
    }))
    .sort((a, b) => b.dias - a.dias);

  // Fecha de la decisión: el cambio auditado que llevó el expediente a su
  // resultado; sin auditoría, su última actualización.
  const porRegistro = agruparPor(cambiosLiberacion, "registro_id");
  const decisiones = decididos.map((e) => ({
    estado: e.estado_liberacion,
    fecha: entradaAlEstado(
      { creada: e.actualizada, estado: e.estado_liberacion },
      porRegistro.get(e.id)
    ),
  }));
  const decisiones6 = decisiones.filter((d) => d.fecha >= desde6Meses);
  const contar = (lista, estado) => lista.filter((d) => d.estado === estado).length;

  const cambios = cambiosPendientes
    .map((c) => ({
      id: c.id,
      expediente_id: c.expediente_id,
      codigo: `${c.codigo_expediente} · C-${String(c.numero).padStart(2, "0")}`,
      descripcion: c.descripcion || `Cambio de diseño en ${c.producto_nombre}`,
      solicitante: c.solicitante,
      creado_por: c.created_by,
      creado: c.creado,
      dias: diasEntre(c.creado, hoyTexto),
    }))
    .sort((a, b) => b.dias - a.dias);

  return {
    hoy: hoyTexto,
    kpis: {
      por_liberar: {
        cantidad: pendientes.length,
        listos: filasPendientes.filter((f) => f.faltan.length === 0).length,
        dias_mas_antiguo: filasPendientes.length ? filasPendientes[0].dias : 0,
      },
      cambios_por_decidir: {
        cantidad: cambios.length,
        dias_mas_antiguo: cambios.length ? cambios[0].dias : 0,
      },
      liberados_6m: {
        cantidad:
          contar(decisiones6, ESTADOS_EXPEDIENTE.APROBADO) +
          contar(decisiones6, ESTADOS_EXPEDIENTE.APROBADO_CON_RESTRICCIONES),
        con_restricciones: contar(decisiones6, ESTADOS_EXPEDIENTE.APROBADO_CON_RESTRICCIONES),
      },
      rechazados_6m: contar(decisiones6, ESTADOS_EXPEDIENTE.RECHAZADO),
    },
    pendientes: filasPendientes,
    cambios,
    liberaciones_por_mes: meses.map((mes) => {
      const delMes = decisiones.filter((d) => d.fecha.slice(0, 7) === mes);
      return {
        mes,
        aprobado: contar(delMes, ESTADOS_EXPEDIENTE.APROBADO),
        con_restricciones: contar(delMes, ESTADOS_EXPEDIENTE.APROBADO_CON_RESTRICCIONES),
        rechazado: contar(delMes, ESTADOS_EXPEDIENTE.RECHAZADO),
      };
    }),
  };
}

/* ==================================================================
   Soporte técnico
   ================================================================== */
const TIPOS_SERVICIO = [
  "instalacion",
  "inspeccion",
  "asistencia",
  "mantenimiento_preventivo",
  "mantenimiento_correctivo",
  "garantia",
  "validacion",
];
const TIPOS_FALLA = ["mantenimiento_correctivo", "garantia"];
const DIAS_SIN_SERVICIO = 365;
const MAX_TECNICOS = 8;
const MAX_EQUIPOS_VISITAR = 15;
const MAX_ULTIMOS_REPORTES = 10;

async function obtenerTableroSoporte(pool, { hoy = hoyEnColombia() } = {}) {
  const hoyTexto = aTextoFecha(hoy);
  const meses = ultimosMeses(hoy, MESES_HISTORIA);
  const desde6Meses = `${meses[0]}-01`;
  const desde12Meses = haceUnAnio(hoy);
  const mesActual = hoyTexto.slice(0, 7);
  const { mesAnterior, corte } = corteMesAnterior(hoy);

  // 12 meses atrás siempre es antes que el primer día de los últimos 6 meses
  const [reportes, equipos] = await Promise.all([
    repo.listarReportesDesde(pool, desde12Meses),
    repo.listarEquiposConServicio(pool),
  ]);
  const de6Meses = reportes.filter((r) => r.fecha >= desde6Meses);
  const esFalla = (r) => TIPOS_FALLA.includes(r.tipo_servicio);

  const porTecnico = [...agruparPor(de6Meses, "tecnico_id").values()]
    .map((lista) => ({ nombre: lista[0].tecnico || "Sin técnico", cantidad: lista.length }))
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, MAX_TECNICOS);

  const conDias = equipos.map((q) => {
    const base = q.ultimo_servicio || q.fecha_instalacion || q.creado;
    return { ...q, dias_sin_servicio: base ? diasEntre(base, hoyTexto) : null };
  });
  const paraVisitar = conDias
    .filter((q) => q.dias_sin_servicio !== null && q.dias_sin_servicio > DIAS_SIN_SERVICIO)
    .sort((a, b) => b.dias_sin_servicio - a.dias_sin_servicio);

  const fallas12 = reportes.filter((r) => r.fecha >= desde12Meses && esFalla(r));
  const fallasRepetidas = [...agruparPor(fallas12, "equipo_numero_serie").entries()]
    .filter(([, lista]) => lista.length >= 2)
    .map(([serie, lista]) => ({
      numero_serie: serie,
      cliente: lista[0].cliente,
      cantidad: lista.length,
      ultimo: lista[0].fecha,
    }))
    .sort((a, b) => b.cantidad - a.cantidad || b.ultimo.localeCompare(a.ultimo));

  const duraciones = de6Meses.filter((r) => r.minutos !== null).map((r) => r.minutos);
  const horasPromedio = promedio(duraciones);

  return {
    hoy: hoyTexto,
    kpis: {
      servicios_mes: {
        cantidad: reportes.filter((r) => r.fecha.slice(0, 7) === mesActual).length,
        mes_anterior_al_corte: reportes.filter(
          (r) => r.fecha.slice(0, 7) === mesAnterior && r.fecha <= corte
        ).length,
      },
      garantia_6m: {
        en_garantia: de6Meses.filter((r) => r.en_garantia).length,
        total: de6Meses.length,
      },
      fallas_6m: de6Meses.filter(esFalla).length,
      equipos_sin_servicio: { cantidad: paraVisitar.length, total: equipos.length },
      duracion_promedio_horas: {
        horas: horasPromedio === null ? null : horasPromedio / 60,
        muestras: duraciones.length,
      },
    },
    por_tipo: TIPOS_SERVICIO.map((tipo) => ({
      tipo,
      cantidad: de6Meses.filter((r) => r.tipo_servicio === tipo).length,
    })),
    por_mes: meses.map((mes) => {
      const delMes = reportes.filter((r) => r.fecha.slice(0, 7) === mes);
      return { mes, servicios: delMes.length, fallas: delMes.filter(esFalla).length };
    }),
    por_tecnico: porTecnico,
    equipos_para_visitar: paraVisitar.slice(0, MAX_EQUIPOS_VISITAR),
    fallas_repetidas: fallasRepetidas,
    ultimos_reportes: reportes.slice(0, MAX_ULTIMOS_REPORTES),
  };
}

/* ==================================================================
   Entregas y cierre
   ================================================================== */
// Fases en las que el proyecto ya debería tener su acta de entrega.
const FASES_ENTREGA = [
  ESTADOS_PROYECTO.LOGISTICA,
  ESTADOS_PROYECTO.INSTALACION,
  ESTADOS_PROYECTO.SAT,
  ESTADOS_PROYECTO.SEGUIMIENTO,
];
const MAX_ITEMS_NO_CUMPLEN = 20;

// El acta de cierre de una entrega: la que la referencia o, si el cierre no
// indica acta de entrega, uno del mismo proyecto con fecha igual o posterior.
function cierreDeEntrega(entrega, cierres) {
  return (
    cierres.find((c) => c.acta_entrega_id === entrega.id) ||
    cierres.find(
      (c) => !c.acta_entrega_id && c.proyecto_id === entrega.proyecto_id && c.fecha >= entrega.fecha
    ) ||
    null
  );
}

async function obtenerTableroEntregas(pool, { hoy = hoyEnColombia() } = {}) {
  const hoyTexto = aTextoFecha(hoy);
  const anio = hoyTexto.slice(0, 4);
  const meses = ultimosMeses(hoy, MESES_HISTORIA);
  const desde12Meses = haceUnAnio(hoy);

  const [entregas, cierres, proyectos, itemsNoCumplen] = await Promise.all([
    repo.listarActasEntrega(pool),
    repo.listarActasCierre(pool),
    repo.listarProyectosEnFases(pool, FASES_ENTREGA),
    repo.listarItemsNoCumplen(pool, desde12Meses),
  ]);

  const conCierre = entregas.map((a) => ({ ...a, cierre: cierreDeEntrega(a, cierres) }));
  const pendientesCierre = conCierre
    .filter((a) => !a.cierre)
    .map((a) => ({
      id: a.id,
      numero_acta: a.numero_acta,
      proyecto_id: a.proyecto_id,
      codigo_pry: a.codigo_pry,
      nombre_proyecto: a.nombre_proyecto,
      cliente: a.cliente,
      fecha: a.fecha,
      items_no_cumplen: a.items_no_cumplen,
      dias: diasEntre(a.fecha, hoyTexto),
    }))
    .sort((a, b) => b.dias - a.dias);
  const tiemposCierre = conCierre
    .filter((a) => a.cierre && a.cierre.fecha >= desde12Meses)
    .map((a) => diasEntre(a.fecha, a.cierre.fecha));
  const sinActa = proyectos.filter((p) => p.actas_entrega === 0);

  return {
    hoy: hoyTexto,
    kpis: {
      actas_entrega_anio: entregas.filter((a) => a.fecha.slice(0, 4) === anio).length,
      actas_cierre_anio: cierres.filter((a) => a.fecha.slice(0, 4) === anio).length,
      entregas_sin_cierre: {
        cantidad: pendientesCierre.length,
        dias_mas_antigua: pendientesCierre.length ? pendientesCierre[0].dias : 0,
      },
      proyectos_sin_acta: sinActa.length,
      items_no_cumplen_12m: itemsNoCumplen.length,
      entrega_a_cierre: { dias_promedio: promedio(tiemposCierre), muestras: tiemposCierre.length },
    },
    pendientes_cierre: pendientesCierre,
    proyectos_sin_acta: sinActa,
    actas_por_mes: meses.map((mes) => ({
      mes,
      entrega: entregas.filter((a) => a.fecha.slice(0, 7) === mes).length,
      cierre: cierres.filter((a) => a.fecha.slice(0, 7) === mes).length,
    })),
    items_no_cumplen: itemsNoCumplen.slice(0, MAX_ITEMS_NO_CUMPLEN),
  };
}

module.exports = {
  obtenerTableroDiseno,
  obtenerTableroSoporte,
  obtenerTableroEntregas,
  evaluarExpediente,
  cierreDeEntrega,
};
