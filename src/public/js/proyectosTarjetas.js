/* global api, pill, boton, textoEstadoProyecto, tipoPillProyecto, ETAPAS_PROYECTO_LINEAL,
          puede, controlEliminarProyecto, columnasDocumentosProyecto */
/* ------------------------------------------------------------------
   Proyectos en tarjetas.

   Cada proyecto muestra su línea de tiempo (inicio y fin del plan, marca de
   hoy, avance real), la fase y la actividad en curso o próxima, y su % de
   cumplimiento. Todas las tarjetas de la página comparten la misma escala
   de tiempo, para comparar proyectos de un vistazo. "Ver detalle" despliega
   las etapas, lo próximo y los documentos (se piden al abrir).

   El semáforo (a tiempo / en riesgo / atrasado) se calcula aquí con los
   datos de la lista: atrasado si tiene actividades vencidas o pasó el fin
   del plan; en riesgo si tiene urgentes o su avance va más de 25 puntos
   por detrás del tiempo transcurrido.

   Usa funciones de inicio.js (se llaman al pintar, cuando ya existen).
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
  const CERRADOS = ["cerrado", "cancelado"];
  const SEMAFOROS = [
    { clave: "todos", texto: "Todos" },
    { clave: "a_tiempo", texto: "A tiempo" },
    { clave: "en_riesgo", texto: "En riesgo" },
    { clave: "atrasado", texto: "Atrasados" },
  ];
  let filtroSemaforo = "todos"; // se conserva al paginar o buscar

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

  // Fecha de la BD tal cual (AAAA-MM-DD), sin correrla por zona horaria.
  function deISO(valor) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor ? String(valor) : "");
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  }

  function fechaCorta(d) {
    return d ? `${d.getDate()} ${MESES[d.getMonth()]}` : "—";
  }

  function plural(n, uno, varios) {
    return `${n} ${n === 1 ? uno : varios}`;
  }

  // Avance, fechas y semáforo de un proyecto con los datos de la lista.
  function estadoDe(p, hoy) {
    const total = Number(p.actividades_total) || 0;
    const finalizadas = Number(p.actividades_finalizadas) || 0;
    const avance = total ? Math.round((finalizadas * 100) / total) : 0;
    const inicio = deISO(p.plan_inicio) || deISO(p.created_at);
    const fin = deISO(p.plan_fin);
    const vencidas = Number(p.vencidas) || 0;
    const urgentes = Number(p.urgentes) || 0;
    let semaforo = { clave: "a_tiempo", texto: "A tiempo", tipo: "good" };
    if (CERRADOS.includes(p.estado)) {
      semaforo = { clave: "cerrado", texto: textoEstadoProyecto(p.estado), tipo: "mute" };
    } else if (fin && fin < hoy && avance < 100) {
      const dias = Math.round((hoy - fin) / UN_DIA_MS);
      semaforo = { clave: "atrasado", texto: `Atrasado ${dias} d`, tipo: "crit" };
    } else if (vencidas > 0) {
      semaforo = {
        clave: "atrasado",
        texto: plural(vencidas, "vencida", "vencidas"),
        tipo: "crit",
      };
    } else if (urgentes > 0) {
      semaforo = { clave: "en_riesgo", texto: "En riesgo", tipo: "warn" };
    } else if (inicio && fin && fin > inicio) {
      const esperado = Math.min(100, Math.max(0, ((hoy - inicio) / (fin - inicio)) * 100));
      if (esperado - avance > 25)
        semaforo = { clave: "en_riesgo", texto: "En riesgo", tipo: "warn" };
    }
    return { total, finalizadas, avance, inicio, fin, vencidas, urgentes, semaforo };
  }

  function escala(estados, hoy) {
    const fechas = [hoy];
    estados.forEach((e) => {
      if (e.inicio) fechas.push(e.inicio);
      if (e.fin) fechas.push(e.fin);
    });
    let desde = new Date(Math.min(...fechas));
    let hasta = new Date(Math.max(...fechas));
    // un poco de aire a los lados y nunca un rango de cero días
    desde = new Date(desde.getTime() - 3 * UN_DIA_MS);
    hasta = new Date(Math.max(hasta.getTime() + 3 * UN_DIA_MS, desde.getTime() + 30 * UN_DIA_MS));
    return (d) => ((d - desde) / (hasta - desde)) * 100;
  }

  function anillo(avance, tipo) {
    const a = crear("div", `anillo anillo--${tipo}`);
    a.style.setProperty("--p", String(avance));
    a.setAttribute("role", "img");
    a.setAttribute("aria-label", `Cumplimiento ${avance}%`);
    a.append(crear("span", "", `${avance}%`));
    return a;
  }

  function cronograma(p, e, pos, hoy) {
    const caja = crear("div", "crono");
    const fechas = crear("div", "crono-fechas");
    fechas.append(
      crear("span", "", e.inicio ? `Inicio ${fechaCorta(e.inicio)}` : "Sin fechas"),
      crear(
        "span",
        "",
        e.fin
          ? `Fin ${fechaCorta(e.fin)}${e.semaforo.clave === "atrasado" && e.fin < hoy ? " · vencido" : ""}`
          : ""
      )
    );
    const pista = crear("div", "crono-pista");
    pista.setAttribute("aria-hidden", "true");
    if (e.inicio && e.fin) {
      const izq = pos(e.inicio);
      const plan = crear("div", "crono-plan");
      plan.style.left = `${izq}%`;
      plan.style.width = `${Math.max(pos(e.fin) - izq, 0.8)}%`;
      const real = crear("div", `crono-real${e.semaforo.clave === "atrasado" ? " atraso" : ""}`);
      real.style.left = `${izq}%`;
      const hastaReal = e.semaforo.clave === "atrasado" ? hoy : new Date(Math.min(hoy, e.fin));
      real.style.width = `${Math.max(pos(hastaReal) - izq, 0)}%`;
      pista.append(plan, real);
    }
    const marcaHoy = crear("div", "crono-hoy");
    marcaHoy.style.left = `${pos(hoy)}%`;
    pista.append(marcaHoy);

    const fases = crear("div", "crono-fases");
    fases.setAttribute("aria-label", `Fase ${textoEstadoProyecto(p.estado)}`);
    const indice = ETAPAS_PROYECTO_LINEAL.findIndex((x) => x.valor === p.estado);
    ETAPAS_PROYECTO_LINEAL.forEach((etapa, i) => {
      const seg = crear("i", i < indice ? "ok" : i === indice ? "act" : "");
      seg.title = etapa.texto;
      fases.append(seg);
    });

    const actual = crear("div", "crono-actual");
    if (p.actividad_actual) {
      actual.append(
        document.createTextNode(
          p.actividad_actual_estado === "en_curso" ? "En curso: " : "Próxima: "
        ),
        crear("b", "", p.actividad_actual)
      );
      const fin = deISO(p.actividad_actual_fin);
      if (fin) actual.append(document.createTextNode(` · vence ${fechaCorta(fin)}`));
    } else {
      actual.textContent = e.total
        ? "Todas las actividades finalizadas"
        : "Sin actividades todavía";
    }
    caja.append(fechas, pista, fases, actual);
    return caja;
  }

  // Detalle desplegable: etapas con su avance, lo próximo y documentos.
  async function detalle(p, contenedor) {
    contenedor.replaceChildren(crear("p", "subtitulo", "Cargando…"));
    const [rEtapas, rActividades, rDocs] = await Promise.all([
      api("GET", `/proyectos/${p.id}/resumen-etapas`),
      api("GET", `/proyectos/${p.id}/actividades`),
      api("GET", `/proyectos/${p.id}/documentos`),
    ]);
    contenedor.replaceChildren();

    const colEtapas = crear("div");
    colEtapas.append(crear("h4", "", "Etapas"));
    if (rEtapas.status === 200) {
      const lista = crear("div", "mini-etapas");
      rEtapas.cuerpo.etapas
        .filter((x) => x.actividades_total > 0 || x.estado === "en_curso")
        .forEach((x) => {
          const fila = crear("div", `mini-etapa ${x.estado}`);
          const pct = x.actividades_total
            ? Math.round((x.actividades_finalizadas * 100) / x.actividades_total)
            : 0;
          const barra = crear("div", "barra");
          const relleno = crear("i");
          relleno.style.width = `${pct}%`;
          barra.append(relleno);
          const dias =
            x.dias_en_fase !== null
              ? `${x.dias_en_fase} d${x.plan_dias ? ` / ${x.plan_dias}` : ""}`
              : x.plan_dias
                ? `plan ${x.plan_dias} d`
                : "";
          fila.append(
            crear("span", "", textoEstadoProyecto(x.fase)),
            barra,
            crear("span", "muted", `${pct}%`),
            crear("span", "muted", dias)
          );
          if (x.urgentes)
            fila.title = plural(x.urgentes, "actividad urgente", "actividades urgentes");
          lista.append(fila);
        });
      colEtapas.append(
        lista.childElementCount ? lista : crear("p", "subtitulo", "Aún sin actividades.")
      );
    }

    const colProximo = crear("div");
    colProximo.append(crear("h4", "", "Lo próximo"));
    if (rActividades.status === 200) {
      const proximas = rActividades.cuerpo.actividades
        .filter((a) => a.estado !== "completada")
        .sort((a, b) => {
          if ((a.estado === "en_curso") !== (b.estado === "en_curso"))
            return a.estado === "en_curso" ? -1 : 1;
          const fa = deISO(a.fecha_fin);
          const fb = deISO(b.fecha_fin);
          if (fa && fb) return fa - fb;
          return fa ? -1 : fb ? 1 : 0;
        })
        .slice(0, 4);
      const ul = crear("ul", "lista-simple");
      proximas.forEach((a) => {
        const li = crear("li");
        const textos = crear("div");
        const enlace = crear("a", "", a.descripcion);
        enlace.href = `#/proyectos/${p.id}/actividades/${a.id}`;
        const meta = [textoEstadoProyecto(a.fase)];
        const fin = deISO(a.fecha_fin);
        if (fin) meta.push(`vence ${fechaCorta(fin)}`);
        textos.append(enlace, crear("div", "muted", meta.join(" · ")));
        li.append(textos);
        if (a.estado === "en_curso") li.append(pill("En curso", "info"));
        if (a.prioridad === "alta") li.append(pill("Alta", "alta"));
        if (a.prioridad === "urgente") li.append(pill("Urgente", "crit"));
        ul.append(li);
      });
      colProximo.append(proximas.length ? ul : crear("p", "subtitulo", "Nada pendiente."));
    }

    const colDocs = crear("div");
    colDocs.append(crear("h4", "", "Documentos"));
    if (rDocs.status === 200) {
      const chips = crear("div", "chips-docs");
      columnasDocumentosProyecto(rDocs.cuerpo.documentos).forEach((col) => {
        col.items.forEach((item) => {
          const a = crear("a", "chip-doc", col.codigo(item));
          a.href = col.enlace(item);
          a.title = col.titulo;
          chips.append(a);
        });
      });
      colDocs.append(
        chips.childElementCount ? chips : crear("p", "subtitulo", "Sin documentos enlazados.")
      );
    }
    contenedor.append(colEtapas, colProximo, colDocs);
  }

  function tarjeta(p, e, pos, hoy, recargar) {
    const art = crear("article", "pcard");
    art.dataset.semaforo = e.semaforo.clave;
    const cab = crear("div", "pcard-cab");

    const datos = crear("div", "pcard-datos");
    const cod = crear("div", "pcard-cod", p.codigo_pry);
    const nom = crear("h3", "pcard-nom", p.nombre_proyecto);
    const cli = crear(
      "div",
      "pcard-cli",
      [p.cliente_nombre, p.responsable_nombre].filter(Boolean).join(" · ")
    );
    const estados = crear("div", "pcard-estados");
    estados.append(
      pill(e.semaforo.texto, e.semaforo.tipo),
      pill(textoEstadoProyecto(p.estado), tipoPillProyecto(p.estado))
    );
    if (e.urgentes) estados.append(pill(plural(e.urgentes, "urgente", "urgentes"), "crit"));
    datos.append(cod, nom, cli, estados);

    const acciones = crear("div", "pcard-acciones");
    const abrir = boton("Abrir", () => (window.location.hash = `#/proyectos/${p.id}`), true);
    abrir.setAttribute("aria-label", `Ver proyecto ${p.codigo_pry}`);
    const idDetalle = `pcard-det-${p.id}`;
    const desplegar = crear("button", "boton-icono pcard-chev", "›");
    desplegar.type = "button";
    desplegar.setAttribute("aria-expanded", "false");
    desplegar.setAttribute("aria-controls", idDetalle);
    desplegar.setAttribute("aria-label", `Ver detalle de ${p.codigo_pry}`);
    acciones.append(abrir, desplegar);

    cab.append(datos, cronograma(p, e, pos, hoy), anillo(e.avance, e.semaforo.tipo), acciones);

    const det = crear("div", "pcard-det");
    det.id = idDetalle;
    det.hidden = true;
    const columnas = crear("div", "pcard-det-columnas");
    det.append(columnas);
    if (puede("cancelar_proyecto")) {
      const control = controlEliminarProyecto(p, recargar);
      const pie = crear("div", "pcard-det-pie");
      pie.append(control.boton);
      det.append(pie, control.panel);
    }
    let cargado = false;
    desplegar.addEventListener("click", () => {
      const abrirlo = det.hidden;
      det.hidden = !abrirlo;
      desplegar.setAttribute("aria-expanded", String(abrirlo));
      art.classList.toggle("abierta", abrirlo);
      if (abrirlo && !cargado) {
        cargado = true;
        detalle(p, columnas);
      }
    });

    art.append(cab, det);
    return art;
  }

  // Pinta la página de proyectos como tarjetas, con el filtro de semáforo.
  function tarjetasProyectos(proyectos, recargar) {
    const hoy = hoyLocal();
    const estados = proyectos.map((p) => estadoDe(p, hoy));
    const pos = escala(estados, hoy);

    const caja = crear("div", "proyectos-tarjetas");
    const chips = crear("div", "chips");
    chips.setAttribute("role", "group");
    chips.setAttribute("aria-label", "Filtrar por plazo");
    const lista = crear("div", "pcards");
    const vacio = crear("p", "subtitulo", "Ningún proyecto de esta página está en ese grupo.");
    vacio.hidden = true;

    const tarjetas = proyectos.map((p, i) => tarjeta(p, estados[i], pos, hoy, recargar));
    lista.append(...tarjetas);

    function aplicar() {
      let visibles = 0;
      tarjetas.forEach((t) => {
        const ver = filtroSemaforo === "todos" || t.dataset.semaforo === filtroSemaforo;
        t.hidden = !ver;
        if (ver) visibles += 1;
      });
      vacio.hidden = visibles > 0;
      [...chips.children].forEach((c) =>
        c.setAttribute("aria-pressed", String(c.dataset.clave === filtroSemaforo))
      );
    }

    SEMAFOROS.forEach((s) => {
      const n =
        s.clave === "todos"
          ? proyectos.length
          : estados.filter((e) => e.semaforo.clave === s.clave).length;
      const chip = crear("button", "chip");
      chip.type = "button";
      chip.dataset.clave = s.clave;
      chip.append(document.createTextNode(s.texto), crear("span", "chip-n", String(n)));
      chip.addEventListener("click", () => {
        filtroSemaforo = s.clave;
        aplicar();
      });
      chips.append(chip);
    });
    aplicar();

    caja.append(chips, lista, vacio);
    return caja;
  }

  window.tarjetasProyectos = tarjetasProyectos;
})();
