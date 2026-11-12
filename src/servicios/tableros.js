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

/* ==================================================================
   Comercial
   ================================================================== */
const DIAS_CERRADAS_EN_EMBUDO = 30;
const DIAS_AVISO_VIGENCIA = 7;
const DIAS_SIN_MOVIMIENTO = 90;
const MAX_CLIENTES_GRAFICA = 8;

function diasParaVencer(cotizacion, hoyTexto) {
  return cotizacion.fecha_validez ? diasEntre(hoyTexto, cotizacion.fecha_validez) : null;
}

// Qué hacer con cada cliente, en orden de urgencia.
function seguimientoCliente(cliente, cotizacionesCliente, hoyTexto) {
  const enviadas = cotizacionesCliente
    .filter((c) => c.estado === ESTADOS_COTIZACION.ENVIADA && c.dias_para_vencer !== null)
    .sort((a, b) => a.dias_para_vencer - b.dias_para_vencer);
  const vencida = enviadas.find((c) => c.dias_para_vencer < 0);
  if (vencida) return { tipo: "crit", texto: "Vigencia vencida" };
  const porVencer = enviadas.find((c) => c.dias_para_vencer <= DIAS_AVISO_VIGENCIA);
  if (porVencer) {
    const n = porVencer.dias_para_vencer;
    return { tipo: "warn", texto: n === 0 ? "Vigencia vence hoy" : `Vigencia vence en ${n} días` };
  }
  const tiene = (estado) => cotizacionesCliente.some((c) => c.estado === estado);
  if (tiene(ESTADOS_COTIZACION.APROBACION))
    return { tipo: "info", texto: "Cotización en aprobación" };
  if (tiene(ESTADOS_COTIZACION.REVISION)) return { tipo: "info", texto: "Cotización en revisión" };
  if (tiene(ESTADOS_COTIZACION.ENVIADA)) return { tipo: "info", texto: "Cotización enviada" };
  if (tiene(ESTADOS_COTIZACION.BORRADOR)) return { tipo: "mute", texto: "Cotización en borrador" };
  if (diasEntre(cliente.ultima_actividad, hoyTexto) > DIAS_SIN_MOVIMIENTO) {
    return { tipo: "mute", texto: `Sin movimiento en ${DIAS_SIN_MOVIMIENTO} días` };
  }
  return { tipo: "good", texto: "Al día" };
}

