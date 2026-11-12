/* global api, contenido, marcarMenu, alerta, textoEstadoProyecto */
// Tableros gerenciales. Las gráficas son HTML/CSS (anchos en porcentaje), así
// se adaptan al ancho de la pantalla sin redibujarse. Todo vive dentro de esta
// función para no chocar con los nombres globales de inicio.js; solo se
// expone lo que usa el enrutador. Las funciones de inicio.js que se usan aquí
// (api, alerta, marcarMenu…) se llaman al navegar, cuando ya están cargadas.
(function () {
  "use strict";

  /* ================================================================
     Utilidades
     ================================================================ */
  const $$ = (selector, raiz = document) => [...raiz.querySelectorAll(selector)];
  const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const MES_LARGO = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  // Paleta categórica validada (orden fijo) y colores de estado reservados.
  const COLOR = {
    c1: "#4F5FE0",
    c2: "#0EA5A0",
    gold: "#C9930A",
    good: "#1E9E6B",
    warn: "#DD7A1F",
    crit: "#D8394F",
  };
  const FASES_ACTIVAS = [
    "planeacion",
    "diseno",
    "compras",
    "produccion",
    "calidad_fat",
    "logistica",
    "instalacion",
    "sat",
    "seguimiento",
  ];
  const ABREVIATURA_FASE = {
    planeacion: "Plan.",
    diseno: "Dis.",
    compras: "Comp.",
    produccion: "Prod.",
    calidad_fat: "FAT",
    logistica: "Log.",
    instalacion: "Inst.",
    sat: "SAT",
    seguimiento: "Seg.",
  };

  function esc(valor) {
    return String(valor ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
    );
  }

  const aFecha = (texto) => {
    const [y, m, d] = texto.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const diasEntre = (a, b) => Math.round((b - a) / 864e5);
  const sumarDias = (fecha, n) =>
    new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() + n);
  const fechaCorta = (fecha) => `${fecha.getDate()} ${MES[fecha.getMonth()]}`;
  const num = (v, dec = 0) =>
    Number(v).toLocaleString("es-CO", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const dobleFrame = (fn) => requestAnimationFrame(() => requestAnimationFrame(fn));

  // Pesos colombianos: en millones cuando la cifra lo amerita.
  function cop(valor) {
    const v = Number(valor) || 0;
    if (Math.abs(v) >= 1e6) return { v: `$${num(v / 1e6, Math.abs(v) >= 1e8 ? 0 : 1)}`, u: "M" };
    return { v: `$${num(v)}`, u: "" };
  }
  const copTexto = (valor) => {
    const p = cop(valor);
    return p.u ? `${p.v} ${p.u}` : p.v;
  };
  const vacio = (texto) => `<div class="vacio">${esc(texto)}</div>`;

  /* ================================================================
     Tooltip compartido
     ================================================================ */
  function elementoTip() {
    let el = document.getElementById("tablero-tip");
    if (!el) {
      el = document.createElement("div");
      el.id = "tablero-tip";
      el.setAttribute("role", "tooltip");
      document.body.append(el);
    }
    return el;
  }

  function tip(el, html) {
    const t = elementoTip();
    el.addEventListener("mouseenter", () => {
      t.innerHTML = typeof html === "function" ? html() : html;
      t.classList.add("show");
    });
    el.addEventListener("mousemove", (e) => {
      const w = t.offsetWidth;
      const h = t.offsetHeight;
      let x = e.clientX + 14;
      let y = e.clientY + 14;
      if (x + w > window.innerWidth - 8) x = e.clientX - w - 14;
      if (y + h > window.innerHeight - 8) y = e.clientY - h - 14;
      t.style.transform = `translate(${x}px,${y}px)`;
    });
    el.addEventListener("mouseleave", () => t.classList.remove("show"));
  }

  // Si la vista cambia con el mouse encima de una gráfica, el tooltip no
  // recibe "mouseleave": se oculta al navegar.
  window.addEventListener("hashchange", () => elementoTip().classList.remove("show"));

  const tk = (color, etiqueta, valor) =>
    `<div class="tk"><i style="background:${color}"></i>${etiqueta}<b>${valor}</b></div>`;

  function filtroActivo(el, texto, alQuitar) {
    if (!texto) {
      el.classList.remove("show");
      return;
    }
    el.innerHTML = `${esc(texto)}<button type="button" title="Quitar filtro" aria-label="Quitar filtro">×</button>`;
    el.classList.add("show");
    el.querySelector("button").onclick = alQuitar;
  }

  /* ================================================================
     Componentes de gráfica
     ================================================================ */

  // k: { l: etiqueta, v: valor, u: unidad, n: nota, s: good|warn|crit, href }
  function kpisHTML(items) {
    return items
      .map((k) => {
        const tag = k.href ? "a" : "div";
        const href = k.href ? ` href="${k.href}"` : "";
        return `<${tag} class="kpi"${href}>
          <div class="kpi-l" title="${esc(k.l)}">${esc(k.l)}</div>
          <div class="kpi-v tabular">${esc(k.v)}${k.u ? `<small>${esc(k.u)}</small>` : ""}</div>
          <div class="kpi-n ${k.s || ""}" title="${esc(k.n || "")}">${esc(k.n || "")}</div>
        </${tag}>`;
      })
      .join("");
  }

  // Barras horizontales. data: [{ label, v, c?, tip? }]
  function barrasHorizontales(el, data, o = {}) {
    if (!data.length) {
      el.innerHTML = vacio(o.vacio || "Sin datos");
      return;
    }
    const max = Math.max(...data.map((d) => d.v), 1);
    const fmt = o.fmt || ((v) => num(v));
    el.innerHTML = data
      .map(
        (d) => `<div class="bar-row">
          <div class="rt"><span class="nm">${esc(d.label)}</span><span class="vv">${esc(fmt(d.v))}</span></div>
          <div class="bar-track"><div class="bar-fill" style="background:${d.c || o.color || COLOR.c1}" data-w="${(d.v / max) * 100}"></div></div>
        </div>`
      )
      .join("");
    dobleFrame(() => $$(".bar-fill", el).forEach((b) => (b.style.width = `${b.dataset.w}%`)));
    $$(".bar-row", el).forEach((fila, i) => {
      const d = data[i];
      tip(
        fila,
        () => `<div class="tt">${esc(d.label)}</div><div class="ts">${esc(d.tip || fmt(d.v))}</div>`
      );
    });
  }

  // Escala "bonita" para el eje: prueba 3, 4 y 5 divisiones y se queda con
  // el tope más ajustado al dato.
  // Con "enteros" (conteos) el paso nunca es fraccionario.
  function escalaBonita(v, enteros = false) {
    if (!(v > 0)) return { max: 4, step: 1 };
    return [5, 4, 3]
      .map((n) => {
        const crudo = v / n;
        const p = Math.pow(10, Math.floor(Math.log10(crudo)));
        const step =
          [1, 2, 2.5, 5, 10]
            .map((x) => x * p)
            .find((x) => x >= crudo && (!enteros || (x >= 1 && Number.isInteger(x)))) ??
          Math.max(1, 10 * p);
        return { max: step * n, step };
      })
      .reduce((a, b) => (b.max < a.max ? b : a));
  }

  // Columnas agrupadas. o: { labels (HTML ya escapado), tipLabels, series:[{name,c,vals}],
  //   h, fmt (tooltip), eje (números del eje), valores (bool), onPick }
  function columnas(el, o) {
    el.setPick = () => {};
    const totales = o.labels.map((_, i) => Math.max(...o.series.map((s) => s.vals[i])));
    if (o.vacio && totales.every((v) => !v)) {
      el.innerHTML = vacio(o.vacio);
      return;
    }
    const esc0 = escalaBonita(Math.max(...totales) * (o.valores ? 1.15 : 1), o.enteros);
    const fmt = o.fmt || ((v) => num(v));
    const eje = o.eje || ((v) => num(v));
    let grilla = "";
    for (let v = 0; v <= esc0.max + 1e-9; v += esc0.step) {
      grilla += `<div class="gl" style="bottom:${(v / esc0.max) * 100}%"><span>${esc(eje(v))}</span></div>`;
    }
    const solo = o.series.length === 1 ? " solo" : "";
    const grupos = o.labels
      .map(
        (_, i) =>
          `<div class="cg${o.onPick ? " pickable" : ""}" data-i="${i}">${o.series
            .map(
              (s) =>
                `<div class="cbar${solo}" style="background:${s.c}" data-h="${(s.vals[i] / esc0.max) * 100}">${
                  o.valores && s.vals[i] > 0 ? `<span class="cv">${esc(fmt(s.vals[i]))}</span>` : ""
                }</div>`
            )
            .join("")}</div>`
      )
      .join("");
    el.innerHTML = `<div class="cols"><div class="cols-plot" style="--h:${o.h || 170}px">${grilla}<div class="cols-groups">${grupos}</div></div><div class="cols-x">${o.labels
      .map((l) => `<span>${l}</span>`)
      .join("")}</div></div>`;
    dobleFrame(() => $$("[data-h]", el).forEach((b) => (b.style.height = `${b.dataset.h}%`)));
    const gs = $$(".cg", el);
    gs.forEach((g, i) => {
      tip(
        g,
        () =>
          `<div class="tt">${esc(o.tipLabels ? o.tipLabels[i] : o.labels[i])}</div>` +
          o.series.map((s) => tk(s.c, esc(s.name), esc(fmt(s.vals[i])))).join("")
      );
      if (o.onPick) {
        g.onclick = () => o.onPick(String(i) === el.dataset.picked ? null : String(i));
      }
    });
    el.setPick = (k) => {
      el.dataset.picked = k ?? "";
      gs.forEach((g, i) => g.classList.toggle("dim", k !== null && String(i) !== k));
    };
  }

  function leyendaHTML(items) {
    return items
      .map(
        ([c, t, redondo]) =>
          `<span><i style="background:${c}${redondo ? ";border-radius:50%" : ""}"></i>${esc(t)}</span>`
      )
      .join("");
  }

  /* ================================================================
     Cartera de proyectos en el tiempo (swimlanes)
     ================================================================ */
  function rangoCartera(filas, hoy) {
    const inicios = filas.map((f) => aFecha(f.fecha_inicio).getTime());
    const fines = filas.map((f) => (f.fecha_fin ? aFecha(f.fecha_fin) : hoy).getTime());
    const primero = new Date(Math.min(...inicios));
    const ultimo = new Date(Math.max(...fines, hoy.getTime()));
    let desde = new Date(primero.getFullYear(), primero.getMonth(), 1);
    const desdeMinimo = new Date(hoy.getFullYear(), hoy.getMonth() - 4, 1);
    if (desde < desdeMinimo) desde = desdeMinimo;
    let hasta = new Date(ultimo.getFullYear(), ultimo.getMonth() + 1, 1);
    const hastaMaximo = new Date(hoy.getFullYear(), hoy.getMonth() + 10, 1);
    if (hasta > hastaMaximo) hasta = hastaMaximo;
    const hastaMinimo = new Date(desde.getFullYear(), desde.getMonth() + 6, 1);
    if (hasta < hastaMinimo) hasta = hastaMinimo;
    return { desde, hasta };
  }

  function cartera(el, filas, hoy) {
    if (!filas.length) {
      el.innerHTML = vacio("No hay proyectos en ejecución (de planeación a seguimiento).");
      return;
    }
    const { desde, hasta } = rangoCartera(filas, hoy);
    const total = diasEntre(desde, hasta);
    const pct = (fecha) => (diasEntre(desde, fecha) / total) * 100;

    let meses = "";
    let lineas = "";
    for (let m = new Date(desde); m < hasta; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
      const siguiente = new Date(m.getFullYear(), m.getMonth() + 1, 1);
      const a = pct(m);
      const b = Math.min(pct(siguiente), 100);
      meses += `<div class="pg-month" style="left:${a}%;width:${b - a}%"><span class="mL">${MES_LARGO[m.getMonth()]}</span><span class="mS">${MES_LARGO[m.getMonth()].slice(0, 3)}</span><small>${m.getFullYear()}</small></div>`;
      lineas += `<div class="mo" style="left:${a}%"></div>`;
    }
    for (let d = new Date(desde); d < hasta; d = sumarDias(d, 1)) {
      if (d.getDay() === 1 && d.getDate() !== 1)
        lineas += `<div class="wk" style="left:${pct(d)}%"></div>`;
    }
    const posHoy = pct(hoy);

    const filasHTML = filas
      .map((f, i) => {
        const inicio = aFecha(f.fecha_inicio);
        const fin = f.fecha_fin ? aFecha(f.fecha_fin) : hoy;
        const crudoA = pct(inicio);
        const crudoB = pct(sumarDias(fin, 1));
        const a = Math.min(Math.max(crudoA, 0), 99.4);
        const b = Math.max(Math.min(crudoB, 100), a + 0.6);
        const clases = [
          "pg-bar",
          f.vencido ? "late" : "",
          f.fecha_fin ? "" : "sin-plan",
          crudoA < 0 ? "cut-l" : "",
          crudoB > 100 ? "cut-r" : "",
        ]
          .filter(Boolean)
          .join(" ");
        const nota = f.vencido ? " · vencido" : f.fecha_fin ? "" : " · sin fecha de entrega";
        // la etiqueta va a la derecha de la barra; si no cabe, dentro de ella
        const posEtiqueta = b > 82 ? `right:calc(${100 - b}% + 6px)` : `left:calc(${b}% + 8px)`;
        return `<a class="pg-row" href="#/proyectos/${f.id}" data-k="${esc(f.estado)}" data-i="${i}">
          <div class="pg-lab"><div class="tx"><b>${esc(f.nombre_proyecto)}</b><span><span class="mono" style="color:var(--accent-ink)">${esc(f.codigo_pry)}</span> · ${esc(f.cliente)}</span></div><span class="pill ${f.vencido ? "pill--crit" : "pill--info"}">${esc(textoEstadoProyecto(f.estado))}</span></div>
          <div class="pg-track"><div class="${clases}" style="left:${a}%;width:${b - a}%"><i data-w="${f.progreso}"></i></div><span class="pg-pct${f.vencido ? " late" : ""}" style="${posEtiqueta}">${f.progreso}%<em>${nota}</em></span></div>
        </a>`;
      })
      .join("");

    el.innerHTML = `<div class="pg">
      <div class="pg-head"><div class="pg-lh">Proyecto · fase actual</div><div class="pg-months">${meses}<span class="pg-today-lab" style="left:${posHoy}%">Hoy · ${fechaCorta(hoy)}</span></div></div>
      <div class="pg-body"><div class="pg-grid">${lineas}<div class="pg-today" style="left:${posHoy}%"></div></div>${filasHTML}</div>
    </div>`;
    dobleFrame(() => $$(".pg-bar i", el).forEach((b) => (b.style.width = `${b.dataset.w}%`)));

    $$(".pg-row", el).forEach((fila) => {
      const f = filas[Number(fila.dataset.i)];
      tip(
        fila.querySelector(".pg-track"),
        () =>
          `<div class="tt">${esc(f.codigo_pry)} · ${esc(f.nombre_proyecto)}</div><div class="ts">${esc(f.cliente)}</div>` +
          tk(COLOR.gold, "Avance", `${f.progreso}%`) +
          tk(
            "transparent",
            "Actividades",
            `${f.actividades_completadas} de ${f.actividades_total}`
          ) +
          tk("transparent", "Inicio", fechaCorta(aFecha(f.fecha_inicio))) +
          tk(
            "transparent",
            "Entrega plan",
            f.fecha_fin ? fechaCorta(aFecha(f.fecha_fin)) : "sin fecha"
          ) +
          tk("transparent", "Responsable", esc(f.responsable)) +
          (f.presupuesto_estimado !== null
            ? tk("transparent", "Presupuesto", copTexto(f.presupuesto_estimado))
            : "") +
          tk("transparent", "Comprometido en OC", copTexto(f.comprometido))
      );
    });
    el.setPick = (k) =>
      $$(".pg-row", el).forEach((r) => r.classList.toggle("dim", Boolean(k) && r.dataset.k !== k));
  }

  /* ================================================================
     Aprobaciones pendientes
     ================================================================ */
  const TIPOS_APROBACION = {
    orden_compra: {
      sigla: "OC",
      fondo: "var(--gold-tint)",
      tinta: "var(--gold-ink)",
      enlace: (a) => `#/ordenes-compra/${a.id}`,
      confirmar: (a) =>
        `¿Aprobar la orden de compra ${a.codigo}? Pasará a "Aprobada, pendiente de pago".`,
      aprobar: (a) =>
        api("PATCH", `/ordenes-compra/${a.id}/estado`, { estado: "aprobada_pte_pago" }),
    },
    cambio_diseno: {
      sigla: "CD",
      fondo: "#FDEBE4",
      tinta: "#B4441F",
      enlace: (a) => `#/expedientes-diseno/${a.expediente_id}`,
      confirmar: (a) => `¿Aprobar el cambio de diseño ${a.codigo}?`,
      aprobar: (a) =>
        api("PUT", `/expedientes-diseno/${a.expediente_id}/cambios-diseno/${a.id}`, {
          estado: "aprobado",
        }),
    },
    cotizacion: {
      sigla: "COT",
      fondo: "var(--accent-tint)",
      tinta: "var(--accent-ink)",
      enlace: (a) => `#/cotizaciones/${a.id}`,
    },
  };

  function pillDias(dias) {
    const tipo = dias >= 5 ? "crit" : dias >= 3 ? "warn" : "mute";
    const texto = dias <= 0 ? "Hoy" : `${dias} ${dias === 1 ? "día" : "días"}`;
    return `<span class="pill pill--${tipo}" title="Tiempo esperando">${texto}</span>`;
  }

  function aprobaciones(el, contadorEl, lista, alAprobar) {
    const contar = () => {
      const n = $$(".ap:not(.done)", el).length;
      contadorEl.textContent = n ? `${n} pendiente${n === 1 ? "" : "s"}` : "Todo al día";
      if (!n) el.innerHTML = vacio("Nada espera aprobación.");
    };
    if (!lista.length) {
      el.innerHTML = vacio("Nada espera aprobación.");
      contadorEl.textContent = "Todo al día";
      return;
    }
    el.innerHTML = lista
      .map((a, i) => {
        const t = TIPOS_APROBACION[a.tipo];
        const valor = a.valor !== null && a.valor !== undefined ? ` · ${copTexto(a.valor)}` : "";
        const accion = t.aprobar
          ? `<button type="button" class="btn-mini" data-i="${i}">Aprobar</button>`
          : `<a class="btn-mini" href="${t.enlace(a)}">Revisar</a>`;
        return `<div class="ap">
          <div class="ap-ic" style="background:${t.fondo};color:${t.tinta}">${t.sigla}</div>
          <div class="ap-body"><a href="${t.enlace(a)}" title="${esc(`${a.codigo} · ${a.titulo}`)}"><span class="ap-cod">${esc(a.codigo)}</span>${esc(a.titulo)}</a><span>${esc(a.detalle)}${esc(valor)}</span></div>
          <div class="ap-side">${pillDias(a.dias)}${accion}</div>
        </div>`;
      })
      .join("");
    contar();

    $$("button.btn-mini", el).forEach((b) => {
      b.onclick = async () => {
        const a = lista[Number(b.dataset.i)];
        const t = TIPOS_APROBACION[a.tipo];
        if (!window.confirm(t.confirmar(a))) return;
        const fila = b.closest(".ap");
        fila.querySelector(".ap-error")?.remove();
        b.disabled = true;
        b.textContent = "Aprobando…";
        try {
          const r = await t.aprobar(a);
          if (r.status !== 200) throw new Error(r.cuerpo?.error || "No se pudo aprobar.");
          b.textContent = "Aprobado";
          alAprobar(a);
          setTimeout(() => {
            fila.classList.add("done");
            setTimeout(contar, 500);
          }, 500);
        } catch (error) {
          b.disabled = false;
          b.textContent = "Aprobar";
          const aviso = document.createElement("span");
          aviso.className = "ap-error";
          aviso.textContent = error.message === "sesion-expirada" ? "" : error.message;
          fila.querySelector(".ap-body").append(aviso);
        }
      };
    });
  }

  /* ================================================================
     Vista: Tablero gerencial
     ================================================================ */
  function kpisGerenciales(k) {
    const comprometidoPct = k.presupuesto_activo
      ? Math.round((k.comprometido_activo / k.presupuesto_activo) * 100)
      : null;
    const presupuesto = cop(k.presupuesto_activo);
    const cotizado = cop(k.cotizaciones_abiertas.valor);
    const oc = k.oc_por_aprobar;
    const vencidos = k.proyectos_vencidos;
    return kpisHTML([
      {
        l: "Proyectos activos",
        v: String(k.proyectos_activos),
        n: k.proyectos_prospecto
          ? `+${k.proyectos_prospecto} en prospecto`
          : "planeación a seguimiento",
        href: "#/proyectos",
      },
      {
        l: "Presupuesto en ejecución",
        v: presupuesto.v,
        u: presupuesto.u,
        n:
          comprometidoPct === null
            ? "sin presupuesto cargado"
            : `${comprometidoPct}% comprometido en OC`,
        s: comprometidoPct !== null && comprometidoPct > 100 ? "crit" : "",
      },
      {
        l: "Cotizaciones abiertas",
        v: cotizado.v,
        u: cotizado.u,
        n: `${k.cotizaciones_abiertas.cantidad} documento${k.cotizaciones_abiertas.cantidad === 1 ? "" : "s"}`,
        href: "#/cotizaciones",
      },
      {
        l: "OC por aprobar",
        v: String(oc.cantidad),
        u: oc.cantidad ? `· ${copTexto(oc.valor)}` : "",
        n: oc.cantidad ? `la más antigua: ${oc.dias_mas_antigua} días` : "ninguna pendiente",
        s: oc.dias_mas_antigua >= 5 ? "warn" : oc.cantidad ? "" : "good",
        href: "#/ordenes-compra",
      },
      {
        l: "Expedientes sin liberar",
        v: String(k.expedientes_sin_liberar),
        n: "pendientes de liberación",
        href: "#/expedientes-diseno",
      },
      {
        l: "Proyectos vencidos",
        v: String(vencidos.cantidad),
        n: vencidos.cantidad ? vencidos.codigos.slice(0, 3).join(", ") : "ninguno",
        s: vencidos.cantidad ? "crit" : "good",
      },
    ]);
  }

  function horaCorta(fecha) {
    return fecha.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
  }

  function pintarTableroGerencial(t) {
    const hoy = aFecha(t.hoy);
    const porMes = t.cotizaciones_por_mes;
    const maxMes = Math.max(...porMes.map((m) => m.cotizado), 0);
    const enMillones = maxMes >= 1e6;
    const divisor = enMillones ? 1e6 : 1;
    const sinResponsable = t.actividades_sin_responsable;

    contenido.replaceChildren();
    const raiz = document.createElement("div");
    raiz.className = "tablero";
    raiz.innerHTML = `
      <div class="vista-head">
        <div>
          <span class="eyebrow">Vista gerencial</span>
          <h1>Tablero gerencial</h1>
          <p>Toda la operación en una pantalla: la cartera de proyectos en el tiempo, lo que espera una decisión y el pulso comercial.</p>
        </div>
        <div class="vista-acciones"><span class="actualizado">Actualizado ${esc(horaCorta(new Date()))}</span><button type="button" class="btn-mini" id="tb-actualizar">Actualizar</button></div>
      </div>
      <div class="kpis" id="tb-kpis">${kpisGerenciales(t.kpis)}</div>
      <div class="g12">
        <section class="card s8" aria-labelledby="tb-cartera-t">
          <div class="card-title"><h3 id="tb-cartera-t">Cartera de proyectos en el tiempo<span class="active-filter" id="tb-af-cartera"></span></h3><span class="hint">barra = plan de actividades · relleno dorado = avance · borde rojo = vencido</span></div>
          <div id="tb-cartera"></div>
        </section>
        <section class="card s4 ancho-completo-md" aria-labelledby="tb-ap-t">
          <div class="card-title"><h3 id="tb-ap-t">Esperan aprobación</h3><span class="hint" id="tb-ap-count"></span></div>
          <div class="approvals" id="tb-aprobaciones"></div>
        </section>
      </div>
      <div class="g12">
        <section class="card s5" aria-labelledby="tb-fases-t">
          <div class="card-title"><h3 id="tb-fases-t">Proyectos activos por fase</h3><span class="hint">clic en una fase para filtrar la cartera</span></div>
          <div id="tb-fases"></div>
        </section>
        <section class="card s4" aria-labelledby="tb-cot-t">
          <div class="card-title"><h3 id="tb-cot-t">Cotizado vs. aceptado</h3><span class="hint">por mes de creación · ${enMillones ? "COP millones" : "COP"}</span></div>
          <div class="legend-inline">${leyendaHTML([
            [COLOR.c1, "Cotizado"],
            [COLOR.c2, "Aceptado"],
          ])}</div>
          <div id="tb-cot"></div>
        </section>
        <section class="card s3" aria-labelledby="tb-carga-t">
          <div class="card-title"><h3 id="tb-carga-t">Actividades abiertas por responsable</h3><span class="hint">${
            sinResponsable ? `${num(sinResponsable)} sin responsable` : "proyectos en curso"
          }</span></div>
          <div class="barchart" id="tb-carga"></div>
        </section>
      </div>`;
    contenido.append(raiz);

    raiz.querySelector("#tb-actualizar").onclick = () => vistaTableroGerencial();

    const carteraEl = raiz.querySelector("#tb-cartera");
    cartera(carteraEl, t.cartera, hoy);

    const kpisEl = raiz.querySelector("#tb-kpis");
    aprobaciones(
      raiz.querySelector("#tb-aprobaciones"),
      raiz.querySelector("#tb-ap-count"),
      t.aprobaciones,
      (a) => {
        // refleja la aprobación en los indicadores sin recargar todo el tablero
        if (a.tipo === "orden_compra") {
          const oc = t.kpis.oc_por_aprobar;
          oc.cantidad -= 1;
          oc.valor -= a.valor || 0;
          const restantes = t.aprobaciones.filter((x) => x.tipo === "orden_compra" && x !== a);
          t.aprobaciones = t.aprobaciones.filter((x) => x !== a);
          oc.dias_mas_antigua = restantes.length ? Math.max(...restantes.map((x) => x.dias)) : 0;
          kpisEl.innerHTML = kpisGerenciales(t.kpis);
        }
      }
    );

    const afCartera = raiz.querySelector("#tb-af-cartera");
    const fasesEl = raiz.querySelector("#tb-fases");
    const nombresFase = FASES_ACTIVAS.map((f) => textoEstadoProyecto(f));
    const elegirFase = (i) => {
      fasesEl.setPick(i);
      carteraEl.setPick?.(i === null ? null : FASES_ACTIVAS[Number(i)]);
      filtroActivo(afCartera, i === null ? "" : `Fase: ${nombresFase[Number(i)]}`, () =>
        elegirFase(null)
      );
    };
    columnas(fasesEl, {
      // nombre completo en pantallas anchas; abreviado cuando la columna es angosta
      labels: nombresFase.map(
        (n, i) =>
          `<span class="lL">${esc(n).replace(" / ", "/<br>")}</span><span class="lS">${ABREVIATURA_FASE[FASES_ACTIVAS[i]]}</span>`
      ),
      tipLabels: nombresFase,
      vacio: "No hay proyectos en ejecución.",
      enteros: true,
      series: [
        {
          name: "Proyectos",
          c: COLOR.c1,
          vals: FASES_ACTIVAS.map(
            (f) => t.proyectos_por_fase.find((x) => x.estado === f)?.cantidad || 0
          ),
        },
      ],
      valores: true,
      h: 150,
      onPick: elegirFase,
    });

    const etiquetasMes = porMes.map((m) => {
      const [y, mm] = m.mes.split("-").map(Number);
      return { corta: MES_LARGO[mm - 1].slice(0, 3), larga: `${MES_LARGO[mm - 1]} ${y}` };
    });
    columnas(raiz.querySelector("#tb-cot"), {
      labels: etiquetasMes.map((e, i) => (i === etiquetasMes.length - 1 ? `${e.corta}*` : e.corta)),
      tipLabels: etiquetasMes.map((e, i) =>
        i === etiquetasMes.length - 1 ? `${e.larga} (mes en curso)` : e.larga
      ),
      series: [
        { name: "Cotizado", c: COLOR.c1, vals: porMes.map((m) => m.cotizado) },
        { name: "Aceptado", c: COLOR.c2, vals: porMes.map((m) => m.aceptado) },
      ],
      fmt: (v) => copTexto(v),
      eje: (v) => num(v / divisor),
      h: 150,
      vacio: "No hay cotizaciones creadas en los últimos 6 meses.",
    });

    barrasHorizontales(
      raiz.querySelector("#tb-carga"),
      t.carga_por_responsable.map((c) => ({
        label: c.nombre,
        v: c.abiertas,
        tip: `${c.abiertas} actividad${c.abiertas === 1 ? "" : "es"} abierta${c.abiertas === 1 ? "" : "s"}`,
      })),
      { vacio: "No hay actividades abiertas con responsable." }
    );
  }

  async function vistaTableroGerencial() {
    marcarMenu("tablero");
    const ruta = window.location.hash;
    if (!contenido.querySelector(".tablero")) {
      contenido.replaceChildren();
      const p = document.createElement("p");
      p.className = "subtitulo";
      p.textContent = "Cargando…";
      contenido.append(p);
    }
    const { status, cuerpo } = await api("GET", "/tableros/gerencial");
    // si el usuario navegó a otra vista mientras cargaba, no se pinta encima
    if (window.location.hash !== ruta) return;
    if (status !== 200) {
      contenido.replaceChildren(alerta("error", "No se pudo cargar el tablero gerencial."));
      return;
    }
    pintarTableroGerencial(cuerpo.tablero);
  }

  window.vistaTableroGerencial = vistaTableroGerencial;
})();
