const tablerosRepositorio = require("../repositorios/tablerosRepositorio");
const { ESTADOS: ESTADOS_PROYECTO } = require("../dominio/estadoProyecto");
const { ESTADOS: ESTADOS_COTIZACION } = require("../dominio/estadoCotizacion");

// Fases en ejecución, en el orden del flujo. "Prospecto" todavía no es un
// proyecto en curso y "cerrado"/"cancelado" ya terminaron.
const FASES_ACTIVAS = [
  ESTADOS_PROYECTO.PLANEACION,
  ESTADOS_PROYECTO.DISENO,
  ESTADOS_PROYECTO.COMPRAS,
  ESTADOS_PROYECTO.PRODUCCION,
  ESTADOS_PROYECTO.CALIDAD_FAT,
  ESTADOS_PROYECTO.LOGISTICA,
  ESTADOS_PROYECTO.INSTALACION,
  ESTADOS_PROYECTO.SAT,
  ESTADOS_PROYECTO.SEGUIMIENTO,
];
const ESTADOS_TERMINADOS = [ESTADOS_PROYECTO.CERRADO, ESTADOS_PROYECTO.CANCELADO];
const ESTADOS_COTIZACION_ABIERTA = [
  ESTADOS_COTIZACION.BORRADOR,
  ESTADOS_COTIZACION.REVISION,
  ESTADOS_COTIZACION.APROBACION,
  ESTADOS_COTIZACION.ENVIADA,
];
const MESES_HISTORIA = 6;
const MAX_RESPONSABLES = 8;