async function obtenerTableroComercial(pool, { hoy = new Date() } = {}) {
  const hoyTexto = aTextoFecha(hoy);
  const anio = hoyTexto.slice(0, 4);
  const mesActual = hoyTexto.slice(0, 7);
  const mesAnterior = aTextoFecha(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)).slice(0, 7);
  // El mes en curso va a medias: se compara contra el mes anterior hasta el
  // mismo día (o su último día, si es más corto), no contra el mes completo.
  const ultimoDiaMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0).getDate();
  const corteMesAnterior = `${mesAnterior}-${String(
    Math.min(hoy.getDate(), ultimoDiaMesAnterior)
  ).padStart(2, "0")}`;
  const meses = ultimosMeses(hoy, MESES_HISTORIA);

  const [filasCotizaciones, clientes] = await Promise.all([
    tablerosRepositorio.listarCotizacionesConValor(pool),
    tablerosRepositorio.listarClientesConActividad(pool, ESTADOS_TERMINADOS),
  ]);
  const cotizaciones = filasCotizaciones.map((c) => ({
    ...c,
    dias_para_vencer: diasParaVencer(c, hoyTexto),
  }));
  const sumar = (lista) => lista.reduce((t, c) => t + c.valor, 0);
  const esAbierta = (c) => ESTADOS_COTIZACION_ABIERTA.includes(c.estado);
  const esDecidida = (c) =>
    c.estado === ESTADOS_COTIZACION.ACEPTADA || c.estado === ESTADOS_COTIZACION.RECHAZADA;

  const abiertas = cotizaciones.filter(esAbierta);
  const enviadas = cotizaciones.filter(
    (c) => c.estado === ESTADOS_COTIZACION.ENVIADA && c.dias_para_vencer !== null
  );
  const decididas6 = cotizaciones.filter((c) => esDecidida(c) && c.creada.slice(0, 7) >= meses[0]);
  // la fecha de la última actualización es la de la decisión: una cotización
  // aceptada o rechazada ya no admite más transiciones
  const aceptadasAnio = cotizaciones.filter(
    (c) => c.estado === ESTADOS_COTIZACION.ACEPTADA && c.actualizada.slice(0, 4) === anio
  );

  const porCliente = new Map();
  cotizaciones.forEach((c) => {
    if (!porCliente.has(c.cliente_id)) porCliente.set(c.cliente_id, []);
    porCliente.get(c.cliente_id).push(c);
  });

  const valorAceptadoPorCliente = new Map();
  aceptadasAnio.forEach((c) =>
    valorAceptadoPorCliente.set(
      c.cliente_id,
      (valorAceptadoPorCliente.get(c.cliente_id) || 0) + c.valor
    )
  );

  const tablaClientes = clientes.map((cl) => {
    const propias = porCliente.get(cl.id) || [];
    return {
      id: cl.id,
      nombre: cl.nombre,
      identificacion: `${cl.tipo_identificacion} ${cl.numero_identificacion}`,
      ciudad: cl.ciudad,
      proyectos_activos: cl.proyectos_activos,
      cotizaciones_abiertas: propias.filter(esAbierta).length,
      valor_aceptado_anio: valorAceptadoPorCliente.get(cl.id) || 0,
      ultima_actividad: cl.ultima_actividad,
      seguimiento: seguimientoCliente(cl, propias, hoyTexto),
    };
  });

  const clientesActivos = tablaClientes.filter(
    (cl) =>
      cl.proyectos_activos > 0 ||
      (porCliente.get(cl.id) || []).some((c) => c.creada.slice(0, 4) === anio)
  );

  return {
    hoy: hoyTexto,
    kpis: {
      cotizado_mes: sumar(cotizaciones.filter((c) => c.creada.slice(0, 7) === mesActual)),
      cotizado_mes_anterior_al_corte: sumar(
        cotizaciones.filter(
          (c) => c.creada.slice(0, 7) === mesAnterior && c.creada <= corteMesAnterior
        )
      ),
      aceptacion: {
        aceptadas: decididas6.filter((c) => c.estado === ESTADOS_COTIZACION.ACEPTADA).length,
        decididas: decididas6.length,
      },
      abiertas: { cantidad: abiertas.length, valor: sumar(abiertas) },
      vigencias: {
        por_vencer: enviadas.filter(
          (c) => c.dias_para_vencer >= 0 && c.dias_para_vencer <= DIAS_AVISO_VIGENCIA
        ).length,
        vencen_hoy: enviadas.filter((c) => c.dias_para_vencer === 0).length,
        vencidas: enviadas.filter((c) => c.dias_para_vencer < 0).length,
      },
      clientes_activos: clientesActivos.length,
      clientes_nuevos_anio: clientes.filter((c) => c.creado.slice(0, 4) === anio).length,
      ticket_promedio: {
        valor: aceptadasAnio.length ? sumar(aceptadasAnio) / aceptadasAnio.length : 0,
        cantidad: aceptadasAnio.length,
      },
    },
    embudo: cotizaciones.filter(
      (c) =>
        esAbierta(c) ||
        (esDecidida(c) && diasEntre(c.actualizada, hoyTexto) <= DIAS_CERRADAS_EN_EMBUDO)
    ),
    cotizaciones_por_mes: armarCotizacionesPorMes(cotizaciones, meses),
    clientes_por_valor: [...valorAceptadoPorCliente.entries()]
      .map(([clienteId, valor]) => ({
        cliente_id: clienteId,
        nombre: clientes.find((c) => c.id === clienteId)?.nombre || "",
        valor,
      }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, MAX_CLIENTES_GRAFICA),
    vigencias: [...enviadas].sort((a, b) => a.dias_para_vencer - b.dias_para_vencer),
    clientes: tablaClientes,
  };
}

/* ==================================================================
   Compras
   ================================================================== */
