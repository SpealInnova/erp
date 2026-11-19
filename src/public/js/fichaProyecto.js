/* global api, pill, boton, textoEstadoProyecto, ETAPAS_PROYECTO_LINEAL,
          describirEventoLineaTiempo, DOCUMENTOS_LINEA_TIEMPO, formatoFechaHora */
/* ------------------------------------------------------------------
   Ficha del proyecto: "Siguiente paso", "Resumen por etapa" y la línea de
   tiempo gráfica.

   - Siguiente paso: qué sigue en el flujo, quién lo hace y qué implica, con
     un botón que lleva a hacerlo (los documentos nuevos abren ya enlazados
     al proyecto: #/<módulo>/nuevo?proyecto=ID).
   - Resumen por etapa: una tarjeta por fase (plan frente a real, avance,
     urgentes, vencidas) y, al elegir una, sus métricas, su línea de tiempo,
     sus avisos y sus evidencias.
   - Línea de tiempo: vertical, agrupada por fase y con cuánto duró cada una,
     con filtros por tipo de evento.

   Usa funciones de inicio.js (se llaman al pintar, cuando ya existen).
   ------------------------------------------------------------------ */
(function () {
  const UN_DIA_MS = 24 * 60 * 60 * 1000;
  const UNA_HORA_MS = 60 * 60 * 1000;
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
  const DIAS_POR_VENCER = 3;
  const QUIEN = {
    aprobar_oc: "Dirección Administrativa y Financiera (o Gerencia)",
    pagar_oc: "Dirección Administrativa, Contabilidad (o Gerencia)",
    aprobar_diseno: "Dirección de Operaciones o Jefe de I+D+i",
    comercial: "Comercial",
    compras: "Compras",
    diseno: "Diseño I+D+i",
  };
  const FILTROS = [
    { clave: "todo", texto: "Todo" },
    { clave: "fase", texto: "Fases" },
    { clave: "actividad", texto: "Actividades" },
    { clave: "documento", texto: "Documentos" },
    { clave: "evidencia", texto: "Evidencias" },
  ];

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

  function fechaCorta(d) {
    return d ? `${d.getDate()} ${MESES[d.getMonth()]}` : "—";
  }

  function plural(n, uno, varios) {
    return `${n} ${n === 1 ? uno : varios}`;
  }

  function duracion(ms) {
    if (ms < UNA_HORA_MS) return `${Math.max(1, Math.round(ms / 60000))} min`;
    if (ms < UN_DIA_MS) return `${Math.round(ms / UNA_HORA_MS)} h`;
    return plural(Math.round(ms / UN_DIA_MS), "día", "días");
  }

  // Datos de la ficha: se piden una vez por pintada y se comparten.
  async function cargarDatos(proyectoId) {
    const [rResumen, rActividades, rDocs, rLinea] = await Promise.all([
      api("GET", `/proyectos/${proyectoId}/resumen-etapas`),
      api("GET", `/proyectos/${proyectoId}/actividades`),
      api("GET", `/proyectos/${proyectoId}/documentos`),
      api("GET", `/proyectos/${proyectoId}/linea-tiempo`),
    ]);
    if ([rResumen, rActividades, rDocs, rLinea].some((r) => r.status !== 200)) return null;
    return {
      resumen: rResumen.cuerpo,
      actividades: rActividades.cuerpo.actividades,
      documentos: rDocs.cuerpo.documentos,
      eventos: rLinea.cuerpo.eventos,
    };
  }

  /* ---------------- Siguiente paso ---------------- */

  function siguienteFase(fase) {
    const i = ETAPAS_PROYECTO_LINEAL.findIndex((e) => e.valor === fase);
    return i >= 0 && i < ETAPAS_PROYECTO_LINEAL.length - 1 ? ETAPAS_PROYECTO_LINEAL[i + 1] : null;
  }

  function irA(hash) {
    return () => (window.location.hash = hash);
  }

  function enfocarCampo(id, valor) {
    return () => {
      const campo = document.getElementById(id);
      if (!campo) return;
      if (valor !== undefined) campo.value = valor;
      campo.scrollIntoView({ block: "center" });
      campo.focus();
    };
  }

  // Requisitos de documentos de la fase actual (en orden de urgencia).
  function pasoDeDocumentos(proyecto, docs) {
    const id = proyecto.id;
    switch (proyecto.estado) {
      case "prospecto":
        if (!docs.cotizacion) {
          return {
            titulo: "Vincular la cotización aceptada del cliente",
            quien: QUIEN.comercial,
            implica:
              'Se elige en "Cotización de origen". Con el proyecto ya acordado, pasa a Planeación y se crean sus actividades.',
            acciones: [["Elegir cotización", enfocarCampo("cotizacion_id")]],
          };
        }
        return null;
      case "diseno": {
        if (docs.expedientes.length === 0) {
          return {
            titulo: "Crear el expediente de diseño",
            quien: QUIEN.diseno,
            implica:
              "En el expediente se registran requisitos, verificaciones y validación. Al liberarlo, el equipo pasa al registro y el proyecto puede ir a Compras.",
            acciones: [["Crear expediente", irA(`#/expedientes-diseno/nuevo?proyecto=${id}`)]],
          };
        }
        const pendiente = docs.expedientes.find((e) => e.estado_liberacion === "pendiente");
        if (pendiente) {
          return {
            titulo: `Completar y liberar ${pendiente.codigo_expediente}`,
            quien: QUIEN.aprobar_diseno,
            implica:
              "Liberado, el expediente queda de solo lectura y el equipo pasa al registro con su serial.",
            acciones: [["Ir al expediente", irA(`#/expedientes-diseno/${pendiente.id}`)]],
          };
        }
        return null;
      }
      case "compras": {
        if (docs.requisiciones.length === 0) {
          return {
            titulo: "Crear la requisición de materiales",
            quien: QUIEN.compras,
            implica: "De la requisición salen las órdenes de compra a los proveedores.",
            acciones: [["Crear requisición", irA(`#/requisiciones/nuevo?proyecto=${id}`)]],
          };
        }
        const porAprobar = docs.ordenes_compra.find((o) => o.estado === "pte_aprobar");
        if (porAprobar) {
          return {
            titulo: `Aprobar ${porAprobar.numero_oc}`,
            quien: QUIEN.aprobar_oc,
            implica: "Al aprobarla pasa a pago; quien la creó no puede aprobarla.",
            acciones: [["Ir a la OC", irA(`#/ordenes-compra/${porAprobar.id}`)]],
          };
        }
        const porPagar = docs.ordenes_compra.find((o) => o.estado === "aprobada_pte_pago");
        if (porPagar) {
          return {
            titulo: `Registrar el pago de ${porPagar.numero_oc}`,
            quien: QUIEN.pagar_oc,
            implica: "Con las órdenes pagadas, el material puede llegar a producción.",
            acciones: [["Ir a la OC", irA(`#/ordenes-compra/${porPagar.id}`)]],
          };
        }
        return null;
      }
      case "logistica":
        if (docs.actas_entrega.length === 0) {
          return {
            titulo: "Elaborar el acta de entrega de equipos",
            quien: "el responsable del proyecto",
            implica: "El acta registra qué equipos se entregan y quién los recibe.",
            acciones: [["Crear acta de entrega", irA(`#/actas-entrega/nuevo?proyecto=${id}`)]],
          };
        }
        return null;
      case "seguimiento":
        if (docs.actas_cierre.length === 0) {
          return {
            titulo: "Elaborar el acta de cierre a satisfacción",
            quien: "el responsable del proyecto",
            implica: "Con el acta de cierre el proyecto puede pasar a Cerrado.",
            acciones: [["Crear acta de cierre", irA(`#/actas-cierre/nuevo?proyecto=${id}`)]],
          };
        }
        return null;
      default:
        return null;
    }
  }

  function calcularSiguientePaso(proyecto, datos, usuarios) {
    if (["cerrado", "cancelado"].includes(proyecto.estado)) {
      return {
        titulo: `Proyecto ${textoEstadoProyecto(proyecto.estado).toLowerCase()}: no hay pasos pendientes`,
        quien: null,
        implica: "Su historia completa está en la línea de tiempo.",
        acciones: [],
      };
    }
    const porDocumentos = pasoDeDocumentos(proyecto, datos.documentos);
    if (porDocumentos) return porDocumentos;

    const deFase = datos.actividades.filter((a) => a.fase === proyecto.estado);
    const abiertas = deFase
      .filter((a) => a.estado !== "completada")
      .sort((a, b) => {
        const peso = (x) =>
          x.estado === "en_curso"
            ? 0
            : x.prioridad === "urgente"
              ? 1
              : x.prioridad === "alta"
                ? 2
                : 3;
        if (peso(a) !== peso(b)) return peso(a) - peso(b);
        const fa = deISO(a.fecha_fin);
        const fb = deISO(b.fecha_fin);
        if (fa && fb) return fa - fb;
        return fa ? -1 : fb ? 1 : a.orden - b.orden;
      });
    const siguiente = siguienteFase(proyecto.estado);
    if (abiertas.length > 0) {
      const a = abiertas[0];
      const responsable = usuarios.find((u) => String(u.valor) === String(a.responsable_id));
      return {
        titulo: `${a.estado === "en_curso" ? "Terminar" : "Avanzar"}: ${a.descripcion}`,
        quien: responsable ? responsable.texto : null,
        implica: `${
          responsable ? "" : "Aún no tiene responsable: asígnalo con el engranaje de la actividad. "
        }Quedan ${plural(abiertas.length, "actividad", "actividades")} por finalizar en ${textoEstadoProyecto(
          proyecto.estado
        )} (de ${deFase.length}).${siguiente ? ` Al finalizarlas, el proyecto puede pasar a ${siguiente.texto}.` : ""}`,
        acciones: [["Ir a la actividad", irA(`#/proyectos/${proyecto.id}/actividades/${a.id}`)]],
      };
    }
    if (siguiente) {
      return {
        titulo: `Pasar a ${siguiente.texto}`,
        quien: "el responsable del proyecto",
        implica: `Las actividades de ${textoEstadoProyecto(proyecto.estado)} están finalizadas. Al cambiar de fase se crean las de ${siguiente.texto} y empieza a contar su tiempo.`,
        acciones: [["Cambiar de fase", enfocarCampo("nueva_fase", siguiente.valor)]],
      };
    }
    return null;
  }

  async function panelSiguientePaso(proyecto, usuarios, datosPrevios) {
    const datos = datosPrevios || (await cargarDatos(proyecto.id));
    if (!datos) return crear("div");
    const paso = calcularSiguientePaso(proyecto, datos, usuarios);
    if (!paso) return crear("div");
    const panel = crear("section", "siguiente-paso");
    panel.setAttribute("aria-label", "Siguiente paso");
    const ico = crear("div", "sp-ico", "→");
    ico.setAttribute("aria-hidden", "true");
    const textos = crear("div", "sp-textos");
    textos.append(crear("h3", "", `Siguiente paso: ${paso.titulo}`));
    const p = crear("p");
    if (paso.quien) {
      p.append(
        document.createTextNode("Lo hace "),
        crear("b", "", paso.quien),
        document.createTextNode(". ")
      );
    }
    p.append(document.createTextNode(paso.implica));
    textos.append(p);
    const acciones = crear("div", "sp-acciones");
    paso.acciones.forEach(([texto, accion], i) => acciones.append(boton(texto, accion, i > 0)));
    panel.append(ico, textos, acciones);
    return panel;
  }

  /* ---------------- Eventos agrupados por fase ---------------- */

  function tipoEvento(e) {
    if (e.tabla === "proyectos") return e.cambio_estado || e.accion === "crear" ? "fase" : "otro";
    if (e.tabla === "proyecto_actividades") return "actividad";
    if (e.tabla === "archivos_adjuntos") return "evidencia";
    if (DOCUMENTOS_LINEA_TIEMPO[e.tabla]) return "documento";
    return "otro";
  }

  function iconoEvento(e) {
    const tipo = tipoEvento(e);
    if (tipo === "fase") return ["⇢", "fase"];
    if (tipo === "documento") return ["▤", "doc"];
    if (tipo === "evidencia") return ["◎", "evi"];
    if (tipo === "actividad") {
      const est = e.actividad_cambio_estado;
      if (est && est.a === "completada") return ["✓", "ok"];
      if (est && est.a === "en_curso") return ["▶", "doc"];
      if (est && est.a === "pendiente") return ["❚❚", "mute"];
      if (e.actividad_cambio_prioridad && e.actividad_cambio_prioridad.a !== "normal")
        return ["!", "alt"];
    }
    return ["•", "mute"];
  }

  // Cuánto estuvo en curso una actividad antes de finalizarse (si se usó
  // "Iniciar"), a partir de las transiciones del proyecto.
  function lapsoEnCurso(evento, transiciones) {
    const est = evento.actividad_cambio_estado;
    if (!est || est.a !== "completada") return null;
    const fin = new Date(evento.creado_en);
    const inicios = transiciones.filter(
      (t) =>
        t.entidad === "actividad" &&
        t.registro_id === evento.actividad_id &&
        t.estado_nuevo === "en_curso" &&
        new Date(t.created_at) <= fin
    );
    if (inicios.length === 0) return null;
    return `${duracion(fin - new Date(inicios[inicios.length - 1].created_at))} en curso`;
  }

  // Asigna cada evento a una fase: las actividades (y sus evidencias) a la
  // suya; lo demás, a la fase vigente en ese momento.
  function agruparPorFase(datos) {
    const faseDeActividad = new Map(datos.actividades.map((a) => [a.id, a.fase]));
    const periodos = datos.resumen.etapas.filter((e) => e.entrada);
    const faseEn = (momento) => {
      // sin historial de fases (proyectos anteriores): la fase actual
      let fase = periodos.length ? periodos[0].fase : datos.resumen.fase_actual;
      periodos.forEach((p) => {
        if (new Date(p.entrada) <= momento) fase = p.fase;
      });
      return fase;
    };
    const grupos = new Map();
    [...datos.eventos]
      .sort((a, b) => new Date(a.creado_en) - new Date(b.creado_en) || a.id - b.id)
      .forEach((e) => {
        let fase = null;
        if (e.tabla === "proyecto_actividades") fase = e.actividad_fase;
        else if (e.tabla === "archivos_adjuntos" && e.evidencia_tabla === "proyecto_actividades") {
          fase = faseDeActividad.get(e.evidencia_registro_id) || null;
        } else if (e.cambio_estado) fase = e.cambio_estado.a;
        // La creación va a la fase inicial aunque el primer cambio de fase
        // caiga en el mismo segundo (las horas se guardan sin milisegundos).
        else if (e.tabla === "proyectos" && e.accion === "crear" && periodos.length) {
          fase = periodos[0].fase;
        }
        if (!fase) fase = faseEn(new Date(e.creado_en));
        if (!grupos.has(fase)) grupos.set(fase, []);
        grupos.get(fase).push(e);
      });
    return grupos;
  }

  function itemEvento(e, transiciones) {
    const [icono, tono] = iconoEvento(e);
    const li = crear("li", "vtl-ev");
    li.dataset.tipo = tipoEvento(e);
    const ico = crear("span", `vtl-ico vtl-ico--${tono}`, icono);
    ico.setAttribute("aria-hidden", "true");
    const textos = crear("div", "vtl-txt");
    const documento = DOCUMENTOS_LINEA_TIEMPO[e.tabla];
    let principal;
    if (documento && e.accion !== "eliminar" && e.documento_id) {
      principal = crear("a", "enlace-documento", describirEventoLineaTiempo(e));
      principal.href = `${documento.ruta}${e.documento_id}`;
    } else if (e.tabla === "archivos_adjuntos" && e.evidencia_enlace && e.accion !== "eliminar") {
      principal = crear("a", "enlace-documento", describirEventoLineaTiempo(e));
      principal.href = e.evidencia_enlace;
      principal.target = "_blank";
      principal.rel = "noopener noreferrer";
    } else {
      principal = crear("span", "", describirEventoLineaTiempo(e));
    }
    textos.append(principal, crear("span", "muted", e.usuario_nombre || "Sistema"));
    const cuando = crear("div", "vtl-cuando", formatoFechaHora(e.creado_en));
    const lapso = lapsoEnCurso(e, transiciones);
    if (lapso) cuando.append(crear("span", "vtl-lapso", lapso));
    li.append(ico, textos, cuando);
    return li;
  }

  function cabeceraFase(etapa) {
    const li = crear("li", `vtl-fase vtl-fase--${etapa ? etapa.estado : "por_iniciar"}`);
    li.append(crear("span", "vtl-fase-nom", textoEstadoProyecto(etapa.fase)));
    let detalle = "";
    if (etapa.entrada) {
      const desde = fechaCorta(new Date(etapa.entrada));
      detalle =
        etapa.estado === "en_curso"
          ? `desde ${desde} · día ${etapa.dias_en_fase}`
          : `${desde} → ${fechaCorta(new Date(etapa.salida))} · ${plural(etapa.dias_en_fase, "día", "días")}`;
      if (etapa.plan_dias) detalle += ` (plan ${etapa.plan_dias})`;
    } else if (etapa.plan_dias) {
      detalle = `plan ${plural(etapa.plan_dias, "día", "días")}`;
    }
    if (detalle) li.append(crear("span", "vtl-fase-dur", detalle));
    return li;
  }

  /* ---------------- Línea de tiempo (pestaña) ---------------- */

  async function vistaLineaTiempo(proyectoId) {
    const tarjeta = crear("div", "tarjeta-ancha linea-tiempo-grafica");
    const datos = await cargarDatos(proyectoId);
    if (!datos) {
      tarjeta.append(crear("p", "subtitulo", "No se pudo cargar la línea de tiempo."));
      return tarjeta;
    }
    const cab = crear("div", "ltg-cab");
    cab.append(crear("h3", "", "Todo lo que ha pasado en el proyecto"));
    const chips = crear("div", "chips");
    chips.setAttribute("role", "group");
    chips.setAttribute("aria-label", "Mostrar");
    cab.append(chips);

    const lista = crear("ol", "vtl");
    const grupos = agruparPorFase(datos);
    const etapaDe = new Map(datos.resumen.etapas.map((e) => [e.fase, e]));
    ETAPAS_PROYECTO_LINEAL.map((e) => e.valor)
      .concat(["cancelado"])
      .filter((fase) => grupos.has(fase))
      .forEach((fase) => {
        lista.append(cabeceraFase(etapaDe.get(fase) || { fase, estado: "completada" }));
        grupos.get(fase).forEach((e) => lista.append(itemEvento(e, datos.resumen.transiciones)));
      });
    if (!lista.childElementCount) {
      tarjeta.append(
        cab,
        crear("p", "subtitulo", "Aún no hay eventos registrados para este proyecto.")
      );
      return tarjeta;
    }

    let filtro = "todo";
    function aplicar() {
      [...lista.children].forEach((li) => {
        if (li.classList.contains("vtl-fase")) return;
        li.hidden = filtro !== "todo" && li.dataset.tipo !== filtro;
      });
      [...chips.children].forEach((c) =>
        c.setAttribute("aria-pressed", String(c.dataset.clave === filtro))
      );
    }
    FILTROS.forEach((f) => {
      const c = crear("button", "chip", f.texto);
      c.type = "button";
      c.dataset.clave = f.clave;
      c.addEventListener("click", () => {
        filtro = f.clave;
        aplicar();
      });
      chips.append(c);
    });
    aplicar();
    tarjeta.append(cab, lista);
    return tarjeta;
  }

  /* ---------------- Resumen por etapa (pestaña) ---------------- */

  function metrica(titulo, valor) {
    const d = crear("div", "met");
    d.append(crear("div", "met-t", titulo), crear("div", "met-v", valor));
    return d;
  }

  function avisosDeEtapa(etapa, actividades, proyectoId) {
    const hoy = hoyLocal();
    const caja = crear("div", "tarjeta-ancha");
    caja.append(crear("h3", "", "Avisos de la etapa"));
    const items = [];
    actividades
      .filter((a) => a.fase === etapa.fase && a.estado !== "completada")
      .forEach((a) => {
        const fin = deISO(a.fecha_fin);
        const dias = fin ? Math.round((fin - hoy) / UN_DIA_MS) : null;
        let motivo = null;
        if (a.prioridad === "urgente") motivo = ["Urgente", "crit"];
        else if (dias !== null && dias < 0) motivo = ["Vencida", "crit"];
        else if (a.prioridad === "alta") motivo = ["Alta", "alta"];
        else if (dias !== null && dias <= DIAS_POR_VENCER) motivo = ["Por vencer", "warn"];
        if (motivo) items.push({ a, motivo, dias });
      });
    if (items.length === 0) {
      caja.append(crear("p", "subtitulo", "Nada urgente ni por vencer en esta etapa."));
      return caja;
    }
    const ul = crear("ul", "lista-simple");
    items.forEach(({ a, motivo, dias }) => {
      const li = crear("li");
      li.append(pill(motivo[0], motivo[1]));
      const textos = crear("div");
      const enlace = crear("a", "", a.descripcion);
      enlace.href = `#/proyectos/${proyectoId}/actividades/${a.id}`;
      const meta =
        dias === null
          ? "sin fecha de fin"
          : dias < 0
            ? `venció hace ${plural(-dias, "día", "días")}`
            : dias === 0
              ? "vence hoy"
              : `vence en ${plural(dias, "día", "días")}`;
      textos.append(enlace, crear("div", "muted", meta));
      li.append(textos);
      ul.append(li);
    });
    caja.append(ul);
    caja.append(
      crear(
        "p",
        "muted",
        "La prioridad se cambia con el engranaje de la actividad: Alta o Urgente avisa a su responsable, a los de la etapa y al del proyecto."
      )
    );
    return caja;
  }

  function evidenciasDeEtapa(etapa, datos) {
    const caja = crear("div", "tarjeta-ancha");
    caja.append(crear("h3", "", "Evidencias de la etapa"));
    const deFase = new Set(datos.actividades.filter((a) => a.fase === etapa.fase).map((a) => a.id));
    const quitadas = new Set(
      datos.eventos
        .filter((e) => e.tabla === "archivos_adjuntos" && e.accion === "eliminar")
        .map((e) => e.id)
    );
    const subidas = datos.eventos.filter(
      (e) =>
        e.tabla === "archivos_adjuntos" &&
        e.accion === "crear" &&
        e.evidencia_tabla === "proyecto_actividades" &&
        deFase.has(e.evidencia_registro_id) &&
        !quitadas.has(e.id)
    );
    if (subidas.length === 0) {
      caja.append(crear("p", "subtitulo", "Aún no hay evidencias en esta etapa."));
      return caja;
    }
    const ul = crear("ul", "lista-simple");
    subidas.forEach((e) => {
      const li = crear("li");
      const textos = crear("div");
      const nombre = crear(e.evidencia_enlace ? "a" : "span", "", e.evidencia_nombre || "Archivo");
      if (e.evidencia_enlace) {
        nombre.href = e.evidencia_enlace;
        nombre.target = "_blank";
        nombre.rel = "noopener noreferrer";
      }
      textos.append(
        nombre,
        crear("div", "muted", `${e.usuario_nombre || "—"} · ${formatoFechaHora(e.creado_en)}`)
      );
      li.append(textos);
      ul.append(li);
    });
    caja.append(ul);
    return caja;
  }

  async function vistaResumenEtapas(proyectoId) {
    const caja = crear("div", "resumen-etapas");
    const datos = await cargarDatos(proyectoId);
    if (!datos) {
      caja.append(crear("p", "subtitulo", "No se pudo cargar el resumen."));
      return caja;
    }
    const etapas = datos.resumen.etapas;
    const tira = crear("div", "etapas-tira");
    tira.setAttribute("role", "group");
    tira.setAttribute("aria-label", "Etapas del proyecto");
    const detalle = crear("div", "etapa-detalle");
    const grupos = agruparPorFase(datos);

    function elegir(i) {
      [...tira.children].forEach((b, j) => b.setAttribute("aria-pressed", String(j === i)));
      const e = etapas[i];
      const pct = e.actividades_total
        ? Math.round((e.actividades_finalizadas * 100) / e.actividades_total)
        : 0;
      const principal = crear("div", "tarjeta-ancha");
      const cab = crear("div", "etapa-det-cab");
      const textoEstado =
        e.estado === "completada"
          ? `Completada${e.dias_en_fase ? ` en ${plural(e.dias_en_fase, "día", "días")}` : ""}`
          : e.estado === "en_curso"
            ? `En curso${e.dias_en_fase ? ` · día ${e.dias_en_fase}${e.plan_dias ? ` de ${e.plan_dias}` : ""}` : ""}`
            : "Por iniciar";
      cab.append(
        crear("h3", "", textoEstadoProyecto(e.fase)),
        pill(
          textoEstado,
          e.estado === "completada" ? "good" : e.estado === "en_curso" ? "info" : "mute"
        )
      );
      const metricas = crear("div", "metricas");
      metricas.append(
        metrica("Plan", e.plan_dias ? plural(e.plan_dias, "día", "días") : "—"),
        metrica("Transcurrido", e.dias_en_fase ? plural(e.dias_en_fase, "día", "días") : "—"),
        metrica("Actividades", `${pct}% · ${e.actividades_finalizadas}/${e.actividades_total}`),
        metrica("Evidencias", String(e.evidencias))
      );
      const sub = crear("h4", "etapa-sub", "Línea de tiempo de la etapa");
      const lista = crear("ol", "vtl");
      (grupos.get(e.fase) || []).forEach((ev) =>
        lista.append(itemEvento(ev, datos.resumen.transiciones))
      );
      principal.append(cab, metricas, sub);
      principal.append(
        lista.childElementCount
          ? lista
          : crear(
              "p",
              "subtitulo",
              "La etapa aún no tiene eventos. Sus actividades y documentos aparecerán aquí."
            )
      );
      const lateral = crear("div", "etapa-lateral");
      lateral.append(avisosDeEtapa(e, datos.actividades, proyectoId), evidenciasDeEtapa(e, datos));
      detalle.replaceChildren(principal, lateral);
    }

    etapas.forEach((e, i) => {
      const b = crear("button", `etapa-tarjeta etapa-tarjeta--${e.estado}`);
      b.type = "button";
      const pct = e.actividades_total
        ? Math.round((e.actividades_finalizadas * 100) / e.actividades_total)
        : 0;
      const dias =
        e.dias_en_fase !== null
          ? `${e.dias_en_fase}${e.plan_dias ? ` de ${e.plan_dias}` : ""} d`
          : e.plan_dias
            ? `Plan ${e.plan_dias} d`
            : "Sin plan";
      const barra = crear("div", "barra");
      const relleno = crear("i");
      relleno.style.width = `${pct}%`;
      barra.append(relleno);
      b.append(
        crear("span", "et-n", String(i + 1)),
        crear("span", "et-nom", textoEstadoProyecto(e.fase)),
        crear("span", "et-dias", dias),
        barra
      );
      const marcas = crear("span", "et-marcas");
      if (e.urgentes) marcas.append(pill(plural(e.urgentes, "urgente", "urgentes"), "crit"));
      if (e.vencidas) marcas.append(pill(`${e.vencidas} venc.`, "crit"));
      if (marcas.childElementCount) b.append(marcas);
      b.setAttribute(
        "aria-label",
        `${textoEstadoProyecto(e.fase)}: ${dias}, ${pct}% de actividades`
      );
      b.addEventListener("click", () => elegir(i));
      tira.append(b);
    });
    const actual = etapas.findIndex((e) => e.estado === "en_curso");
    elegir(actual >= 0 ? actual : 0);
    caja.append(tira, detalle);
    return caja;
  }

  window.panelSiguientePaso = panelSiguientePaso;
  window.vistaResumenEtapas = vistaResumenEtapas;
  window.vistaLineaTiempo = vistaLineaTiempo;
})();