function aTextoFecha(fecha) {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function diasEntre(desdeTexto, hastaTexto) {
  const [y1, m1, d1] = desdeTexto.split("-").map(Number);
  const [y2, m2, d2] = hastaTexto.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

// Últimos N meses calendario terminando en el mes de "hoy", como 'YYYY-MM'.
function ultimosMeses(hoy, cantidad) {
  const meses = [];
  for (let i = cantidad - 1; i >= 0; i -= 1) {
    const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    meses.push(aTextoFecha(fecha).slice(0, 7));
  }
  return meses;
}

function armarCartera(filas, comprometidoPorProyecto, hoyTexto) {
  return filas.map((p) => {
    const progreso =
      p.actividades_total > 0
        ? Math.round((p.actividades_completadas / p.actividades_total) * 100)
        : 0;
    return {
      ...p,
      progreso,
      comprometido: comprometidoPorProyecto.get(p.id) || 0,
      vencido: Boolean(p.fecha_fin && p.fecha_fin < hoyTexto),
    };
  });
}

function armarCotizacionesPorMes(cotizaciones, meses) {
  const porMes = new Map(meses.map((m) => [m, { mes: m, cotizado: 0, aceptado: 0, cantidad: 0 }]));
  cotizaciones.forEach((c) => {
    const fila = porMes.get(c.creada.slice(0, 7));
    if (!fila) return;
    fila.cotizado += c.valor;
    fila.cantidad += 1;
    if (c.estado === ESTADOS_COTIZACION.ACEPTADA) fila.aceptado += c.valor;
  });
  return [...porMes.values()];
}

function armarAprobaciones(ordenes, cambios, cotizaciones, hoyTexto) {
  const deOrdenes = ordenes.map((o) => ({
    tipo: "orden_compra",
    id: o.id,
    codigo: o.numero_oc,
    titulo: o.primer_item
      ? `${o.primer_item}${o.items > 1 ? ` y ${o.items - 1} ítem(s) más` : ""}`
      : "Orden de compra sin ítems",
    detalle: `${o.proveedor} · ${o.codigo_pry}`,
    valor: o.valor,
    creado: o.creada,
    dias: diasEntre(o.creada, hoyTexto),
  }));
  const deCambios = cambios.map((c) => ({
    tipo: "cambio_diseno",
    id: c.id,
    expediente_id: c.expediente_id,
    codigo: `${c.codigo_expediente} · C-${String(c.numero).padStart(2, "0")}`,
    titulo: c.descripcion || `Cambio de diseño en ${c.producto_nombre}`,
    detalle: c.solicitante ? `Solicitado por ${c.solicitante}` : c.producto_nombre,
    valor: null,
    creado: c.creado,
    dias: diasEntre(c.creado, hoyTexto),
  }));
  const deCotizaciones = cotizaciones
    .filter((c) => c.estado === ESTADOS_COTIZACION.APROBACION)
    .map((c) => ({
      tipo: "cotizacion",
      id: c.id,
      codigo: c.numero_cotizacion,
      titulo: "Cotización en aprobación",
      detalle: c.cliente,
      valor: c.valor,
      creado: c.actualizada,
      dias: diasEntre(c.actualizada, hoyTexto),
    }));
  return [...deOrdenes, ...deCambios, ...deCotizaciones].sort((a, b) => b.dias - a.dias);
}

async function obtenerTableroGerencial(pool, { hoy = new Date() } = {}) {
  const hoyTexto = aTextoFecha(hoy);
  const [
    conteoEstados,
    carteraFilas,
    comprometido,
    cotizaciones,
    ordenes,
    cambios,
    expedientesSinLiberar,
    carga,
  ] = await Promise.all([
    tablerosRepositorio.contarProyectosPorEstado(pool),
    tablerosRepositorio.listarCarteraProyectos(pool, FASES_ACTIVAS),
    tablerosRepositorio.sumarComprometidoPorProyecto(pool),
    tablerosRepositorio.listarCotizacionesConValor(pool),
    tablerosRepositorio.listarOrdenesPorAprobar(pool),
    tablerosRepositorio.listarCambiosDisenoPendientes(pool),
    tablerosRepositorio.contarExpedientesSinLiberar(pool),
    tablerosRepositorio.contarActividadesAbiertasPorResponsable(pool, ESTADOS_TERMINADOS),
  ]);

  const cartera = armarCartera(carteraFilas, comprometido, hoyTexto);
  const cantidadPorEstado = new Map(conteoEstados.map((e) => [e.estado, e.cantidad]));
  const abiertas = cotizaciones.filter((c) => ESTADOS_COTIZACION_ABIERTA.includes(c.estado));
  const vencidos = cartera.filter((p) => p.vencido);
  const sumar = (lista, campo) => lista.reduce((t, x) => t + (Number(x[campo]) || 0), 0);

  return {
    hoy: hoyTexto,
    kpis: {
      proyectos_activos: cartera.length,
      proyectos_prospecto: cantidadPorEstado.get(ESTADOS_PROYECTO.PROSPECTO) || 0,
      presupuesto_activo: sumar(cartera, "presupuesto_estimado"),
      comprometido_activo: sumar(cartera, "comprometido"),
      cotizaciones_abiertas: { cantidad: abiertas.length, valor: sumar(abiertas, "valor") },
      oc_por_aprobar: {
        cantidad: ordenes.length,
        valor: sumar(ordenes, "valor"),
        dias_mas_antigua: ordenes.length ? diasEntre(ordenes[0].creada, hoyTexto) : 0,
      },
      expedientes_sin_liberar: expedientesSinLiberar,
      proyectos_vencidos: { cantidad: vencidos.length, codigos: vencidos.map((p) => p.codigo_pry) },
    },
    cartera,
    proyectos_por_fase: FASES_ACTIVAS.map((estado) => ({
      estado,
      cantidad: cantidadPorEstado.get(estado) || 0,
    })),
    cotizaciones_por_mes: armarCotizacionesPorMes(cotizaciones, ultimosMeses(hoy, MESES_HISTORIA)),
    carga_por_responsable: carga.filter((c) => c.usuario_id).slice(0, MAX_RESPONSABLES),
    actividades_sin_responsable: sumar(
      carga.filter((c) => !c.usuario_id),
      "abiertas"
    ),
    aprobaciones: armarAprobaciones(ordenes, cambios, cotizaciones, hoyTexto),
  };
}

module.exports = { obtenerTableroGerencial, FASES_ACTIVAS };
