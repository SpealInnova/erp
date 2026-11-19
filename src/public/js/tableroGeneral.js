/* global api, contenido, marcarMenu, alerta, pill, boton, textoEstadoProyecto, formatoFechaHora */
/* ------------------------------------------------------------------
   Tablero general (#/inicio): la página de inicio de todos los perfiles.
   Lo que le toca a cada persona: pendientes para hoy, vencidos, lo que su
   cargo debe aprobar, cumplimiento del mes, sus proyectos, avisos y su
   semana. El tablero gerencial queda para los cargos directivos.

   "Lo que me toca" se filtra con Hoy / Esta semana / Este mes, con las
   mismas reglas que Mis tareas (incluye lo vencido y lo que no tiene fecha).
   ------------------------------------------------------------------ */
(function () {
  const UN_DIA_MS = 24 * 60 * 60 * 1000;
  const MESES = [
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic",
  ];
  const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const PERIODOS = [
    { clave: "hoy", texto: "Hoy" },
    { clave: "semana", texto: "Esta semana" },
    { clave: "mes", texto: "Este mes" },
  ];
  let periodo = "hoy";

  function crear(etiqueta, clase, texto) {
    const el = document.createElement(etiqueta);
    if (clase) el.className = clase;
    if (texto !== undefined) el.textContent = texto;
    return el;
  }

  function hoyLocal() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function deISO(valor) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor ? String(valor) : "");
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  }

  function plural(n, uno, varios) {
    return `${n} ${n === 1 ? uno : varios}`;
  }

  // Fin de la ventana del periodo: hoy, domingo de esta semana o fin de mes.
  function limiteDe(clave, hoy) {
    if (clave === "hoy") return hoy;
    if (clave === "semana")
      return new Date(hoy.getTime() + (6 - ((hoy.getDay() + 6) % 7)) * UN_DIA_MS);
    return new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
  }

  // Mismas reglas que el servidor para tareas: en la ventana, vencido, en
  // curso o sin fechas.
  function enPeriodo(item, clave, hoy) {
    const inicio = deISO(item.fecha_inicio);
    const fin = deISO(item.fecha_fin);
    if (!inicio && !fin) return true;
    if (fin && fin < hoy) return true;
    if (item.estado === "en_curso") return true;
    const desde = inicio || fin;
    const hasta = fin || inicio;
    return desde <= limiteDe(clave, hoy) && hasta >= hoy;
  }

  function textoVence(item, hoy) {
    const fin = deISO(item.fecha_fin);
    if (!fin) return "sin fecha de fin";
    const dias = Math.round((fin - hoy) / UN_DIA_MS);
    if (dias < -1) return `venció hace ${dias * -1} días`;
    if (dias === -1) return "venció ayer";
    if (dias === 0) return "vence hoy";
    if (dias === 1) return "vence mañana";
    return `vence el ${fin.getDate()} ${MESES[fin.getMonth()]}`;
  }

  function kpi(titulo, valor, detalle, tono) {
    const caja = crear("div", `kpi-general${tono ? ` kpi-general--${tono}` : ""}`);
    caja.append(
      crear("div", "kg-t", titulo),
      crear("div", "kg-v", valor),
      crear("div", "kg-d", detalle)
    );
    return caja;
  }

  function tarjeta(titulo) {
    const caja = crear("section", "tarjeta-ancha tg-tarjeta");
    caja.append(crear("h3", "", titulo));
    return caja;
  }

  // Pendientes propios (actividades y tareas) para "Lo que me toca".
  function pendientesDe(datos) {
    return [
      ...datos.actividades.map((a) => ({
        titulo: a.descripcion,
        estado: a.estado,
        prioridad: a.prioridad,
        fecha_inicio: a.fecha_inicio,
        fecha_fin: a.fecha_fin,
        origen: `${a.codigo_pry} · ${textoEstadoProyecto(a.fase)}`,
        enlace: `#/proyectos/${a.proyecto_id}/actividades/${a.id}`,
      })),
      ...datos.tareas.map((t) => ({
        titulo: t.titulo,
        estado: t.estado,
        prioridad: t.prioridad,
        fecha_inicio: t.fecha_inicio,
        fecha_fin: t.fecha_fin,
        origen: t.proyecto_codigo ? `Tarea · ${t.proyecto_codigo}` : "Tarea",
        enlace: `#/tareas/${t.id}`,
      })),
    ];
  }

  function listaLoQueMeToca(pendientes, hoy) {
    const ul = crear("ul", "lista-simple");
    const orden = (x) => {
      const fin = deISO(x.fecha_fin);
      if (fin && fin < hoy) return 0;
      if (x.prioridad === "urgente") return 1;
      if (x.estado === "en_curso") return 2;
      if (x.prioridad === "alta") return 3;
      return 4;
    };
    const visibles = pendientes
      .filter((p) => enPeriodo(p, periodo, hoy))
      .sort((a, b) => orden(a) - orden(b) || (deISO(a.fecha_fin) || 0) - (deISO(b.fecha_fin) || 0))
      .slice(0, 8);
    visibles.forEach((p) => {
      const li = crear("li");
      const fin = deISO(p.fecha_fin);
      if (fin && fin < hoy) li.append(pill("Vencida", "crit"));
      else if (p.prioridad === "urgente") li.append(pill("Urgente", "crit"));
      else if (p.prioridad === "alta") li.append(pill("Alta", "alta"));
      else if (p.estado === "en_curso") li.append(pill("En curso", "info"));
      const textos = crear("div");
      const enlace = crear("a", "", p.titulo);
      enlace.href = p.enlace;
      textos.append(enlace, crear("div", "muted", `${p.origen} · ${textoVence(p, hoy)}`));
      li.append(textos);
      ul.append(li);
    });
    if (visibles.length === 0) {
      const vacio = crear("li", "subtitulo", "Nada pendiente en este periodo.");
      ul.append(vacio);
    }
    return ul;
  }

  function pintar(raiz, tablero, pendientes) {
    const hoy = hoyLocal();
    const { kpis } = tablero;
    const nombre = (tablero.usuario.nombre || "").split(" ")[0];

    const cab = crear("div", "tg-cab");
    const textos = crear("div");
    textos.append(
      crear("h2", "", nombre ? `Hola, ${nombre}` : "Inicio"),
      crear(
        "p",
        "subtitulo",
        "Lo que te toca hoy, lo que espera tu decisión y cómo van tus proyectos."
      )
    );
    const chips = crear("div", "chips");
    chips.setAttribute("role", "group");
    chips.setAttribute("aria-label", "Periodo");
    cab.append(textos, chips);

    const fila = crear("div", "tg-kpis");
    fila.append(
      kpi(
        "Para hoy",
        String(kpis.para_hoy),
        `${plural(kpis.urgentes, "urgente o alta", "urgentes o altas")}`
      ),
      kpi(
        "Vencidas",
        String(kpis.vencidas),
        kpis.vencidas ? "Revisa la lista de abajo" : "Nada vencido",
        kpis.vencidas ? "crit" : null
      ),
      kpi(
        "Por aprobar (tu cargo)",
        String(kpis.por_aprobar),
        tablero.aprobaciones.length
          ? tablero.aprobaciones.map((a) => a.texto).join(" · ")
          : "Nada espera tu decisión",
        kpis.por_aprobar ? "warn" : null
      ),
      kpi(
        "Cumplimiento del mes",
        kpis.cumplimiento_mes === null ? "—" : `${kpis.cumplimiento_mes}%`,
        kpis.con_fecha_mes
          ? `${kpis.a_tiempo_mes} de ${kpis.con_fecha_mes} finalizadas a tiempo`
          : "Aún sin finalizadas este mes"
      )
    );

    const grilla = crear("div", "tg-grilla");

    const toca = tarjeta("Lo que me toca");
    const contLista = crear("div");
    toca.append(contLista);
    const pintarLista = () => contLista.replaceChildren(listaLoQueMeToca(pendientes, hoy));
    PERIODOS.forEach((p) => {
      const b = crear("button", "chip", p.texto);
      b.type = "button";
      b.setAttribute("aria-pressed", String(p.clave === periodo));
      b.addEventListener("click", () => {
        periodo = p.clave;
        [...chips.children].forEach((c, i) =>
          c.setAttribute("aria-pressed", String(PERIODOS[i].clave === periodo))
        );
        pintarLista();
      });
      chips.append(b);
    });
    pintarLista();
    const verTodo = crear("a", "enlace-pie", "Ver todas mis tareas →");
    verTodo.href = "#/tareas";
    toca.append(verTodo);

    const proyectos = tarjeta("Proyectos en los que participo");
    if (tablero.proyectos.length === 0) {
      proyectos.append(crear("p", "subtitulo", "No participas en proyectos abiertos."));
    } else {
      const ul = crear("ul", "lista-simple");
      tablero.proyectos.forEach((p) => {
        const total = Number(p.actividades_total) || 0;
        const avance = total ? Math.round((Number(p.actividades_finalizadas) * 100) / total) : 0;
        const li = crear("li");
        const anillo = crear(
          "div",
          `anillo anillo-chico${Number(p.vencidas) ? " anillo--crit" : ""}`
        );
        anillo.style.setProperty("--p", String(avance));
        anillo.append(crear("span", "", `${avance}%`));
        const textos2 = crear("div");
        const enlace = crear("a", "", p.nombre_proyecto);
        enlace.href = `#/proyectos/${p.id}`;
        textos2.append(
          enlace,
          crear("div", "muted", `${p.codigo_pry} · ${textoEstadoProyecto(p.estado)}`)
        );
        li.append(anillo, textos2);
        if (Number(p.vencidas))
          li.append(pill(plural(Number(p.vencidas), "vencida", "vencidas"), "crit"));
        ul.append(li);
      });
      proyectos.append(ul);
    }

    const avisos = tarjeta("Avisos recientes");
    if (tablero.avisos.length === 0) {
      avisos.append(crear("p", "subtitulo", "Sin avisos."));
    } else {
      const ul = crear("ul", "lista-simple");
      tablero.avisos.forEach((a) => {
        const li = crear("li");
        const textos2 = crear("div");
        const texto = crear(a.enlace ? "a" : "span", "", a.mensaje);
        if (a.enlace) texto.href = a.enlace;
        textos2.append(texto, crear("div", "muted", formatoFechaHora(a.created_at)));
        li.append(textos2);
        ul.append(li);
      });
      avisos.append(ul);
    }

    const semana = tarjeta("Mi semana");
    const leyenda = crear("div", "tg-leyenda");
    leyenda.append(
      crear("span", "tg-leyenda-hechas", "Finalizadas"),
      crear("span", "tg-leyenda-pendientes", "Pendientes que vencen ese día")
    );
    semana.append(leyenda);
    const barras = crear("div", "tg-semana");
    const maximo = Math.max(1, ...tablero.semana.map((d) => d.finalizadas + d.pendientes));
    tablero.semana.forEach((d, i) => {
      const esHoy = deISO(d.dia).getTime() === hoy.getTime();
      const filaDia = crear("div", `tg-dia${esHoy ? " tg-dia--hoy" : ""}`);
      const barra = crear("div", "apilada");
      [
        [d.finalizadas, "apilada-hechas"],
        [d.pendientes, "apilada-pendientes"],
      ].forEach(([n, clase]) => {
        if (!n) return;
        const tramo = crear("i", clase);
        tramo.style.width = `${(n / maximo) * 100}%`;
        barra.append(tramo);
      });
      filaDia.append(
        crear("span", "", DIAS[i]),
        barra,
        crear(
          "span",
          "muted",
          `${plural(d.finalizadas, "hecha", "hechas")} · ${plural(d.pendientes, "pendiente", "pendientes")}`
        )
      );
      barras.append(filaDia);
    });
    semana.append(barras);

    grilla.append(toca, proyectos);
    if (tablero.aprobaciones.length) {
      const aprobar = tarjeta("Espera tu decisión");
      const ul = crear("ul", "lista-simple");
      tablero.aprobaciones.forEach((a) => {
        const li = crear("li");
        li.append(pill(String(a.n), "warn"));
        const enlace = crear("a", "", a.texto);
        enlace.href = a.enlace;
        const textos2 = crear("div");
        textos2.append(enlace);
        li.append(textos2);
        ul.append(li);
      });
      aprobar.append(ul);
      grilla.append(aprobar);
    }
    grilla.append(avisos, semana);
    raiz.append(cab, fila, grilla);
  }

  async function vistaTableroGeneral() {
    marcarMenu("inicio");
    const ruta = window.location.hash;
    contenido.replaceChildren(crear("p", "subtitulo", "Cargando…"));
    const [rTablero, rPendientes] = await Promise.all([
      api("GET", "/tableros/general"),
      api("GET", "/actividades/pendientes"),
    ]);
    if ((window.location.hash || "#/inicio") !== (ruta || "#/inicio")) return;
    if (rTablero.status !== 200 || rPendientes.status !== 200) {
      contenido.replaceChildren(alerta("error", "No se pudo cargar el tablero general."));
      return;
    }
    const raiz = crear("div", "tablero-general");
    contenido.replaceChildren(raiz);
    pintar(raiz, rTablero.cuerpo.tablero, pendientesDe(rPendientes.cuerpo));
    const nueva = boton("+ Nueva tarea", () => (window.location.hash = "#/tareas/nueva"));
    raiz.querySelector(".tg-cab").append(nueva);
  }

  window.vistaTableroGeneral = vistaTableroGeneral;
})();
