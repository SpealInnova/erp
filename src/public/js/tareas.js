/* global api, contenido, marcarMenu, alerta, pill, boton, PERFIL, textoEstadoProyecto,
   obtenerUsuarios, obtenerClientes, obtenerProyectos */
/* ------------------------------------------------------------------
   Mis tareas (#/tareas): todo lo que le toca a la persona en un solo lugar.
   - Actividades de proyecto pendientes (las mismas de "Actividades
     pendientes") y tareas fuera de los proyectos (tabla tareas).
   - Filtros: periodo (hoy / semana / mes / vencidas / todas), origen y
     abiertas o finalizadas. Hoy, semana y mes incluyen también lo vencido,
     lo que está en curso y lo que no tiene fechas, para no olvidarlo.
   - Controles ▶ Iniciar, ❚❚ Pausar, ✓ Finalizar y ↺ Reabrir. Cada cambio de
     estado queda en transiciones_estado: de ahí sale el horómetro (tiempo
     acumulado en curso), que avanza en pantalla mientras está en curso.
   - #/tareas/nueva abre la ventana de nueva tarea y #/tareas/<id> la de una
     tarea (enlace de los avisos).
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
  const PERIODOS = [
    { clave: "hoy", texto: "Para hoy" },
    { clave: "semana", texto: "Esta semana" },
    { clave: "mes", texto: "Este mes" },
    { clave: "vencidas", texto: "Vencidas" },
    { clave: "todas", texto: "Todas" },
  ];
  const ORIGENES = [
    { clave: "todas", texto: "Todo" },
    { clave: "proyectos", texto: "De proyectos" },
    { clave: "propias", texto: "Propias" },
    { clave: "asignadas_a_mi", texto: "Asignadas a mí" },
    { clave: "asignadas_por_mi", texto: "Asignadas por mí" },
  ];
  const ESTADOS_LISTA = [
    { clave: "abiertas", texto: "Abiertas" },
    { clave: "finalizadas", texto: "Finalizadas" },
  ];
  const TEXTO_ESTADO = { pendiente: "Pendiente", en_curso: "En curso", completada: "Finalizado" };
  const PRIORIDADES = [
    { valor: "normal", texto: "Normal" },
    { valor: "alta", texto: "Alta" },
    { valor: "urgente", texto: "Urgente" },
  ];
  // Acciones según el estado actual: [estado destino, símbolo, texto]
  const ACCIONES = {
    pendiente: [
      ["en_curso", "▶", "Iniciar"],
      ["completada", "✓", "Finalizar"],
    ],
    en_curso: [
      ["pendiente", "❚❚", "Pausar"],
      ["completada", "✓", "Finalizar"],
    ],
    completada: [["pendiente", "↺", "Reabrir"]],
  };
  const INTERVALO_HOROMETRO_MS = 30000;

  // Los filtros se conservan al salir y volver a la vista.
  const filtros = { periodo: "hoy", origen: "todas", estado: "abiertas" };
  let secuenciaIds = 0;

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

  function aISO(d) {
    if (!d) return "";
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  function textoFecha(d) {
    return `${d.getDate()} ${MESES[d.getMonth()]}`;
  }

  function textoVence(item, hoy) {
    const fin = deISO(item.fecha_fin);
    if (item.estado === "completada") return "finalizada";
    if (!fin) return "sin fecha de fin";
    const dias = Math.round((fin - hoy) / UN_DIA_MS);
    if (dias < -1) return `venció hace ${-dias} días`;
    if (dias === -1) return "venció ayer";
    if (dias === 0) return "vence hoy";
    if (dias === 1) return "vence mañana";
    return `vence el ${textoFecha(fin)}`;
  }

  function vencida(item, hoy) {
    const fin = deISO(item.fecha_fin);
    return item.estado !== "completada" && Boolean(fin) && fin < hoy;
  }

  // Duración legible del horómetro.
  function textoDuracion(segundos) {
    const minutos = Math.floor(segundos / 60);
    if (minutos < 1) return "menos de 1 min";
    if (minutos < 60) return `${minutos} min`;
    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `${horas} h ${String(minutos % 60).padStart(2, "0")} min`;
    return `${Math.floor(horas / 24)} d ${horas % 24} h`;
  }

  // Fin de la ventana del periodo: hoy, domingo de esta semana o fin de mes.
  function limiteDe(periodo, hoy) {
    if (periodo === "hoy") return hoy;
    if (periodo === "semana") {
      return new Date(hoy.getTime() + (6 - ((hoy.getDay() + 6) % 7)) * UN_DIA_MS);
    }
    return new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
  }

  // Mismas reglas que el servidor aplica a las tareas, para las actividades.
  function enPeriodo(item, periodo, hoy) {
    if (periodo === "todas") return true;
    if (periodo === "vencidas") return vencida(item, hoy);
    const inicio = deISO(item.fecha_inicio);
    const fin = deISO(item.fecha_fin);
    if (!inicio && !fin) return true;
    if (vencida(item, hoy) || item.estado === "en_curso") return true;
    return (inicio || fin) <= limiteDe(periodo, hoy) && (fin || inicio) >= hoy;
  }

  /* ---------- Datos ---------- */

  function deActividad(a) {
    return {
      tipo: "actividad",
      id: a.id,
      titulo: a.descripcion,
      estado: a.estado,
      prioridad: a.prioridad || "normal",
      fecha_inicio: a.fecha_inicio,
      fecha_fin: a.fecha_fin,
      segundos: Number(a.segundos_en_curso) || 0,
      origen: `${a.codigo_pry} · ${textoEstadoProyecto(a.fase)}`,
      detalle: a.nombre_proyecto,
      enlace: `#/proyectos/${a.proyecto_id}/actividades/${a.id}`,
      ruta: `/proyectos/${a.proyecto_id}/actividades/${a.id}`,
    };
  }

  function deTarea(t) {
    const esMia = t.responsable_id === PERFIL.id;
    let origen = "Tarea propia";
    if (esMia && t.created_by !== PERFIL.id) origen = `Asignada por ${t.creador_nombre}`;
    if (!esMia) origen = `Para ${t.responsable_nombre}`;
    return {
      tipo: "tarea",
      id: t.id,
      titulo: t.titulo,
      estado: t.estado,
      prioridad: t.prioridad || "normal",
      fecha_inicio: t.fecha_inicio,
      fecha_fin: t.fecha_fin,
      segundos: Number(t.segundos_en_curso) || 0,
      origen,
      detalle: [t.proyecto_codigo, t.cliente_nombre, t.documento].filter(Boolean).join(" · "),
      ruta: `/tareas/${t.id}`,
      tarea: t,
    };
  }

  function ordenar(items, hoy) {
    const peso = (x) => {
      if (x.estado === "completada") return 5;
      if (vencida(x, hoy)) return 0;
      if (x.estado === "en_curso") return 1;
      if (x.prioridad === "urgente") return 2;
      if (x.prioridad === "alta") return 3;
      return 4;
    };
    const fin = (x) => {
      const d = deISO(x.fecha_fin);
      return d ? d.getTime() : Number.MAX_SAFE_INTEGER;
    };
    return items.sort((a, b) => peso(a) - peso(b) || fin(a) - fin(b) || a.id - b.id);
  }

  async function cargarItems() {
    const conActividades =
      filtros.estado === "abiertas" &&
      (filtros.origen === "todas" || filtros.origen === "proyectos");
    const conTareas = filtros.origen !== "proyectos";
    const consulta = new URLSearchParams({
      periodo: filtros.periodo,
      origen: filtros.origen,
      estado: filtros.estado,
    });
    const [ra, rt] = await Promise.all([
      conActividades ? api("GET", "/actividades/pendientes") : null,
      conTareas ? api("GET", `/tareas?${consulta}`) : null,
    ]);
    if ((ra && ra.status !== 200) || (rt && rt.status !== 200)) return null;
    const hoy = hoyLocal();
    const actividades = ra
      ? ra.cuerpo.actividades.filter((a) => enPeriodo(a, filtros.periodo, hoy)).map(deActividad)
      : [];
    const tareas = rt ? rt.cuerpo.tareas.map(deTarea) : [];
    return ordenar([...actividades, ...tareas], hoy);
  }

  /* ---------- Lista ---------- */

  function horometro(item) {
    if (!item.segundos && item.estado !== "en_curso") return null;
    const span = crear(
      "span",
      `horometro${item.estado === "en_curso" ? " horometro--activo" : ""}`
    );
    span.dataset.base = String(item.segundos);
    span.dataset.desde = String(Date.now());
    span.dataset.activo = item.estado === "en_curso" ? "1" : "0";
    span.title = "Tiempo acumulado en curso";
    actualizarHorometro(span);
    return span;
  }

  function actualizarHorometro(span) {
    const extra =
      span.dataset.activo === "1" ? (Date.now() - Number(span.dataset.desde)) / 1000 : 0;
    span.textContent = `⏱ ${textoDuracion(Number(span.dataset.base) + extra)}`;
  }

  function fila(item, hoy, acciones) {
    const clases = ["tarea-fila"];
    if (vencida(item, hoy)) clases.push("tarea-fila--vencida");
    if (item.estado === "en_curso") clases.push("tarea-fila--en-curso");
    if (item.estado === "completada") clases.push("tarea-fila--completada");
    const li = crear("li", clases.join(" "));

    const controles = crear("div", "tarea-acciones");
    (ACCIONES[item.estado] || ACCIONES.pendiente).forEach(([destino, simbolo, texto]) => {
      const b = crear("button", `tarea-accion tarea-accion--${destino}`, simbolo);
      b.type = "button";
      b.title = texto;
      b.setAttribute("aria-label", `${texto}: ${item.titulo}`);
      b.addEventListener("click", () => acciones.cambiarEstado(item, destino, b));
      controles.append(b);
    });

    const textos = crear("div", "tarea-textos");
    let titulo;
    if (item.tipo === "actividad") {
      titulo = crear("a", "tarea-titulo", item.titulo);
      titulo.href = item.enlace;
    } else {
      titulo = crear("button", "tarea-titulo tarea-titulo--boton", item.titulo);
      titulo.type = "button";
      titulo.addEventListener("click", () => acciones.abrir(item.tarea));
    }
    const meta = crear("div", "tarea-meta");
    meta.append(crear("span", "", item.origen));
    if (item.detalle) meta.append(crear("span", "", item.detalle));
    meta.append(crear("span", "", textoVence(item, hoy)));
    textos.append(titulo, meta);

    const etiquetas = crear("div", "tarea-etiquetas");
    etiquetas.append(pill(item.tipo === "actividad" ? "Proyecto" : "Tarea", "mute"));
    if (vencida(item, hoy)) etiquetas.append(pill("Vencida", "crit"));
    // La prioridad Normal no se muestra: Alta en amarillo, Urgente en rojo.
    if (item.prioridad === "urgente") etiquetas.append(pill("Urgente", "crit"));
    if (item.prioridad === "alta") etiquetas.append(pill("Alta", "alta"));
    if (item.estado !== "pendiente") {
      etiquetas.append(
        pill(TEXTO_ESTADO[item.estado], item.estado === "en_curso" ? "info" : "good")
      );
    }
    const reloj = horometro(item);
    if (reloj) etiquetas.append(reloj);

    li.append(controles, textos, etiquetas);
    if (item.tipo === "tarea") {
      const gestionar = crear("button", "tarea-accion tarea-accion--gestionar", "⚙");
      gestionar.type = "button";
      gestionar.title = "Gestionar la tarea";
      gestionar.setAttribute("aria-label", `Gestionar la tarea ${item.titulo}`);
      gestionar.addEventListener("click", () => acciones.abrir(item.tarea));
      li.append(gestionar);
    } else {
      const ir = crear("a", "tarea-accion tarea-accion--ir", "→");
      ir.href = item.enlace;
      ir.title = "Abrir en el proyecto";
      ir.setAttribute("aria-label", `Abrir ${item.titulo} en el proyecto`);
      li.append(ir);
    }
    return li;
  }

  function grupoChips(etiqueta, opciones, clave, alCambiar) {
    const caja = crear("div", "chips");
    caja.setAttribute("role", "group");
    caja.setAttribute("aria-label", etiqueta);
    opciones.forEach((o) => {
      const b = crear("button", "chip", o.texto);
      b.type = "button";
      b.setAttribute("aria-pressed", String(filtros[clave] === o.clave));
      b.addEventListener("click", () => {
        if (filtros[clave] === o.clave) return;
        filtros[clave] = o.clave;
        [...caja.children].forEach((c, i) =>
          c.setAttribute("aria-pressed", String(opciones[i].clave === o.clave))
        );
        alCambiar();
      });
      caja.append(b);
    });
    return caja;
  }

  /* ---------- Ventana de tarea (nueva o existente) ---------- */

  function campo(etiqueta, control, ayuda) {
    const div = crear("div", "campo");
    const id = `tarea-campo-${++secuenciaIds}`;
    const label = crear("label", "", etiqueta);
    label.htmlFor = id;
    control.id = id;
    div.append(label, control);
    if (ayuda) div.append(crear("small", "ayuda-campo", ayuda));
    return div;
  }

  function entrada(tipo, valor) {
    const input = document.createElement("input");
    input.type = tipo;
    input.value = valor || "";
    return input;
  }

  function selector(opciones, valor) {
    const select = document.createElement("select");
    opciones.forEach(({ valor: v, texto }) => {
      const o = crear("option", "", texto);
      o.value = v;
      select.append(o);
    });
    select.value = valor;
    return select;
  }

  // Opciones de proyectos (de un cliente si se eligió uno); la actual siempre.
  function opcionesProyectos(proyectos, clienteId, tarea) {
    const lista = proyectos
      .filter((p) => !clienteId || String(p.cliente_id) === String(clienteId))
      .map((p) => ({ valor: String(p.id), texto: `${p.codigo_pry} · ${p.nombre_proyecto}` }));
    if (tarea?.proyecto_id && !lista.some((o) => o.valor === String(tarea.proyecto_id))) {
      lista.unshift({
        valor: String(tarea.proyecto_id),
        texto: tarea.proyecto_codigo || "Proyecto",
      });
    }
    return [{ valor: "", texto: "— Ninguno —" }, ...lista];
  }

  async function abrirVentanaTarea(tarea, { alGuardar, alCerrar } = {}) {
    const [usuarios, clientes, proyectos] = await Promise.all([
      obtenerUsuarios(),
      obtenerClientes(),
      obtenerProyectos(),
    ]);
    const esNueva = !tarea;
    const idTitulo = `tarea-dialogo-${++secuenciaIds}`;
    const dialogo = crear("dialog", "dialogo");
    dialogo.setAttribute("aria-labelledby", idTitulo);

    const cabecera = crear("header", "dialogo-cabecera");
    const titulos = crear("div");
    const subtitulo = esNueva ? "Mis tareas · Nueva" : `Tarea · creada por ${tarea.creador_nombre}`;
    titulos.append(
      crear("p", "subtitulo", subtitulo),
      Object.assign(crear("h3", "", esNueva ? "Nueva tarea" : tarea.titulo), { id: idTitulo })
    );
    const cerrarX = crear("button", "boton-icono", "×");
    cerrarX.type = "button";
    cerrarX.setAttribute("aria-label", "Cerrar");
    cerrarX.addEventListener("click", () => cerrar());
    cabecera.append(titulos, cerrarX);

    const mensaje = crear("div");
    const form = crear("form", "dialogo-seccion");
    form.noValidate = true;
    form.dataset.sucioVigilado = "1"; // tiene sus propios Guardar/Cancelar

    const titulo = entrada("text", tarea?.titulo);
    titulo.maxLength = 200;
    titulo.required = true;
    const descripcion = crear("textarea");
    descripcion.rows = 3;
    descripcion.maxLength = 2000;
    descripcion.value = tarea?.descripcion || "";
    const activos = usuarios.filter(
      (u) => (u.activo !== 0 && u.activo !== false) || u.id === tarea?.responsable_id
    );
    const responsable = selector(
      activos.map((u) => ({
        valor: String(u.id),
        texto: u.id === PERFIL.id ? `${u.nombre} (yo)` : u.nombre,
      })),
      String(tarea?.responsable_id || PERFIL.id || "")
    );
    const prioridad = selector(PRIORIDADES, tarea?.prioridad || "normal");
    const estado = selector(
      Object.entries(TEXTO_ESTADO).map(([valor, texto]) => ({ valor, texto })),
      tarea?.estado || "pendiente"
    );
    const fechaInicio = entrada("date", tarea ? aISO(deISO(tarea.fecha_inicio)) : "");
    const fechaFin = entrada("date", tarea ? aISO(deISO(tarea.fecha_fin)) : "");
    const cliente = selector(
      [
        { valor: "", texto: "— Ninguno —" },
        ...clientes.map((c) => ({ valor: String(c.id), texto: c.nombre_razon_social })),
      ],
      tarea?.cliente_id ? String(tarea.cliente_id) : ""
    );
    if (tarea?.cliente_id && cliente.value !== String(tarea.cliente_id)) {
      cliente.append(
        Object.assign(crear("option", "", tarea.cliente_nombre || "Cliente"), {
          value: String(tarea.cliente_id),
        })
      );
      cliente.value = String(tarea.cliente_id);
    }
    const proyecto = selector(
      opcionesProyectos(proyectos, cliente.value, tarea),
      tarea?.proyecto_id ? String(tarea.proyecto_id) : ""
    );
    cliente.addEventListener("change", () => {
      const actual = proyecto.value;
      proyecto.replaceChildren(
        ...opcionesProyectos(proyectos, cliente.value, null).map((o) =>
          Object.assign(crear("option", "", o.texto), { value: o.valor })
        )
      );
      proyecto.value = [...proyecto.options].some((o) => o.value === actual) ? actual : "";
    });
    const documento = entrada("text", tarea?.documento);
    documento.maxLength = 80;
    documento.placeholder = "Ej.: COT-0012, OC-0045";

    const rejilla = crear("div", "formulario-grid");
    rejilla.append(
      campo("Tarea *", titulo),
      campo(
        "Responsable",
        responsable,
        esNueva ? "Por defecto, tú. Si es otra persona, le llega un aviso." : null
      ),
      campo("Prioridad", prioridad, "Alta y Urgente avisan al responsable."),
      ...(esNueva ? [] : [campo("Estado", estado)]),
      campo("Fecha de inicio", fechaInicio),
      campo("Fecha de fin", fechaFin, "Opcional. Con fecha de fin, avisa cuando esté por vencer.")
    );
    const campoDescripcion = campo("Descripción", descripcion);
    campoDescripcion.classList.add("campo-ancho");

    const relacion = crear("fieldset", "tarea-relacion");
    relacion.append(crear("legend", "", "Relacionada con (opcional)"));
    const rejillaRelacion = crear("div", "formulario-grid");
    rejillaRelacion.append(
      campo("Cliente", cliente),
      campo("Proyecto", proyecto),
      campo("Documento", documento)
    );
    relacion.append(rejillaRelacion);

    const guardar = crear(
      "button",
      "boton boton-pequeno",
      esNueva ? "Crear tarea" : "Guardar cambios"
    );
    guardar.type = "submit";
    const accionesForm = crear("div", "dialogo-acciones");
    accionesForm.append(
      guardar,
      boton("Cancelar", () => cerrar(), true)
    );
    if (!esNueva && tarea.segundos_en_curso) {
      accionesForm.append(
        crear("span", "horometro", `⏱ ${textoDuracion(tarea.segundos_en_curso)} en curso`)
      );
    }
    form.append(rejilla, campoDescripcion, relacion, accionesForm);

    let modificado = false;
    let guardada = false;
    form.addEventListener("input", () => (modificado = true));
    form.addEventListener("change", () => (modificado = true));

    form.addEventListener("submit", async (evento) => {
      evento.preventDefault();
      mensaje.replaceChildren();
      const fi = fechaInicio.value;
      const ff = fechaFin.value;
      if (!titulo.value.trim()) {
        mensaje.append(alerta("error", "Escribe la tarea."));
        titulo.focus();
        return;
      }
      if (fi && ff && ff < fi) {
        mensaje.append(alerta("error", "La fecha de fin no puede ser anterior a la de inicio."));
        return;
      }
      const valores = {
        titulo: titulo.value.trim(),
        descripcion: descripcion.value.trim() || null,
        responsable_id: responsable.value ? Number(responsable.value) : null,
        prioridad: prioridad.value,
        fecha_inicio: fi || null,
        fecha_fin: ff || null,
        cliente_id: cliente.value ? Number(cliente.value) : null,
        proyecto_id: proyecto.value ? Number(proyecto.value) : null,
        documento: documento.value.trim() || null,
      };
      let datos = valores;
      if (!esNueva) {
        // Solo lo que cambió (cada cambio queda en la auditoría).
        const anterior = {
          ...tarea,
          fecha_inicio: aISO(deISO(tarea.fecha_inicio)) || null,
          fecha_fin: aISO(deISO(tarea.fecha_fin)) || null,
          descripcion: tarea.descripcion || null,
          documento: tarea.documento || null,
        };
        datos = {};
        Object.entries(valores).forEach(([clave, valor]) => {
          if ((anterior[clave] ?? null) !== valor) datos[clave] = valor;
        });
        if (datos.responsable_id === null) delete datos.responsable_id;
        if (estado.value !== tarea.estado) datos.estado = estado.value;
        if (Object.keys(datos).length === 0) {
          cerrar(true);
          return;
        }
      }
      guardar.disabled = true;
      const r = esNueva
        ? await api("POST", "/tareas", datos)
        : await api("PUT", `/tareas/${tarea.id}`, datos);
      guardar.disabled = false;
      if (r.status !== 200 && r.status !== 201) {
        mensaje.append(alerta("error", r.cuerpo?.error || "No se pudo guardar la tarea."));
        return;
      }
      modificado = false;
      guardada = true;
      cerrar(true);
      if (alGuardar) await alGuardar(r.cuerpo.tarea);
    });

    const cuerpo = crear("div", "dialogo-cuerpo");
    cuerpo.append(mensaje, form);

    // Eliminar: quien la creó (o administración / Gerencia).
    if (!esNueva && (tarea.created_by === PERFIL.id || PERFIL.superusuario)) {
      const zona = crear("section", "dialogo-seccion dialogo-quitar");
      const eliminar = boton(
        "Eliminar tarea",
        async () => {
          if (!window.confirm(`¿Eliminar la tarea "${tarea.titulo}"?`)) return;
          const r = await api("DELETE", `/tareas/${tarea.id}`);
          if (r.status !== 204) {
            mensaje.replaceChildren(
              alerta("error", r.cuerpo?.error || "No se pudo eliminar la tarea.")
            );
            return;
          }
          guardada = true;
          cerrar(true);
          if (alGuardar) await alGuardar(null);
        },
        true
      );
      eliminar.classList.add("boton-peligro");
      zona.append(crear("p", "subtitulo", "Deja de verse en Mis tareas y en el inicio."), eliminar);
      cuerpo.append(zona);
    }
    dialogo.append(cabecera, cuerpo);

    function cerrar(sinPreguntar = false) {
      if (
        !sinPreguntar &&
        modificado &&
        !window.confirm("Hay cambios sin guardar en la tarea. ¿Descartarlos?")
      )
        return;
      dialogo.close();
    }
    dialogo.addEventListener("cancel", (e) => {
      e.preventDefault();
      cerrar();
    });
    // Si la ruta cambia con la ventana abierta (p. ej. con Atrás del
    // navegador), la ventana se cierra como las demás del ERP y no se vuelve a
    // la lista: manda la ruta a la que fue la persona.
    const rutaAlAbrir = window.location.hash;
    let cerradaPorCambioDeRuta = false;
    const alCambiarRuta = () => {
      if (window.location.hash === rutaAlAbrir) return;
      cerradaPorCambioDeRuta = true;
      dialogo.close();
    };
    window.addEventListener("hashchange", alCambiarRuta);

    dialogo.addEventListener("close", () => {
      window.removeEventListener("hashchange", alCambiarRuta);
      dialogo.remove();
      if (alCerrar && !cerradaPorCambioDeRuta) alCerrar(guardada);
    });

    document.body.append(dialogo);
    dialogo.showModal();
    titulo.focus();
  }

  /* ---------- Vista ---------- */

  async function vistaTareas({ nueva = false, tareaId = null } = {}) {
    marcarMenu("tareas");
    const ruta = window.location.hash;
    contenido.replaceChildren(crear("p", "subtitulo", "Cargando…"));

    const raiz = crear("div", "vista-tareas");
    const cab = crear("div", "encabezado");
    const textos = crear("div");
    textos.append(
      crear("h2", "", "Mis tareas"),
      crear(
        "p",
        "subtitulo",
        "Tus actividades de proyecto y tus tareas fuera de los proyectos, en un solo lugar."
      )
    );
    // Desde #/tareas/nueva o #/tareas/<id>, al cerrar la ventana se vuelve a la lista.
    const volverALista = () => {
      if (window.location.hash !== "#/tareas") window.location.hash = "#/tareas";
    };
    const nuevaTarea = boton("+ Nueva tarea", () =>
      abrirVentanaTarea(null, { alGuardar: () => recargar() })
    );
    cab.append(textos, nuevaTarea);

    const barra = crear("div", "tareas-filtros");
    const mensaje = crear("div");
    const lista = crear("ul", "tareas-lista");
    const nota = crear("p", "subtitulo");
    raiz.append(cab, barra, mensaje, lista, nota);

    const acciones = {
      async cambiarEstado(item, destino, control) {
        control.disabled = true;
        const r = await api("PUT", item.ruta, { estado: destino });
        control.disabled = false;
        if (r.status !== 200) {
          mensaje.replaceChildren(
            alerta("error", r.cuerpo?.error || "No se pudo cambiar el estado.")
          );
          return;
        }
        mensaje.replaceChildren();
        if (window.actualizarMisActividades) window.actualizarMisActividades();
        await recargar();
      },
      abrir(tarea) {
        abrirVentanaTarea(tarea, { alGuardar: () => recargar() });
      },
    };

    async function recargar() {
      const items = await cargarItems();
      if (!raiz.isConnected) return; // el usuario ya navegó a otra vista
      if (!items) {
        lista.replaceChildren();
        mensaje.replaceChildren(alerta("error", "No se pudieron cargar tus tareas."));
        return;
      }
      const hoy = hoyLocal();
      lista.replaceChildren(...items.map((item) => fila(item, hoy, acciones)));
      if (items.length === 0) {
        lista.append(crear("li", "tareas-vacio", "Nada en este filtro."));
      }
      nota.textContent =
        filtros.estado === "finalizadas" && ["todas", "proyectos"].includes(filtros.origen)
          ? "Las actividades de proyecto finalizadas se consultan en el diagrama de cada proyecto."
          : "";
    }

    barra.append(
      grupoChips("Periodo", PERIODOS, "periodo", recargar),
      grupoChips("Origen", ORIGENES, "origen", recargar),
      grupoChips("Estado", ESTADOS_LISTA, "estado", recargar)
    );

    contenido.replaceChildren(raiz);
    await recargar();

    // Horómetro: avanza en pantalla mientras la vista esté abierta.
    const reloj = setInterval(() => {
      if (!raiz.isConnected) {
        clearInterval(reloj);
        return;
      }
      raiz.querySelectorAll(".horometro--activo").forEach(actualizarHorometro);
    }, INTERVALO_HOROMETRO_MS);

    if (window.location.hash !== ruta) return;
    if (nueva) {
      abrirVentanaTarea(null, { alGuardar: () => recargar(), alCerrar: volverALista });
    } else if (tareaId) {
      const r = await api("GET", `/tareas/${tareaId}`);
      if (window.location.hash !== ruta) return;
      if (r.status !== 200) {
        mensaje.replaceChildren(alerta("error", "La tarea no existe o no tienes acceso a ella."));
        return;
      }
      abrirVentanaTarea(r.cuerpo.tarea, { alGuardar: () => recargar(), alCerrar: volverALista });
    }
  }

  window.vistaTareas = vistaTareas;
})();
