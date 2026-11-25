/* global textoTipoServicio, textoEstadoProyecto */
// Resúmenes de Diseño I+D+i, Soporte técnico y Entregas y cierre: la pestaña
// "Resumen" de cada módulo, como la de Comercial y Compras. Usa las piezas de
// tableros.js (window.tableroComun), que se carga antes que este archivo.
(function () {
  "use strict";

  const T = () => window.tableroComun;

  // Etiquetas de los últimos meses ('YYYY-MM'); el mes en curso lleva "*".
  function etiquetasMeses(meses) {
    const { MES_LARGO } = T();
    const ultimo = meses.length - 1;
    return meses.map((mes, i) => {
      const [y, m] = mes.split("-").map(Number);
      const corta = MES_LARGO[m - 1].slice(0, 3);
      return {
        corta: i === ultimo ? `${corta}*` : corta,
        larga: `${MES_LARGO[m - 1]} ${y}${i === ultimo ? " (mes en curso)" : ""}`,
      };
    });
  }

  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
  const diasTexto = (n) => (n <= 0 ? "Hoy" : plural(n, "día", "días"));

  function avancePasos(listos, total) {
    const pct = total ? Math.round((listos / total) * 100) : 0;
    const tipo = listos === total ? "good" : pct >= 50 ? "warn" : "crit";
    return `<div class="avance-pasos" title="${listos} de ${total} pasos listos">
        <span class="avance-pista"><i class="avance-${tipo}" style="width:${pct}%"></i></span>
        <span class="tabular">${listos}/${total}</span>
      </div>`;
  }

  /* ================================================================
     Diseño I+D+i
     ================================================================ */
  function kpisDiseno(k) {
    const { kpisHTML } = T();
    const pl = k.por_liberar;
    const cd = k.cambios_por_decidir;
    return kpisHTML([
      {
        l: "Expedientes por liberar",
        v: String(pl.cantidad),
        n: pl.listos
          ? `${plural(pl.listos, "listo", "listos")} para decidir`
          : pl.cantidad
            ? `el más antiguo: ${diasTexto(pl.dias_mas_antiguo)}`
            : "ninguno pendiente",
        s: pl.cantidad ? "" : "good",
        href: "#/expedientes-diseno",
      },
      {
        l: "Cambios de diseño por decidir",
        v: String(cd.cantidad),
        n: cd.cantidad ? `el más antiguo: ${diasTexto(cd.dias_mas_antiguo)}` : "ninguno pendiente",
        s: cd.dias_mas_antiguo >= 5 ? "warn" : cd.cantidad ? "" : "good",
      },
      {
        l: "Liberados · 6 meses",
        v: String(k.liberados_6m.cantidad),
        n: k.liberados_6m.con_restricciones
          ? `${k.liberados_6m.con_restricciones} con restricciones`
          : "sin restricciones",
      },
      {
        l: "Rechazados · 6 meses",
        v: String(k.rechazados_6m),
        n: k.rechazados_6m ? "revisar causas" : "ninguno",
        s: k.rechazados_6m ? "warn" : "",
      },
    ]);
  }

  function pintarTableroDiseno(raiz, t) {
    const { esc, encabezadoVista, tabla, columnas, COLOR, num, pillDias, leyendaHTML } = T();
    raiz.innerHTML = `
      ${encabezadoVista({
        eyebrow: "Expedientes · liberación · cambios de diseño",
        titulo: "Diseño I+D+i",
        descripcion:
          "Qué le falta a cada expediente para liberarse y qué cambios de diseño esperan una decisión.",
      })}
      <div class="kpis">${kpisDiseno(t.kpis)}</div>
      <section class="card bloque" aria-labelledby="ds-pend-t">
        <div class="card-title"><h3 id="ds-pend-t">Qué falta para liberar</h3><span class="hint">${plural(t.pendientes.length, "expediente pendiente", "expedientes pendientes")} · los 9 pasos del expediente guiado</span></div>
        <div class="tbl-wrap"><table class="tbl compacta" id="ds-pendientes"></table></div>
      </section>
      <div class="g12">
        <section class="card s6" aria-labelledby="ds-cambios-t">
          <div class="card-title"><h3 id="ds-cambios-t">Cambios de diseño por decidir</h3><span class="hint">${plural(t.cambios.length, "pendiente", "pendientes")}</span></div>
          <div class="tbl-wrap"><table class="tbl compacta" id="ds-cambios"></table></div>
        </section>
        <section class="card s6" aria-labelledby="ds-mes-t">
          <div class="card-title"><h3 id="ds-mes-t">Decisiones de liberación por mes</h3><span class="hint">últimos 6 meses</span></div>
          <div class="legend-inline espacio">${leyendaHTML([
            [COLOR.good, "Aprobado"],
            [COLOR.gold, "Con restricciones"],
            [COLOR.crit, "Rechazado"],
          ])}</div>
          <div id="ds-meses"></div>
        </section>
      </div>`;

    tabla(
      raiz.querySelector("#ds-pendientes"),
      [
        {
          k: "codigo_expediente",
          t: "Expediente",
          html: (e) =>
            `<a class="code" href="#/expedientes-diseno/${e.id}">${esc(e.codigo_expediente)}</a><div class="sub-celda fuerte">${esc(e.producto_nombre)}</div><div class="sub-celda">${esc(e.codigo_pry)}</div>`,
        },
        { k: "responsable", t: "Responsable", html: (e) => esc(e.responsable || "—") },
        {
          k: "pasos_listos",
          t: "Avance",
          html: (e) => avancePasos(e.pasos_listos, e.pasos_total),
        },
        {
          k: "faltan",
          t: "Falta",
          sinOrden: true,
          html: (e) =>
            e.faltan.length
              ? `<span title="${esc(e.faltan.join(" · "))}">${esc(e.faltan.slice(0, 3).join(" · "))}${
                  e.faltan.length > 3 ? ` <em class="muted">+${e.faltan.length - 3} más</em>` : ""
                }</span>${e.riesgos_altos ? `<div class="sub-celda">${plural(e.riesgos_altos, "riesgo alto", "riesgos altos")}</div>` : ""}`
              : `<span class="pill pill--good">Listo para decidir</span>`,
        },
        { k: "dias", t: "Abierto", num: true, html: (e) => esc(diasTexto(e.dias)) },
      ],
      t.pendientes,
      { orden: "dias", dir: -1, vacio: "No hay expedientes pendientes de liberación." }
    );

    tabla(
      raiz.querySelector("#ds-cambios"),
      [
        {
          k: "codigo",
          t: "Cambio",
          html: (c) =>
            `<a class="code" href="#/expedientes-diseno/${c.expediente_id}">${esc(c.codigo)}</a><div class="sub-celda">${esc(c.descripcion)}</div>`,
        },
        { k: "solicitante", t: "Solicitó", html: (c) => esc(c.solicitante || "—") },
        { k: "dias", t: "Espera", html: (c) => pillDias(c.dias) },
        {
          k: "accion",
          t: "",
          sinOrden: true,
          html: (c) =>
            `<a class="btn-mini" href="#/expedientes-diseno/${c.expediente_id}">Revisar</a>`,
        },
      ],
      t.cambios,
      { orden: "dias", dir: -1, vacio: "Ningún cambio de diseño espera decisión." }
    );

    const etiquetas = etiquetasMeses(t.liberaciones_por_mes.map((m) => m.mes));
    columnas(raiz.querySelector("#ds-meses"), {
      labels: etiquetas.map((e) => e.corta),
      tipLabels: etiquetas.map((e) => e.larga),
      series: [
        { name: "Aprobado", c: COLOR.good, vals: t.liberaciones_por_mes.map((m) => m.aprobado) },
        {
          name: "Con restricciones",
          c: COLOR.gold,
          vals: t.liberaciones_por_mes.map((m) => m.con_restricciones),
        },
        { name: "Rechazado", c: COLOR.crit, vals: t.liberaciones_por_mes.map((m) => m.rechazado) },
      ],
      fmt: (v) => num(v),
      enteros: true,
      h: 150,
      vacio: "Sin decisiones de liberación en los últimos 6 meses.",
    });
  }

  /* ================================================================
     Soporte técnico
     ================================================================ */
  // Colores de la dona por tipo de servicio (paleta categórica fija).
  const COLOR_TIPO = {
    instalacion: "#4F5FE0",
    inspeccion: "#0EA5A0",
    asistencia: "#8B7CF6",
    mantenimiento_preventivo: "#1E9E6B",
    mantenimiento_correctivo: "#DD7A1F",
    garantia: "#D8394F",
    validacion: "#C9930A",
  };

  function kpisSoporte(k) {
    const { kpisHTML, num } = T();
    const sm = k.servicios_mes;
    const g = k.garantia_6m;
    const eq = k.equipos_sin_servicio;
    const d = k.duracion_promedio_horas;
    return kpisHTML([
      {
        l: "Servicios este mes",
        v: String(sm.cantidad),
        n: `${sm.mes_anterior_al_corte} el mes pasado a esta fecha`,
        href: "#/reportes-servicio",
      },
      {
        l: "En garantía · 6 meses",
        v: g.total ? `${Math.round((g.en_garantia / g.total) * 100)}%` : "—",
        n: g.total ? `${g.en_garantia} de ${g.total} servicios` : "sin servicios",
      },
      {
        l: "Correctivos y garantías · 6 meses",
        v: String(k.fallas_6m),
        n: k.fallas_6m ? "servicios por falla" : "ninguna falla reportada",
        s: k.fallas_6m ? "" : "good",
      },
      {
        l: "Equipos sin servicio en 12 meses",
        v: String(eq.cantidad),
        n: `de ${plural(eq.total, "equipo", "equipos")} registrados`,
        s: eq.cantidad ? "warn" : "good",
        href: "#/equipos",
      },
      {
        l: "Duración promedio del servicio",
        v: d.horas === null ? "—" : num(d.horas, 1),
        u: d.horas === null ? "" : "h",
        n: d.muestras
          ? `${plural(d.muestras, "servicio", "servicios")} con hora de inicio y fin`
          : "sin horas registradas",
      },
    ]);
  }

  function pintarTableroSoporte(raiz, t) {
    const {
      esc,
      encabezadoVista,
      tabla,
      columnas,
      dona,
      barrasHorizontales,
      COLOR,
      num,
      leyendaHTML,
      fechaCorta,
      aFecha,
    } = T();
    const fecha = (texto) => (texto ? esc(fechaCorta(aFecha(texto))) : "—");
    raiz.innerHTML = `
      ${encabezadoVista({
        eyebrow: "Reportes de servicio · equipos instalados",
        titulo: "Soporte técnico",
        descripcion:
          "Cuánto servicio se presta, a qué equipos les falta visita y dónde se repiten las fallas.",
      })}
      <div class="kpis">${kpisSoporte(t.kpis)}</div>
      <div class="g12">
        <section class="card s6" aria-labelledby="st-tipo-t">
          <div class="card-title"><h3 id="st-tipo-t">Servicios por tipo</h3><span class="hint">últimos 6 meses</span></div>
          <div class="donut-wrap columna"><svg id="st-dona" width="140" height="140" viewBox="0 0 140 140" role="img" aria-label="Servicios por tipo"></svg><div class="legend" id="st-leyenda"></div></div>
        </section>
        <section class="card s6" aria-labelledby="st-mes-t">
          <div class="card-title"><h3 id="st-mes-t">Servicios por mes</h3><span class="hint">últimos 6 meses</span></div>
          <div class="legend-inline espacio">${leyendaHTML([
            [COLOR.c1, "Servicios"],
            [COLOR.warn, "Correctivos y garantías"],
          ])}</div>
          <div id="st-meses"></div>
        </section>
      </div>
      <div class="g12">
        <section class="card s6" aria-labelledby="st-tec-t">
          <div class="card-title"><h3 id="st-tec-t">Carga por técnico</h3><span class="hint">servicios · 6 meses</span></div>
          <div class="barchart" id="st-tecnicos"></div>
        </section>
        <section class="card s6" aria-labelledby="st-vis-t">
          <div class="card-title"><h3 id="st-vis-t">Equipos para visitar</h3><span class="hint">sin servicio hace más de 12 meses</span></div>
          <div class="tbl-wrap"><table class="tbl compacta" id="st-visitar"></table></div>
        </section>
      </div>
      <div class="g12">
        <section class="card s6" aria-labelledby="st-rep-t">
          <div class="card-title"><h3 id="st-rep-t">Fallas repetidas</h3><span class="hint">2 o más correctivos o garantías · 12 meses</span></div>
          <div class="tbl-wrap"><table class="tbl compacta" id="st-repetidas"></table></div>
        </section>
        <section class="card s6" aria-labelledby="st-ult-t">
          <div class="card-title"><h3 id="st-ult-t">Últimos reportes</h3><span class="hint">${plural(t.ultimos_reportes.length, "reporte", "reportes")}</span></div>
          <div class="tbl-wrap"><table class="tbl compacta" id="st-ultimos"></table></div>
        </section>
      </div>`;

    dona(
      raiz.querySelector("#st-dona"),
      raiz.querySelector("#st-leyenda"),
      t.por_tipo.map((x) => ({
        k: x.tipo,
        label: textoTipoServicio(x.tipo),
        v: x.cantidad,
        c: COLOR_TIPO[x.tipo] || COLOR.c1,
      })),
      { centro: "servicios", vacio: "Sin servicios en los últimos 6 meses." }
    );

    const etiquetas = etiquetasMeses(t.por_mes.map((m) => m.mes));
    columnas(raiz.querySelector("#st-meses"), {
      labels: etiquetas.map((e) => e.corta),
      tipLabels: etiquetas.map((e) => e.larga),
      series: [
        { name: "Servicios", c: COLOR.c1, vals: t.por_mes.map((m) => m.servicios) },
        { name: "Correctivos y garantías", c: COLOR.warn, vals: t.por_mes.map((m) => m.fallas) },
      ],
      fmt: (v) => num(v),
      enteros: true,
      h: 150,
      vacio: "Sin servicios en los últimos 6 meses.",
    });

    barrasHorizontales(
      raiz.querySelector("#st-tecnicos"),
      t.por_tecnico.map((x) => ({
        label: x.nombre,
        v: x.cantidad,
        tip: plural(x.cantidad, "servicio", "servicios"),
      })),
      { vacio: "Sin servicios en los últimos 6 meses." }
    );

    tabla(
      raiz.querySelector("#st-visitar"),
      [
        {
          k: "numero_serie",
          t: "Equipo",
          html: (q) =>
            `<a class="code" href="#/equipos/${q.id}">${esc(q.numero_serie)}</a><div class="sub-celda">${esc(q.descripcion)}</div>`,
        },
        { k: "cliente", t: "Cliente" },
        {
          k: "ultimo_servicio",
          t: "Último servicio",
          html: (q) => (q.ultimo_servicio ? fecha(q.ultimo_servicio) : "Nunca"),
        },
        {
          k: "dias_sin_servicio",
          t: "Sin servicio",
          num: true,
          html: (q) => esc(diasTexto(q.dias_sin_servicio)),
        },
      ],
      t.equipos_para_visitar,
      {
        orden: "dias_sin_servicio",
        dir: -1,
        vacio: "Todos los equipos tuvieron servicio en los últimos 12 meses.",
      }
    );

    tabla(
      raiz.querySelector("#st-repetidas"),
      [
        {
          k: "numero_serie",
          t: "Equipo",
          html: (f) =>
            `<span class="code">${esc(f.numero_serie)}</span><div class="sub-celda">${esc(f.cliente)}</div>`,
        },
        { k: "cantidad", t: "Fallas", num: true },
        { k: "ultimo", t: "Última", html: (f) => fecha(f.ultimo) },
      ],
      t.fallas_repetidas,
      { orden: "cantidad", dir: -1, vacio: "Ningún equipo con fallas repetidas." }
    );

    tabla(
      raiz.querySelector("#st-ultimos"),
      [
        {
          k: "numero_reporte",
          t: "Reporte",
          html: (r) =>
            `<a class="code" href="#/reportes-servicio/${r.id}">${esc(r.numero_reporte)}</a><div class="sub-celda">${esc(r.equipo_numero_serie)} · ${esc(r.cliente)}</div>`,
        },
        { k: "tipo_servicio", t: "Tipo", html: (r) => esc(textoTipoServicio(r.tipo_servicio)) },
        { k: "tecnico", t: "Técnico", html: (r) => esc(r.tecnico || "—") },
        { k: "fecha", t: "Fecha", html: (r) => fecha(r.fecha) },
      ],
      t.ultimos_reportes,
      { orden: "fecha", dir: -1, vacio: "Aún no hay reportes de servicio." }
    );
  }

  /* ================================================================
     Entregas y cierre
     ================================================================ */
  function kpisEntregas(k, anio) {
    const { kpisHTML, num } = T();
    const sc = k.entregas_sin_cierre;
    const ec = k.entrega_a_cierre;
    return kpisHTML([
      {
        l: `Actas de entrega · ${anio}`,
        v: String(k.actas_entrega_anio),
        n: `${plural(k.actas_cierre_anio, "acta de cierre", "actas de cierre")}`,
        href: "#/actas-entrega",
      },
      {
        l: "Entregas sin acta de cierre",
        v: String(sc.cantidad),
        n: sc.cantidad ? `la más antigua: ${diasTexto(sc.dias_mas_antigua)}` : "todas cerradas",
        s: sc.dias_mas_antigua >= 30 ? "warn" : sc.cantidad ? "" : "good",
        href: "#/actas-cierre",
      },
      {
        l: "Proyectos sin acta de entrega",
        v: String(k.proyectos_sin_acta),
        n: "de logística a seguimiento",
        s: k.proyectos_sin_acta ? "warn" : "good",
      },
      {
        l: "Ítems que no cumplen · 12 meses",
        v: String(k.items_no_cumplen_12m),
        n: k.items_no_cumplen_12m ? "en actas de entrega o cierre" : "todo conforme",
        s: k.items_no_cumplen_12m ? "crit" : "good",
      },
      {
        l: "Entrega → cierre",
        v: ec.dias_promedio === null ? "—" : num(ec.dias_promedio, 1),
        u: ec.dias_promedio === null ? "" : "días",
        n: ec.muestras
          ? `promedio de ${plural(ec.muestras, "cierre", "cierres")} · 12 meses`
          : "sin cierres en 12 meses",
      },
    ]);
  }

  function pintarTableroEntregas(raiz, t) {
    const { esc, encabezadoVista, tabla, columnas, COLOR, num, leyendaHTML, fechaCorta, aFecha } =
      T();
    const fecha = (texto) => (texto ? esc(fechaCorta(aFecha(texto))) : "—");
    raiz.innerHTML = `
      ${encabezadoVista({
        eyebrow: "Actas de entrega · actas de cierre a satisfacción",
        titulo: "Entregas y cierre",
        descripcion:
          "Qué entregas esperan su acta de cierre, qué proyectos aún no tienen acta de entrega y qué no cumplió.",
      })}
      <div class="kpis">${kpisEntregas(t.kpis, t.hoy.slice(0, 4))}</div>
      <div class="g12">
        <section class="card s6" aria-labelledby="en-pend-t">
          <div class="card-title"><h3 id="en-pend-t">Entregas pendientes de cierre</h3><span class="hint">${plural(t.pendientes_cierre.length, "acta de entrega", "actas de entrega")} sin acta de cierre</span></div>
          <div class="tbl-wrap"><table class="tbl compacta" id="en-pendientes"></table></div>
        </section>
        <section class="card s6" aria-labelledby="en-sin-t">
          <div class="card-title"><h3 id="en-sin-t">Proyectos sin acta de entrega</h3><span class="hint">de logística a seguimiento</span></div>
          <div class="tbl-wrap"><table class="tbl compacta" id="en-sin-acta"></table></div>
        </section>
      </div>
      <div class="g12">
        <section class="card s6" aria-labelledby="en-mes-t">
          <div class="card-title"><h3 id="en-mes-t">Actas por mes</h3><span class="hint">últimos 6 meses</span></div>
          <div class="legend-inline espacio">${leyendaHTML([
            [COLOR.c1, "Entrega"],
            [COLOR.c2, "Cierre"],
          ])}</div>
          <div id="en-meses"></div>
        </section>
        <section class="card s6" aria-labelledby="en-items-t">
          <div class="card-title"><h3 id="en-items-t">Ítems que no cumplen</h3><span class="hint">últimos 12 meses</span></div>
          <div class="tbl-wrap"><table class="tbl compacta" id="en-items"></table></div>
        </section>
      </div>`;

    tabla(
      raiz.querySelector("#en-pendientes"),
      [
        {
          k: "numero_acta",
          t: "Acta de entrega",
          html: (a) =>
            `<a class="code" href="#/actas-entrega/${a.id}">${esc(a.numero_acta)}</a><div class="sub-celda fuerte">${esc(a.codigo_pry)} · ${esc(a.nombre_proyecto)}</div><div class="sub-celda">${esc(a.cliente)}</div>`,
        },
        { k: "fecha", t: "Entregada", html: (a) => fecha(a.fecha) },
        { k: "dias", t: "Espera", num: true, html: (a) => esc(diasTexto(a.dias)) },
        {
          k: "accion",
          t: "",
          sinOrden: true,
          html: (a) =>
            `<a class="btn-mini" href="#/actas-cierre/nuevo?proyecto=${a.proyecto_id}">+ Acta de cierre</a>`,
        },
      ],
      t.pendientes_cierre,
      { orden: "dias", dir: -1, vacio: "Todas las entregas tienen su acta de cierre." }
    );

    tabla(
      raiz.querySelector("#en-sin-acta"),
      [
        {
          k: "codigo_pry",
          t: "Proyecto",
          html: (p) =>
            `<a class="code" href="#/proyectos/${p.id}">${esc(p.codigo_pry)}</a><div class="sub-celda fuerte">${esc(p.nombre_proyecto)}</div><div class="sub-celda">${esc(p.cliente)}</div>`,
        },
        {
          k: "estado",
          t: "Fase",
          html: (p) => `<span class="pill pill--info">${esc(textoEstadoProyecto(p.estado))}</span>`,
        },
        {
          k: "accion",
          t: "",
          sinOrden: true,
          html: (p) =>
            `<a class="btn-mini" href="#/actas-entrega/nuevo?proyecto=${p.id}">+ Crear acta</a>`,
        },
      ],
      t.proyectos_sin_acta,
      { orden: "codigo_pry", vacio: "Todos los proyectos en entrega tienen su acta." }
    );

    const etiquetas = etiquetasMeses(t.actas_por_mes.map((m) => m.mes));
    columnas(raiz.querySelector("#en-meses"), {
      labels: etiquetas.map((e) => e.corta),
      tipLabels: etiquetas.map((e) => e.larga),
      series: [
        { name: "Entrega", c: COLOR.c1, vals: t.actas_por_mes.map((m) => m.entrega) },
        { name: "Cierre", c: COLOR.c2, vals: t.actas_por_mes.map((m) => m.cierre) },
      ],
      fmt: (v) => num(v),
      enteros: true,
      h: 150,
      vacio: "Sin actas en los últimos 6 meses.",
    });

    tabla(
      raiz.querySelector("#en-items"),
      [
        {
          k: "elemento",
          t: "Ítem",
          html: (i) =>
            `${esc(i.elemento)}${i.numero_serie ? `<div class="sub-celda">Serie ${esc(i.numero_serie)}</div>` : ""}`,
        },
        {
          k: "numero_acta",
          t: "Acta",
          html: (i) =>
            `<a class="code" href="#/${i.acta_tipo === "entrega" ? "actas-entrega" : "actas-cierre"}/${i.acta_id}">${esc(i.numero_acta)}</a><div class="sub-celda">${esc(i.codigo_pry)}</div>`,
        },
        { k: "fecha", t: "Fecha", html: (i) => fecha(i.fecha) },
      ],
      t.items_no_cumplen,
      { orden: "fecha", dir: -1, vacio: "Todos los ítems cumplen." }
    );
  }

  /* ================================================================
     Vistas
     ================================================================ */
  window.vistaTableroDiseno = () =>
    T().cargarTablero({
      seccion: "resumen-diseno",
      endpoint: "/tableros/diseno",
      nombre: "el resumen de diseño",
      pintar: pintarTableroDiseno,
    });
  window.vistaTableroSoporte = () =>
    T().cargarTablero({
      seccion: "resumen-soporte",
      endpoint: "/tableros/soporte",
      nombre: "el resumen de soporte técnico",
      pintar: pintarTableroSoporte,
    });
  window.vistaTableroEntregas = () =>
    T().cargarTablero({
      seccion: "resumen-entregas",
      endpoint: "/tableros/entregas",
      nombre: "el resumen de entregas",
      pintar: pintarTableroEntregas,
    });
})();