const ESTADOS_REQ = {
  SOLICITADA: "solicitada",
  EN_COTIZACION: "en_cotizacion",
  CERRADA: "cerrada",
};
const ESTADOS_OC = {
  PTE_APROBAR: "pte_aprobar",
  APROBADA_PTE_PAGO: "aprobada_pte_pago",
  PAGA: "paga",
  CONTABILIZADA: "contabilizada",
};
const UMBRAL_PROVEEDOR = 80;
const MAX_PROVEEDORES = 10;
const MAX_REQUISICIONES = 20;
const MAX_PRESUPUESTOS = 8;

// Fecha en que el documento entró a su estado actual: el último cambio de
// estado auditado que lo llevó allí; si no hay, su fecha de creación.
function entradaAlEstado(doc, cambios = []) {
  let fecha = doc.creada;
  cambios.forEach((c) => {
    if (c.estado_nuevo === doc.estado && c.estado_anterior !== doc.estado) fecha = c.fecha;
  });
  return fecha;
}

function agruparPorRegistro(cambios) {
  const mapa = new Map();
  cambios.forEach((c) => {
    if (!mapa.has(c.registro_id)) mapa.set(c.registro_id, []);
    mapa.get(c.registro_id).push(c);
  });
  return mapa;
}

function promedio(valores) {
  return valores.length ? valores.reduce((t, v) => t + v, 0) / valores.length : null;
}

