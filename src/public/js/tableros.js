/* global api, contenido, marcarMenu, alerta, textoEstadoProyecto, textoProcedencia,
   textoEstadoRequisicion, tipoPillRequisicion */
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
          <div class="kpi-n ${k.s || ""}" title="${esc(k.ayuda || k.n || "")}">${esc(k.n || "")}</div>
        </${tag}>`;
      })
      .join("");
  }

  // Barras horizontales. data: [{ k?, label, v, c?, tip?, nota? }]
  // o: { max, umbral (línea de referencia), fmt, color, vacio, onPick(k|null) }
  function barrasHorizontales(el, data, o = {}) {
    el.setPick = () => {};
    if (!data.length) {
      el.innerHTML = vacio(o.vacio || "Sin datos");
      return;
    }
    const max = o.max || Math.max(...data.map((d) => d.v), 1);
    const fmt = o.fmt || ((v) => num(v));
    const umbral =
      o.umbral !== undefined
        ? `<span class="thr" style="left:${(o.umbral / max) * 100}%"></span>`
        : "";
    el.innerHTML = data
      .map(
        (d, i) => `<div class="bar-row${o.onPick ? " pickable" : ""}" data-i="${i}">
          <div class="rt"><span class="nm">${esc(d.label)}</span><span class="vv">${d.nota ? `<em>${esc(d.nota)}</em>` : ""}${esc(fmt(d.v))}</span></div>
          <div class="bar-track">${umbral}<div class="bar-fill" style="background:${d.c || o.color || COLOR.c1}" data-w="${Math.min(d.v / max, 1) * 100}"></div></div>
        </div>`
      )
      .join("");
    dobleFrame(() => $$(".bar-fill", el).forEach((b) => (b.style.width = `${b.dataset.w}%`)));
    const filas = $$(".bar-row", el);
    filas.forEach((fila, i) => {
      const d = data[i];
      tip(
        fila,
        () => `<div class="tt">${esc(d.label)}</div><div class="ts">${esc(d.tip || fmt(d.v))}</div>`
      );
      if (o.onPick) {
        fila.onclick = () => o.onPick(String(i) === el.dataset.picked ? null : String(i));
      }
    });
    el.setPick = (k) => {
      el.dataset.picked = k ?? "";
      filas.forEach((f, i) => f.classList.toggle("dim", k !== null && String(i) !== k));
    };
  }

  // Dona con leyenda clicable. data: [{ k, label, v, c }]
  function dona(svg, leyenda, data, o = {}) {
    const total = data.reduce((t, d) => t + d.v, 0);
    if (!total) {
      svg.replaceWith(
        Object.assign(document.createElement("div"), { innerHTML: vacio(o.vacio || "Sin datos") })
      );
      leyenda.innerHTML = "";
      return { limpiar: () => {} };
    }
    const R = 52;
    const ANCHO = 16;
    const circ = 2 * Math.PI * R;
    const hueco = data.filter((d) => d.v > 0).length > 1 ? 3 : 0;
    let desplazamiento = 0;
    const segmentos = data
      .filter((d) => d.v > 0)
      .map((d) => {
        const largo = (d.v / total) * circ;
        const visible = Math.max(largo - hueco, 0.1);
        const s = `<circle class="donut-seg" data-k="${d.k}" cx="70" cy="70" r="${R}" fill="none" stroke="${d.c}" stroke-width="${ANCHO}" stroke-dasharray="${visible} ${circ - visible}" stroke-dashoffset="${-desplazamiento}"/>`;
        desplazamiento += largo;
        return s;
      })
      .join("");
    svg.innerHTML = `<g transform="rotate(-90 70 70)">${segmentos}</g><text x="70" y="70" text-anchor="middle" class="donut-total">${num(total)}</text><text x="70" y="88" text-anchor="middle" class="donut-centro">${esc(o.centro || "total")}</text>`;
    leyenda.innerHTML = data
      .map(
        (d) =>
          `<div class="legend-item" data-k="${d.k}"><span class="sw" style="background:${d.c}"></span><span class="lt">${esc(d.label)}</span><span class="lv">${num(d.v)}</span><span class="lp">${Math.round((d.v / total) * 100)}%</span></div>`
      )
      .join("");
    let elegido = null;
    const aplicar = () => {
      $$(".donut-seg", svg).forEach((s) => {
        s.classList.toggle("dim", Boolean(elegido) && s.dataset.k !== elegido);
        s.classList.toggle("picked", s.dataset.k === elegido);
      });
      $$(".legend-item", leyenda).forEach((s) =>
        s.classList.toggle("dim", Boolean(elegido) && s.dataset.k !== elegido)
      );
    };
    const elegir = (k) => {
      elegido = elegido === k ? null : k;
      aplicar();
      if (o.onPick) o.onPick(elegido);
    };
    [...$$(".donut-seg", svg), ...$$(".legend-item", leyenda)].forEach((el) => {
      const d = data.find((x) => x.k === el.dataset.k);
      tip(el, () => tk(d.c, esc(d.label), `${num(d.v)} · ${Math.round((d.v / total) * 100)}%`));
      el.onclick = () => elegir(el.dataset.k);
    });
    return {
      limpiar: () => {
        elegido = null;
        aplicar();
      },
    };
  }

  // Tabla ordenable. columnas: [{ k, t, num?, html?(fila) → HTML, orden?(fila), sinOrden? }]
  // Sin "html" la celda muestra el valor escapado.
  function tabla(el, columnasDef, filas, o = {}) {
    let clave = o.orden || null;
    let dir = o.dir || 1;
    let filtro = null;
    function pintar() {
      let datos = filas.slice();
      if (filtro) datos = datos.filter(filtro);
      if (clave) {
        const c = columnasDef.find((x) => x.k === clave);
        const valor = c.orden || ((f) => f[clave]);
        datos.sort((a, b) => {
          const x = valor(a);
          const y = valor(b);
          const cmp =
            typeof x === "number" && typeof y === "number"
              ? x - y
              : String(x ?? "").localeCompare(String(y ?? ""), "es");
          return cmp * dir;
        });
      }
      const th = columnasDef
        .map(
          (c) =>
            `<th class="${c.num ? "num " : ""}${c.sinOrden ? "" : "sortable"}" data-k="${c.k}"${
              c.sinOrden
                ? ""
                : ` aria-sort="${clave === c.k ? (dir > 0 ? "ascending" : "descending") : "none"}"`
            }>${esc(c.t)}${clave === c.k ? `<span class="arr">${dir > 0 ? "▲" : "▼"}</span>` : ""}</th>`
        )
        .join("");
      const cuerpo = datos.length
        ? datos
            .map(
              (f) =>
                `<tr>${columnasDef
                  .map(
                    (c) =>
                      `<td class="${c.num ? "num" : ""}">${c.html ? c.html(f) : esc(f[c.k])}</td>`
                  )
                  .join("")}</tr>`
            )
            .join("")
        : `<tr class="empty-row"><td colspan="${columnasDef.length}">${esc(o.vacio || "Sin registros")}</td></tr>`;
      el.innerHTML = `<thead><tr>${th}</tr></thead><tbody>${cuerpo}</tbody>`;
      $$("th.sortable", el).forEach((celda) => {
        celda.onclick = () => {
          if (clave === celda.dataset.k) dir = -dir;
          else {
            clave = celda.dataset.k;
            dir = 1;
          }
          pintar();
        };
      });
      if (o.despues) o.despues(el, datos);
      if (o.alContar) o.alContar(datos.length, filas.length);
    }
    pintar();
    return {
      filtrar: (f) => {
        filtro = f;
        pintar();
      },
    };
  }

  const pillHTML = (tipo, texto) => `<span class="pill pill--${tipo}">${esc(texto)}</span>`;
  const iniciales = (nombre) =>
    String(nombre || "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join("");

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
        const fila = b.closest(".ap");
        if (await aprobarConConfirmacion(b, a, fila.querySelector(".ap-body"))) {
          alAprobar(a);
          setTimeout(() => {
            fila.classList.add("done");
            setTimeout(contar, 500);
          }, 500);
        }
      };
    });
  }

  // Pide confirmación y ejecuta la aprobación del documento. El servidor
  // valida la transición de estado; aquí solo se refleja el resultado.
  async function aprobarConConfirmacion(boton, a, contenedorAviso) {
    const t = TIPOS_APROBACION[a.tipo];
    if (!window.confirm(t.confirmar(a))) return false;
    contenedorAviso.querySelector(".ap-error")?.remove();
    boton.disabled = true;
    boton.textContent = "Aprobando…";
    try {
      const r = await t.aprobar(a);
      if (r.status !== 200) throw new Error(r.cuerpo?.error || "No se pudo aprobar.");
      boton.textContent = "Aprobado";
      return true;
    } catch (error) {
      boton.disabled = false;
      boton.textContent = "Aprobar";
      const aviso = document.createElement("span");
      aviso.className = "ap-error";
      aviso.textContent = error.message === "sesion-expirada" ? "" : error.message;
      contenedorAviso.append(aviso);
      return false;
    }
  }

  /* ================================================================
     Piezas compartidas entre tableros
     ================================================================ */
  function horaCorta(fecha) {
    return fecha.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
  }

  function encabezadoVista({ eyebrow, titulo, descripcion }) {
    return `<div class="vista-head">
        <div>
          <span class="eyebrow">${esc(eyebrow)}</span>
          <h1>${esc(titulo)}</h1>
          <p>${esc(descripcion)}</p>
        </div>
        <div class="vista-acciones"><span class="actualizado">Actualizado ${esc(horaCorta(new Date()))}</span><button type="button" class="btn-mini" data-actualizar>Actualizar</button></div>
      </div>`;
  }

  const unidadCotizaciones = (porMes) =>
    Math.max(...porMes.map((m) => m.cotizado), 0) >= 1e6 ? "COP millones" : "COP";

  function graficaCotizadoAceptado(el, porMes, h = 150) {
    const divisor = unidadCotizaciones(porMes) === "COP millones" ? 1e6 : 1;
    const etiquetas = porMes.map((m) => {
      const [y, mm] = m.mes.split("-").map(Number);
      return { corta: MES_LARGO[mm - 1].slice(0, 3), larga: `${MES_LARGO[mm - 1]} ${y}` };
    });
    const ultimo = etiquetas.length - 1;
    columnas(el, {
      labels: etiquetas.map((e, i) => (i === ultimo ? `${e.corta}*` : e.corta)),
      tipLabels: etiquetas.map((e, i) => (i === ultimo ? `${e.larga} (mes en curso)` : e.larga)),
      series: [
        { name: "Cotizado", c: COLOR.c1, vals: porMes.map((m) => m.cotizado) },
        { name: "Aceptado", c: COLOR.c2, vals: porMes.map((m) => m.aceptado) },
      ],
      fmt: (v) => copTexto(v),
      eje: (v) => num(v / divisor),
      h,
      vacio: "No hay cotizaciones creadas en los últimos 6 meses.",
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

  function pintarTableroGerencial(raiz, t) {
    const hoy = aFecha(t.hoy);
    const sinResponsable = t.actividades_sin_responsable;

    raiz.innerHTML = `
      ${encabezadoVista({
        eyebrow: "Vista gerencial",
        titulo: "Tablero gerencial",
        descripcion:
          "Toda la operación en una pantalla: la cartera de proyectos en el tiempo, lo que espera una decisión y el pulso comercial.",
      })}
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
          <div class="card-title"><h3 id="tb-cot-t">Cotizado vs. aceptado</h3><span class="hint">por mes de creación · ${unidadCotizaciones(t.cotizaciones_por_mes)}</span></div>
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

    graficaCotizadoAceptado(raiz.querySelector("#tb-cot"), t.cotizaciones_por_mes);

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

  /* ================================================================
     Vista: Comercial (resumen)
     ================================================================ */
  const COLUMNAS_EMBUDO = [
    { estado: "borrador", texto: "Borrador" },
    { estado: "revision", texto: "Revisión" },
    { estado: "aprobacion", texto: "Aprobación" },
    { estado: "enviada", texto: "Enviada" },
    { estado: "aceptada", texto: "Aceptada · 30 días" },
    { estado: "rechazada", texto: "Rechazada · 30 días" },
  ];

  function pillVigencia(dias) {
    if (dias === null || dias === undefined) return "";
    if (dias < 0) return pillHTML("crit", `Vencida hace ${-dias} d`);
    if (dias === 0) return pillHTML("crit", "Vence hoy");
    return pillHTML(dias <= 3 ? "crit" : dias <= 7 ? "warn" : "mute", `${dias} días`);
  }

  const descripcionDocumento = (d) =>
    d.primer_item ? `${d.primer_item}${d.items > 1 ? ` y ${d.items - 1} más` : ""}` : "Sin ítems";

  function embudo(el, cotizaciones) {
    const totalDe = (estado) =>
      cotizaciones.filter((c) => c.estado === estado).reduce((t, c) => t + c.valor, 0);
    const maxColumna = Math.max(...COLUMNAS_EMBUDO.map((c) => totalDe(c.estado)), 1);
    el.innerHTML = COLUMNAS_EMBUDO.map((col) => {
      const tarjetas = cotizaciones.filter((c) => c.estado === col.estado);
      const total = totalDe(col.estado);
      const colorBarra =
        col.estado === "aceptada" ? COLOR.good : col.estado === "rechazada" ? "#B8BFD0" : COLOR.c1;
      return `<div class="kcol${col.estado === "rechazada" ? " mute" : ""}">
        <div class="kh"><div class="t">${esc(col.texto)}<span>${tarjetas.length}</span></div><div class="v">${esc(copTexto(total))}</div><div class="bar-track"><div class="bar-fill" style="background:${colorBarra}" data-w="${(total / maxColumna) * 100}"></div></div></div>
        <div class="kcards">${
          tarjetas.length
            ? tarjetas
                .map(
                  (c) => `<a class="kc" href="#/cotizaciones/${c.id}" data-cl="${c.cliente_id}">
                <div class="r1"><span class="code">${esc(c.numero_cotizacion)}</span><span class="mini-av" title="${esc(c.asesor || "")}">${esc(iniciales(c.asesor))}</span></div>
                <div class="cl" title="${esc(c.cliente)}">${esc(c.cliente)}</div>
                <div class="r3"><span class="ds" title="${esc(descripcionDocumento(c))}">${esc(descripcionDocumento(c))}</span><span class="val">${esc(copTexto(c.valor))}</span></div>${
                  c.estado === "enviada" && c.dias_para_vencer !== null
                    ? `<div class="r4">${pillVigencia(c.dias_para_vencer)}</div>`
                    : ""
                }
              </a>`
                )
                .join("")
            : '<div class="kvacio">—</div>'
        }</div>
      </div>`;
    }).join("");
    dobleFrame(() => $$(".kh .bar-fill", el).forEach((b) => (b.style.width = `${b.dataset.w}%`)));
  }

  const PRIORIDAD_SEGUIMIENTO = { crit: 0, warn: 1, info: 2, mute: 3, good: 4 };

  function kpisComerciales(k, hoy) {
    const mes = MES_LARGO[hoy.getMonth()].toLowerCase();
    const anio = hoy.getFullYear();
    const cotizado = cop(k.cotizado_mes);
    const mesAnterior = MES_LARGO[(hoy.getMonth() + 11) % 12].toLowerCase();
    const base = k.cotizado_mes_anterior_al_corte;
    const variacion = base ? Math.round(((k.cotizado_mes - base) / base) * 100) : null;
    const { aceptadas, decididas } = k.aceptacion;
    const ticket = cop(k.ticket_promedio.valor);
    const vig = k.vigencias;
    let notaVigencias = "ninguna urgente";
    let estadoVigencias = "good";
    if (vig.vencidas) {
      notaVigencias = `${vig.vencidas} vencida${vig.vencidas === 1 ? "" : "s"} sin respuesta`;
      estadoVigencias = "crit";
    } else if (vig.vencen_hoy) {
      notaVigencias = `${vig.vencen_hoy} vence${vig.vencen_hoy === 1 ? "" : "n"} hoy`;
      estadoVigencias = "warn";
    } else if (vig.por_vencer) {
      notaVigencias = "llamar antes de que venzan";
      estadoVigencias = "warn";
    }
    return kpisHTML([
      {
        l: `Cotizado en ${mes}`,
        v: cotizado.v,
        u: cotizado.u,
        n:
          variacion === null
            ? `sin datos de ${mesAnterior.slice(0, 3)}.`
            : `${variacion >= 0 ? "+" : ""}${variacion}% vs. ${mesAnterior.slice(0, 3)}.`,
        ayuda: `Comparado con lo cotizado en ${mesAnterior} hasta el mismo día del mes`,
        s: variacion === null ? "" : variacion >= 0 ? "good" : "warn",
      },
      {
        l: "Aceptación · 6 meses",
        v: decididas ? `${Math.round((aceptadas / decididas) * 100)}%` : "—",
        n: decididas ? `${aceptadas} de ${decididas} decididas` : "ninguna decidida aún",
      },
      {
        l: "Cotizaciones abiertas",
        v: String(k.abiertas.cantidad),
        u: k.abiertas.cantidad ? `· ${copTexto(k.abiertas.valor)}` : "",
        n: "de borrador a enviada",
        href: "#/cotizaciones",
      },
      {
        l: "Vigencias · próximos 7 días",
        v: String(vig.por_vencer),
        n: notaVigencias,
        s: estadoVigencias,
      },
      {
        l: "Clientes activos",
        v: String(k.clientes_activos),
        n: `+${k.clientes_nuevos_anio} nuevos en ${anio}`,
        href: "#/clientes",
      },
      {
        l: "Ticket promedio",
        v: k.ticket_promedio.cantidad ? ticket.v : "—",
        u: k.ticket_promedio.cantidad ? ticket.u : "",
        n: `${k.ticket_promedio.cantidad} aceptada${k.ticket_promedio.cantidad === 1 ? "" : "s"} en ${anio}`,
      },
    ]);
  }

  function pintarTableroComercial(raiz, t) {
    const hoy = aFecha(t.hoy);
    raiz.innerHTML = `
      ${encabezadoVista({
        eyebrow: "Clientes y cotizaciones",
        titulo: "Comercial",
        descripcion:
          "El embudo completo de izquierda a derecha: cada cotización visible con su valor y su vigencia, sin abrir fichas.",
      })}
      <div class="kpis">${kpisComerciales(t.kpis, hoy)}</div>
      <section class="card bloque" aria-labelledby="cm-embudo-t">
        <div class="card-title"><h3 id="cm-embudo-t">Embudo de cotizaciones<span class="active-filter" id="cm-af-embudo"></span></h3><span class="hint">la vigencia se cuenta desde hoy · clic en una tarjeta para abrirla</span></div>
        <div class="kanban" id="cm-embudo"></div>
      </section>
      <div class="g12">
        <section class="card s4" aria-labelledby="cm-cot-t">
          <div class="card-title"><h3 id="cm-cot-t">Cotizado vs. aceptado por mes</h3><span class="hint">por mes de creación · ${unidadCotizaciones(t.cotizaciones_por_mes)}</span></div>
          <div class="legend-inline">${leyendaHTML([
            [COLOR.c1, "Cotizado"],
            [COLOR.c2, "Aceptado"],
          ])}</div>
          <div id="cm-cot"></div>
        </section>
        <section class="card s4" aria-labelledby="cm-cli-t">
          <div class="card-title"><h3 id="cm-cli-t">Clientes por valor aceptado</h3><span class="hint">${hoy.getFullYear()} · clic para resaltar en el embudo</span></div>
          <div class="barchart" id="cm-clientes"></div>
        </section>
        <section class="card s4" aria-labelledby="cm-vig-t">
          <div class="card-title"><h3 id="cm-vig-t">Vigencias por vencer</h3><span class="hint">cotizaciones enviadas</span></div>
          <div class="slist" id="cm-vigencias"></div>
        </section>
      </div>
      <section class="card" aria-labelledby="cm-tabla-t">
        <div class="card-title"><h3 id="cm-tabla-t">Clientes</h3><span class="hint">clic en un encabezado para ordenar</span></div>
        <div class="tbl-wrap alto"><table class="tbl" id="cm-tabla"></table></div>
      </section>`;

    const embudoEl = raiz.querySelector("#cm-embudo");
    embudo(embudoEl, t.embudo);
    graficaCotizadoAceptado(raiz.querySelector("#cm-cot"), t.cotizaciones_por_mes, 180);

    const afEmbudo = raiz.querySelector("#cm-af-embudo");
    const clientesEl = raiz.querySelector("#cm-clientes");
    const elegirCliente = (i) => {
      clientesEl.setPick(i);
      const cliente = i === null ? null : t.clientes_por_valor[Number(i)];
      $$(".kc", embudoEl).forEach((c) =>
        c.classList.toggle("dim", Boolean(cliente) && c.dataset.cl !== String(cliente.cliente_id))
      );
      filtroActivo(afEmbudo, cliente ? `Cliente: ${cliente.nombre}` : "", () =>
        elegirCliente(null)
      );
    };
    barrasHorizontales(
      clientesEl,
      t.clientes_por_valor.map((c) => ({ label: c.nombre, v: c.valor, tip: copTexto(c.valor) })),
      {
        fmt: (v) => copTexto(v),
        onPick: elegirCliente,
        vacio: `Sin cotizaciones aceptadas en ${hoy.getFullYear()}.`,
      }
    );

    raiz.querySelector("#cm-vigencias").innerHTML = t.vigencias.length
      ? t.vigencias
          .slice(0, 8)
          .map(
            (c) =>
              `<a class="it" href="#/cotizaciones/${c.id}"><div class="bd"><b>${esc(c.cliente)}</b><span><span class="mono">${esc(c.numero_cotizacion)}</span> · ${esc(copTexto(c.valor))}</span></div><div class="mt">${pillVigencia(c.dias_para_vencer)}<div>${fechaCorta(aFecha(c.fecha_validez))}</div></div></a>`
          )
          .join("")
      : vacio("No hay cotizaciones enviadas con vigencia.");

    tabla(
      raiz.querySelector("#cm-tabla"),
      [
        {
          k: "nombre",
          t: "Cliente",
          html: (f) => `<a class="enlace-fila" href="#/clientes/${f.id}">${esc(f.nombre)}</a>`,
        },
        {
          k: "identificacion",
          t: "Identificación",
          html: (f) => `<span class="mono muted nowrap">${esc(f.identificacion)}</span>`,
        },
        { k: "ciudad", t: "Ciudad", html: (f) => esc(f.ciudad || "—") },
        { k: "proyectos_activos", t: "Proy. en curso", num: true },
        { k: "cotizaciones_abiertas", t: "Cotiz. abiertas", num: true },
        {
          k: "valor_aceptado_anio",
          t: `Aceptado ${hoy.getFullYear()}`,
          num: true,
          html: (f) => esc(copTexto(f.valor_aceptado_anio)),
        },
        {
          k: "ultima_actividad",
          t: "Últ. actividad",
          html: (f) => esc(fechaCorta(aFecha(f.ultima_actividad))),
        },
        {
          k: "seguimiento",
          t: "Seguimiento",
          orden: (f) => PRIORIDAD_SEGUIMIENTO[f.seguimiento.tipo],
          html: (f) => pillHTML(f.seguimiento.tipo, f.seguimiento.texto),
        },
      ],
      t.clientes,
      { orden: "valor_aceptado_anio", dir: -1, vacio: "Aún no hay clientes registrados." }
    );
  }

  /* ================================================================
     Vista: Compras (resumen)
     ================================================================ */
  const FLECHA_FLUJO =
    '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M3 9h11M10 5l4 4-4 4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const COLOR_PROCEDENCIA = { nacional: COLOR.c1, importacion: COLOR.c2, almacen: "#C98A1B" };

  function flujoCompras(el, etapas, cuello) {
    const maxDias = Math.max(...etapas.map((e) => e.dias_promedio || 0), 1);
    el.innerHTML = etapas
      .map((e, i) => {
        const esCuello = e.clave === cuello;
        const dias = e.cerrada
          ? "ciclo cerrado"
          : e.dias_promedio === null
            ? "sin documentos"
            : `${num(e.dias_promedio, 1)} días en promedio<div class="bar-track"><div class="bar-fill" style="background:${esCuello ? COLOR.warn : COLOR.c1}" data-w="${(e.dias_promedio / maxDias) * 100}"></div></div>`;
        return `${i ? `<div class="farrow">${FLECHA_FLUJO}</div>` : ""}<div class="fnode${esCuello ? " neck" : ""}">
          ${esCuello ? '<span class="neck-tag">Cuello de botella</span>' : ""}
          <div class="ft">${esc(e.titulo)}</div><div class="fn">${e.cantidad}</div><div class="fv">${e.valor !== null ? esc(copTexto(e.valor)) : "&nbsp;"}</div>
          <div class="fd">${dias}</div></div>`;
      })
      .join("");
    dobleFrame(() => $$(".bar-fill", el).forEach((b) => (b.style.width = `${b.dataset.w}%`)));
    $$(".fnode", el).forEach((nodo, i) => {
      const e = etapas[i];
      tip(
        nodo,
        () =>
          `<div class="tt">${esc(e.titulo)}</div>` +
          tk("transparent", "Documentos", String(e.cantidad)) +
          (e.valor !== null ? tk("transparent", "Valor", esc(copTexto(e.valor))) : "") +
          (e.dias_promedio !== null && !e.cerrada
            ? tk("transparent", "Días en la etapa (prom.)", num(e.dias_promedio, 1))
            : "")
      );
    });
  }

  function presupuestos(el, filas) {
    if (!filas.length) {
      el.innerHTML = vacio("No hay proyectos en curso con presupuesto o compras.");
      return;
    }
    const max =
      Math.max(...filas.map((f) => Math.max(f.presupuesto_estimado || 0, f.comprometido)), 1) *
      1.04;
    el.innerHTML = filas
      .map((f) => {
        const ppto = f.presupuesto_estimado || 0;
        const excede = ppto > 0 && f.comprometido > ppto;
        const nota = !ppto
          ? '<span class="sub">sin presupuesto cargado</span>'
          : excede
            ? `<span class="x">Excede ${Math.round(((f.comprometido - ppto) / ppto) * 100)}% el presupuesto</span>`
            : `<span class="sub">${Math.round((f.comprometido / ppto) * 100)}% comprometido</span>`;
        return `<a class="bullet-row" href="#/proyectos/${f.id}"><div class="bl"><b>${esc(f.codigo_pry)}</b><span>${esc(f.nombre_proyecto)}</span></div>
          <div class="bullet"><div class="bp" style="width:${(ppto / max) * 100}%"></div><div class="bc${excede ? " over-c" : ""}" data-w="${(f.comprometido / max) * 100}"></div><div class="bg" data-w="${(f.pagado / max) * 100}"></div>${
            excede ? `<span class="over" style="left:${(ppto / max) * 100}%"></span>` : ""
          }</div>
          <div class="br">${esc(copTexto(f.comprometido))} de ${ppto ? esc(copTexto(ppto)) : "—"}${nota}</div></a>`;
      })
      .join("");
    dobleFrame(() => $$("[data-w]", el).forEach((b) => (b.style.width = `${b.dataset.w}%`)));
    $$(".bullet", el).forEach((b, i) => {
      const f = filas[i];
      tip(
        b,
        () =>
          `<div class="tt">${esc(f.codigo_pry)} · ${esc(f.nombre_proyecto)}</div>` +
          tk(
            "#EEF1F8",
            "Presupuesto",
            f.presupuesto_estimado ? esc(copTexto(f.presupuesto_estimado)) : "sin cargar"
          ) +
          tk("#B9C1F5", "Comprometido en OC", esc(copTexto(f.comprometido))) +
          tk(COLOR.c1, "Pagado", esc(copTexto(f.pagado)))
      );
    });
  }

  function kpisCompras(k, cuello) {
    const { oc_por_aprobar: aprobar, oc_por_pagar: pagar, proveedores: prov } = k;
    return kpisHTML([
      {
        l: "Requisiciones abiertas",
        v: String(k.requisiciones_abiertas.cantidad),
        n: `${k.requisiciones_abiertas.en_cotizacion} en cotización`,
        href: "#/requisiciones",
      },
      {
        l: "OC por aprobar",
        v: String(aprobar.cantidad),
        u: aprobar.cantidad ? `· ${copTexto(aprobar.valor)}` : "",
        n: aprobar.cantidad
          ? `la más antigua: ${aprobar.dias_mas_antigua} días`
          : "ninguna pendiente",
        s: aprobar.dias_mas_antigua >= 5 ? "warn" : aprobar.cantidad ? "" : "good",
        href: "#/ordenes-compra",
      },
      {
        l: "OC por pagar",
        v: String(pagar.cantidad),
        u: pagar.cantidad ? `· ${copTexto(pagar.valor)}` : "",
        n:
          pagar.dias_promedio === null
            ? "ninguna pendiente"
            : `${num(pagar.dias_promedio, 1)} días en promedio${cuello === "aprobada_pte_pago" ? " · cuello de botella" : ""}`,
        s: cuello === "aprobada_pte_pago" ? "crit" : "",
      },
      {
        l: "Requisición → OC",
        v:
          k.requisicion_a_oc.dias_promedio === null
            ? "—"
            : num(k.requisicion_a_oc.dias_promedio, 1),
        u: k.requisicion_a_oc.dias_promedio === null ? "" : "días",
        n: k.requisicion_a_oc.muestras
          ? `promedio de ${k.requisicion_a_oc.muestras} · 6 meses`
          : "sin requisiciones convertidas",
      },
      {
        l: "Proveedores ≥ 80 puntos",
        v: prov.evaluados ? `${Math.round((prov.sobre_umbral / prov.evaluados) * 100)}%` : "—",
        n: prov.evaluados
          ? `${prov.sobre_umbral} de ${prov.evaluados} evaluados`
          : `${prov.total} proveedores sin calificar`,
        href: "#/proveedores",
      },
      {
        l: "Importaciones abiertas",
        v: String(k.importaciones_abiertas.cantidad),
        n: `${k.importaciones_abiertas.con_oc} con OC emitida`,
      },
    ]);
  }

  function pintarTableroCompras(raiz, t) {
    const anio = t.hoy.slice(0, 4);
    const totalPorAprobar = t.oc_por_aprobar.reduce((s, o) => s + o.valor, 0);
    raiz.innerHTML = `
      ${encabezadoVista({
        eyebrow: "Proveedores · requisiciones · órdenes de compra",
        titulo: "Compras",
        descripcion:
          "Del requerimiento al pago en una sola franja: dónde está cada peso y en qué etapa se está quedando el tiempo.",
      })}
      <div class="kpis">${kpisCompras(t.kpis, t.cuello_de_botella)}</div>
      <section class="card bloque" aria-labelledby="cp-flujo-t">
        <div class="card-title"><h3 id="cp-flujo-t">Del requerimiento al pago</h3><span class="hint">documentos abiertos hoy · días promedio que llevan en su etapa actual</span></div>
        <div class="flow" id="cp-flujo"></div>
      </section>
      <div class="g12">
        <section class="card s5" aria-labelledby="cp-oc-t">
          <div class="card-title"><h3 id="cp-oc-t">Órdenes de compra por aprobar</h3><span class="hint">${t.oc_por_aprobar.length} · ${esc(copTexto(totalPorAprobar))}</span></div>
          <div class="tbl-wrap"><table class="tbl compacta" id="cp-oc"></table></div>
        </section>
        <section class="card s4" aria-labelledby="cp-prov-t">
          <div class="card-title"><h3 id="cp-prov-t">Calificación de proveedores</h3><span class="hint">umbral ${t.umbral_proveedor} puntos</span></div>
          <div class="barchart" id="cp-proveedores"></div>
        </section>
        <section class="card s3" aria-labelledby="cp-proc-t">
          <div class="card-title"><h3 id="cp-proc-t">Procedencia<span class="active-filter" id="cp-af-proc"></span></h3><span class="hint">requisiciones ${anio}</span></div>
          <div class="donut-wrap columna"><svg id="cp-dona" width="140" height="140" viewBox="0 0 140 140" role="img" aria-label="Requisiciones por procedencia"></svg><div class="legend" id="cp-leyenda"></div></div>
        </section>
      </div>
      <div class="g12">
        <section class="card s6" aria-labelledby="cp-ppto-t">
          <div class="card-title"><h3 id="cp-ppto-t">Presupuesto vs. comprometido por proyecto</h3><span class="hint">proyectos en curso</span></div>
          <div class="legend-inline espacio">${leyendaHTML([
            ["#EEF1F8", "Presupuesto"],
            ["#B9C1F5", "Comprometido en OC"],
            [COLOR.c1, "Pagado"],
          ])}</div>
          <div id="cp-presupuestos"></div>
        </section>
        <section class="card s6" aria-labelledby="cp-req-t">
          <div class="card-title"><h3 id="cp-req-t">Requisiciones recientes</h3><span class="hint" id="cp-req-n"></span></div>
          <div class="tbl-wrap alto"><table class="tbl compacta" id="cp-req"></table></div>
        </section>
      </div>`;

    flujoCompras(raiz.querySelector("#cp-flujo"), t.flujo, t.cuello_de_botella);

    const aprobadas = new Set();
    tabla(
      raiz.querySelector("#cp-oc"),
      [
        {
          k: "numero_oc",
          t: "Orden",
          // proveedor y proyecto bajo el código: la tabla cabe en una tarjeta angosta
          html: (o) =>
            `<a class="code" href="#/ordenes-compra/${o.id}" title="${esc(descripcionDocumento(o))}">${esc(o.numero_oc)}</a>${
              o.procedencia === "importacion" ? ` ${pillHTML("info", "Importación")}` : ""
            }<div class="sub-celda fuerte">${esc(o.proveedor)}</div><div class="sub-celda">${esc(o.codigo_pry)} · ${esc(descripcionDocumento(o))}</div>`,
        },
        { k: "valor", t: "Valor", num: true, html: (o) => esc(copTexto(o.valor)) },
        { k: "dias_en_estado", t: "Espera", html: (o) => pillDias(o.dias_en_estado) },
        {
          k: "accion",
          t: "",
          sinOrden: true,
          html: (o) =>
            aprobadas.has(o.id)
              ? pillHTML("good", "Aprobada")
              : `<button type="button" class="btn-mini" data-oc="${o.id}">Aprobar</button>`,
        },
      ],
      t.oc_por_aprobar,
      {
        orden: "dias_en_estado",
        dir: -1,
        vacio: "Nada pendiente de aprobación.",
        despues: (tablaEl) =>
          $$("button[data-oc]", tablaEl).forEach((b) => {
            b.onclick = async () => {
              const o = t.oc_por_aprobar.find((x) => x.id === Number(b.dataset.oc));
              const a = { tipo: "orden_compra", id: o.id, codigo: o.numero_oc };
              if (await aprobarConConfirmacion(b, a, b.parentElement)) {
                aprobadas.add(o.id);
                b.replaceWith(
                  Object.assign(document.createElement("span"), {
                    innerHTML: pillHTML("good", "Aprobada"),
                  })
                );
              }
            };
          }),
      }
    );

    barrasHorizontales(
      raiz.querySelector("#cp-proveedores"),
      t.proveedores.map((p) => {
        const bajo = p.calificacion_actual < t.umbral_proveedor;
        return {
          label: p.razon_social,
          v: p.calificacion_actual,
          c: bajo ? COLOR.warn : COLOR.c1,
          nota: bajo ? "Bajo umbral" : "",
          tip: `Calificación ${num(p.calificacion_actual, 1)} / 100${bajo ? " · requiere plan de mejora" : ""}`,
        };
      }),
      {
        max: 100,
        umbral: t.umbral_proveedor,
        fmt: (v) => num(v, Number.isInteger(v) ? 0 : 1),
        vacio: "Aún no hay proveedores calificados.",
      }
    );

    const tablaReq = tabla(
      raiz.querySelector("#cp-req"),
      [
        {
          k: "numero_requisicion",
          t: "Requisición",
          html: (r) =>
            `<a class="code" href="#/requisiciones/${r.id}">${esc(r.numero_requisicion)}</a><div class="sub-celda">${esc(r.codigo_pry)} · ${esc(r.solicitante || "—")} · ${r.items} ítem${r.items === 1 ? "" : "s"}</div>`,
        },
        { k: "procedencia", t: "Procedencia", html: (r) => esc(textoProcedencia(r.procedencia)) },
        {
          k: "estado",
          t: "Estado",
          orden: (r) => textoEstadoRequisicion(r.estado),
          html: (r) => pillHTML(tipoPillRequisicion(r.estado), textoEstadoRequisicion(r.estado)),
        },
        { k: "creada", t: "Fecha", html: (r) => esc(fechaCorta(aFecha(r.creada))) },
      ],
      t.requisiciones,
      {
        orden: "creada",
        dir: -1,
        vacio: "Sin requisiciones para este filtro.",
        alContar: (n, total) => {
          raiz.querySelector("#cp-req-n").textContent =
            n === total ? `${total} más recientes` : `${n} de ${total}`;
        },
      }
    );

    const afProc = raiz.querySelector("#cp-af-proc");
    const controlDona = dona(
      raiz.querySelector("#cp-dona"),
      raiz.querySelector("#cp-leyenda"),
      t.procedencia.map((p) => ({
        k: p.procedencia,
        label: textoProcedencia(p.procedencia),
        v: p.cantidad,
        c: COLOR_PROCEDENCIA[p.procedencia],
      })),
      {
        centro: "requisiciones",
        vacio: `Sin requisiciones en ${anio}.`,
        onPick: (k) => {
          tablaReq.filtrar(k ? (r) => r.procedencia === k : null);
          filtroActivo(afProc, k ? textoProcedencia(k) : "", () => {
            controlDona.limpiar();
            tablaReq.filtrar(null);
            filtroActivo(afProc, "");
          });
        },
      }
    );

    presupuestos(raiz.querySelector("#cp-presupuestos"), t.presupuestos);
  }

  /* ================================================================
     Carga común de los tableros
     ================================================================ */
  async function cargarTablero(config, recarga = false) {
    marcarMenu(config.seccion);
    const ruta = window.location.hash;
    if (!recarga) {
      contenido.replaceChildren();
      const p = document.createElement("p");
      p.className = "subtitulo";
      p.textContent = "Cargando…";
      contenido.append(p);
    }
    const { status, cuerpo } = await api("GET", config.endpoint);
    // si el usuario navegó a otra vista mientras cargaba, no se pinta encima
    if (window.location.hash !== ruta) return;
    if (status !== 200) {
      contenido.replaceChildren(alerta("error", `No se pudo cargar ${config.nombre}.`));
      return;
    }
    const raiz = document.createElement("div");
    raiz.className = "tablero";
    contenido.replaceChildren(raiz);
    config.pintar(raiz, cuerpo.tablero);
    raiz
      .querySelector("[data-actualizar]")
      ?.addEventListener("click", () => cargarTablero(config, true));
  }

  window.vistaTableroGerencial = () =>
    cargarTablero({
      seccion: "tablero",
      endpoint: "/tableros/gerencial",
      nombre: "el tablero gerencial",
      pintar: pintarTableroGerencial,
    });
  window.vistaTableroComercial = () =>
    cargarTablero({
      seccion: "resumen-comercial",
      endpoint: "/tableros/comercial",
      nombre: "el resumen comercial",
      pintar: pintarTableroComercial,
    });
  window.vistaTableroCompras = () =>
    cargarTablero({
      seccion: "resumen-compras",
      endpoint: "/tableros/compras",
      nombre: "el resumen de compras",
      pintar: pintarTableroCompras,
    });
})();