async function obtenerTableroCompras(pool, { hoy = new Date() } = {}) {
  const hoyTexto = aTextoFecha(hoy);
  const anio = hoyTexto.slice(0, 4);
  const desde6Meses = `${ultimosMeses(hoy, MESES_HISTORIA)[0]}-01`;

  const [filasReq, filasOC, proveedores, totalProveedores, presupuestos] = await Promise.all([
    tablerosRepositorio.listarRequisiciones(pool),
    tablerosRepositorio.listarOrdenesCompra(pool),
    tablerosRepositorio.listarProveedoresCalificados(pool),
    tablerosRepositorio.contarProveedores(pool),
    tablerosRepositorio.listarPresupuestoProyectos(
      pool,
      [...ESTADOS_TERMINADOS, ESTADOS_PROYECTO.PROSPECTO],
      [ESTADOS_OC.PAGA, ESTADOS_OC.CONTABILIZADA]
    ),
  ]);
  const [cambiosReq, cambiosOC] = await Promise.all([
    tablerosRepositorio.listarCambiosDeEstado(
      pool,
      "requisiciones",
      filasReq.filter((r) => r.estado !== ESTADOS_REQ.CERRADA).map((r) => r.id)
    ),
    tablerosRepositorio.listarCambiosDeEstado(
      pool,
      "ordenes_compra",
      filasOC.map((o) => o.id)
    ),
  ]);
  const conDias = (docs, cambios) => {
    const porRegistro = agruparPorRegistro(cambios);
    return docs.map((d) => {
      const desde = entradaAlEstado(d, porRegistro.get(d.id));
      return { ...d, en_estado_desde: desde, dias_en_estado: diasEntre(desde, hoyTexto) };
    });
  };
  const requisiciones = conDias(filasReq, cambiosReq);
  const ordenes = conDias(filasOC, cambiosOC);

  const sumar = (lista) => lista.reduce((t, x) => t + x.valor, 0);
  const etapa = (clave, titulo, docs, conValor, cerrada = false) => ({
    clave,
    titulo,
    cantidad: docs.length,
    valor: conValor ? sumar(docs) : null,
    dias_promedio: cerrada ? null : promedio(docs.map((d) => d.dias_en_estado)),
    cerrada,
  });
  const reqEn = (estado) => requisiciones.filter((r) => r.estado === estado);
  const ocEn = (estado) => ordenes.filter((o) => o.estado === estado);

  const flujo = [
    etapa("solicitada", "Requisición solicitada", reqEn(ESTADOS_REQ.SOLICITADA), false),
    etapa(
      "en_cotizacion",
      "En cotización con proveedores",
      reqEn(ESTADOS_REQ.EN_COTIZACION),
      false
    ),
    etapa("pte_aprobar", "OC pendiente de aprobar", ocEn(ESTADOS_OC.PTE_APROBAR), true),
    etapa(
      "aprobada_pte_pago",
      "OC aprobada, pendiente de pago",
      ocEn(ESTADOS_OC.APROBADA_PTE_PAGO),
      true
    ),
    etapa("paga", "OC pagada, por contabilizar", ocEn(ESTADOS_OC.PAGA), true),
    etapa(
      "contabilizada",
      `Contabilizada · ${anio}`,
      ocEn(ESTADOS_OC.CONTABILIZADA).filter((o) => o.en_estado_desde.slice(0, 4) === anio),
      true,
      true
    ),
  ];
  const candidatas = flujo.filter((e) => !e.cerrada && e.cantidad > 0 && e.dias_promedio > 0);
  const cuello = candidatas.reduce(
    (max, e) => (!max || e.dias_promedio > max.dias_promedio ? e : max),
    null
  );

  const porAprobar = ocEn(ESTADOS_OC.PTE_APROBAR).sort(
    (a, b) => b.dias_en_estado - a.dias_en_estado
  );
  const porPagar = ocEn(ESTADOS_OC.APROBADA_PTE_PAGO);
  const reqAOc = requisiciones
    .filter((r) => r.primera_oc && r.primera_oc >= desde6Meses)
    .map((r) => diasEntre(r.creada, r.primera_oc));
  const abiertas = requisiciones.filter((r) =>
    [ESTADOS_REQ.SOLICITADA, ESTADOS_REQ.EN_COTIZACION].includes(r.estado)
  );
  const importaciones = requisiciones.filter(
    (r) => r.procedencia === "importacion" && r.estado !== ESTADOS_REQ.CERRADA
  );
  const delAnio = requisiciones.filter((r) => r.creada.slice(0, 4) === anio);

  return {
    hoy: hoyTexto,
    umbral_proveedor: UMBRAL_PROVEEDOR,
    kpis: {
      requisiciones_abiertas: {
        cantidad: abiertas.length,
        en_cotizacion: abiertas.filter((r) => r.estado === ESTADOS_REQ.EN_COTIZACION).length,
      },
      oc_por_aprobar: {
        cantidad: porAprobar.length,
        valor: sumar(porAprobar),
        dias_mas_antigua: porAprobar.length ? porAprobar[0].dias_en_estado : 0,
      },
      oc_por_pagar: {
        cantidad: porPagar.length,
        valor: sumar(porPagar),
        dias_promedio: promedio(porPagar.map((o) => o.dias_en_estado)),
      },
      requisicion_a_oc: { dias_promedio: promedio(reqAOc), muestras: reqAOc.length },
      proveedores: {
        sobre_umbral: proveedores.filter((p) => p.calificacion_actual >= UMBRAL_PROVEEDOR).length,
        evaluados: proveedores.length,
        total: totalProveedores,
      },
      importaciones_abiertas: {
        cantidad: importaciones.length,
        con_oc: importaciones.filter((r) => r.primera_oc).length,
      },
    },
    flujo,
    cuello_de_botella: cuello ? cuello.clave : null,
    oc_por_aprobar: porAprobar,
    proveedores: proveedores.slice(0, MAX_PROVEEDORES),
    procedencia: ["nacional", "importacion", "almacen"].map((p) => ({
      procedencia: p,
      cantidad: delAnio.filter((r) => r.procedencia === p).length,
    })),
    requisiciones: requisiciones.slice(0, MAX_REQUISICIONES),
    presupuestos: presupuestos
      .filter((p) => (p.presupuesto_estimado || 0) > 0 || p.comprometido > 0)
      .sort(
        (a, b) =>
          (b.presupuesto_estimado || b.comprometido) - (a.presupuesto_estimado || a.comprometido)
      )
      .slice(0, MAX_PRESUPUESTOS),
  };
}

module.exports = {
  obtenerTableroGerencial,
  obtenerTableroComercial,
  obtenerTableroCompras,
  entradaAlEstado,
  FASES_ACTIVAS,
};
