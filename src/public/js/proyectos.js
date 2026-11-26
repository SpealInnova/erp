/* global
   ESTADOS_PROYECTO, alerta, api, bloqueModoVersion, bloqueoEliminacionProyecto, boton,
   botonCancelar, botonEvidenciasProyecto, celda, confirmarCreacion, construirCampo,
   construirStageTrack, contenido, encabezado, enfocarActividad, estadoPill, fechaCortaTexto,
   guardarDocumento, marcarMenu, montarListado, mostrarCargando, mostrarErroresValidacion,
   obtenerClientes, obtenerCotizaciones, obtenerUsuarios, opcionesSegunPermiso, pestanasVista,
   preferenciaVista, puede, renderPanelVersiones, renderSeccionActividadesProyecto,
   renderSeccionDocumentosProyecto, renderSeccionPresupuestoProyecto, selectorVista,
   textoEstadoProyecto, tipoPillProyecto */
/* exported vistaProyectoForm, vistaProyectos */
// Proyectos: lista y ficha (cabecera, cinco pestañas y formulario).

async function vistaProyectos() {
  marcarMenu("proyectos");
  const nuevo = boton("Nuevo proyecto", () => (window.location.hash = "#/proyectos/nuevo"));
  const acciones = document.createElement("div");
  acciones.className = "encabezado-acciones";
  acciones.append(selectorVista("proyectos", vistaProyectos), nuevo);
  contenido.replaceChildren(encabezado("Proyectos", [acciones]));
  const comoTabla = preferenciaVista("proyectos") === "tabla";
  await montarListado({
    clave: "proyectos",
    api: "/proyectos",
    campo: "proyectos",
    titulo: "proyectos",
    buscar: "Buscar por código, nombre o cliente",
    estados: ESTADOS_PROYECTO,
    vacio: "Aún no hay proyectos registrados.",
    // tarjetas con línea de tiempo y avance; la tabla queda como vista compacta
    pintar: comoTabla ? tablaProyectos : window.tarjetasProyectos,
  });
}

// Eliminar un proyecto: botón y panel con lo que lo bloquea (documentos
// enlazados) o con la confirmación (contraseña y justificación). Lo usan la
// tabla y las tarjetas de la lista. alCambiarVisible(visible) avisa cuándo
// se abre o se cierra el panel.
function controlEliminarProyecto(p, recargar, alCambiarVisible = () => {}) {
  const panel = document.createElement("div");
  panel.className = "panel-eliminar-proyecto";
  panel.hidden = true;

  function mostrar(visible) {
    panel.hidden = !visible;
    if (!visible) panel.replaceChildren();
    alCambiarVisible(visible);
  }

  // El formulario (con su campo de contraseña) se crea solo al pulsar
  // "Eliminar" y va en su propio <form>: si existiera desde el inicio, el
  // navegador lo toma por un inicio de sesión y llena el correo guardado
  // en el buscador de la lista, que entonces no muestra ningún proyecto.
  function crearFormEliminar() {
    const formEliminar = document.createElement("form");
    formEliminar.noValidate = true;
    formEliminar.dataset.sucioVigilado = "1"; // confirmación, no edición
    formEliminar.style.display = "flex";
    formEliminar.style.flexDirection = "column";
    formEliminar.style.gap = "8px";
    formEliminar.style.padding = "12px 0";
    formEliminar.style.maxWidth = "420px";

    const nota = document.createElement("p");
    nota.className = "subtitulo";
    nota.textContent =
      "Si quieres adjuntar una evidencia, súbela primero en Evidencias dentro del proyecto. " +
      "Aquí solo confirmas tu contraseña y el motivo de la eliminación.";
    formEliminar.append(nota);

    const inputPassword = document.createElement("input");
    inputPassword.type = "password";
    inputPassword.autocomplete = "current-password";
    inputPassword.placeholder = "Tu contraseña";
    inputPassword.setAttribute("aria-label", `Confirmar contraseña para eliminar ${p.codigo_pry}`);

    const textareaJustificacion = document.createElement("textarea");
    textareaJustificacion.rows = 2;
    textareaJustificacion.placeholder = "Justificación de la eliminación";
    textareaJustificacion.setAttribute("aria-label", `Justificación para eliminar ${p.codigo_pry}`);

    const mensajeEliminar = document.createElement("div");

    const confirmarEliminar = boton(
      "Confirmar eliminación",
      async () => {
        const password = inputPassword.value;
        const justificacion = textareaJustificacion.value.trim();
        mensajeEliminar.replaceChildren();
        if (!password || !justificacion) {
          mensajeEliminar.append(
            alerta("error", "La contraseña y la justificación son obligatorias.")
          );
          return;
        }
        const r = await api("DELETE", `/proyectos/${p.id}`, { password, justificacion });
        if (r.status === 204) {
          // recarga la misma página de la lista, con la búsqueda vigente
          recargar();
          return;
        }
        mensajeEliminar.replaceChildren(
          alerta("error", r.cuerpo?.error || "No se pudo eliminar el proyecto.")
        );
      },
      true
    );

    const cancelarEliminar = boton(
      "Cancelar",
      () => mostrar(false),
      true
    );

    formEliminar.addEventListener("submit", (evento) => {
      evento.preventDefault();
      confirmarEliminar.click();
    });
    formEliminar.append(inputPassword, textareaJustificacion, mensajeEliminar, confirmarEliminar, cancelarEliminar);
    return formEliminar;
  }

  const eliminar = boton(
    "Eliminar",
    async () => {
      if (!panel.hidden) {
        mostrar(false);
        return;
      }
      mostrar(true);
      // con documentos enlazados no se elimina: se muestra qué lo bloquea
      const bloqueo = await bloqueoEliminacionProyecto(p, () => mostrar(false));
      panel.replaceChildren(bloqueo || crearFormEliminar());
    },
    true
  );
  eliminar.setAttribute("aria-label", `Eliminar proyecto ${p.codigo_pry}`);
  return { boton: eliminar, panel };
}

// Nombres de cliente y responsable llegan resueltos del API (JOIN).
function tablaProyectos(proyectos, recargar) {
  const tarjeta = document.createElement("div");
  tarjeta.className = "tarjeta-ancha";
  const tabla = document.createElement("table");
  const thead = document.createElement("thead");
  const filaCabecera = document.createElement("tr");
  ["Código", "Nombre", "Cliente", "Fase", "Responsable", ""].forEach((texto) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = texto;
    filaCabecera.append(th);
  });
  thead.append(filaCabecera);

  const tbody = document.createElement("tbody");
  proyectos.forEach((p) => {
    const fila = document.createElement("tr");
    [
      p.codigo_pry,
      p.nombre_proyecto,
      p.cliente_nombre || "—",
      estadoPill(textoEstadoProyecto(p.estado), tipoPillProyecto(p.estado)),
      p.responsable_nombre || "—",
    ].forEach((valor) => {
      fila.append(celda(valor));
    });
    const accion = document.createElement("td");
    const editar = boton(
      "Ver / Editar",
      () => (window.location.hash = `#/proyectos/${p.id}`),
      true
    );
    editar.setAttribute("aria-label", `Ver proyecto ${p.codigo_pry}`);
    const filaConfirmacion = document.createElement("tr");
    filaConfirmacion.style.display = "none";
    const tdConfirmacion = document.createElement("td");
    tdConfirmacion.colSpan = 6;
    const control = controlEliminarProyecto(p, recargar, (visible) => {
      filaConfirmacion.style.display = visible ? "" : "none";
    });
    tdConfirmacion.append(control.panel);
    filaConfirmacion.append(tdConfirmacion);
    accion.append(editar);
    if (puede("cancelar_proyecto")) accion.append(control.boton);
    fila.append(accion);
    tbody.append(fila, filaConfirmacion);
  });

  tabla.append(thead, tbody);
  tarjeta.append(tabla);
  return tarjeta;
}

// opciones.modoVersion: corrige el proyecto como una nueva versión (con motivo).
// Cabecera de la ficha: código y versión, nombre, y una línea con cliente,
// responsable, fase y fechas. Las fechas salen de las actividades, que carga
// la pestaña Actividades (ponerFechas).
function cabeceraFichaProyecto(proyecto, clientes, usuarios, acciones) {
  const elemento = document.createElement("div");
  elemento.className = "ficha-cab";
  const textos = document.createElement("div");
  const codigo = document.createElement("div");
  codigo.className = "ficha-cod";
  codigo.textContent = `${proyecto.codigo_pry} · v${proyecto.version || 1}`;
  const nombre = document.createElement("h2");
  nombre.textContent = proyecto.nombre_proyecto;
  const sub = document.createElement("p");
  sub.className = "ficha-sub";
  const responsable = usuarios.find((u) => u.id === proyecto.responsable_id);
  sub.textContent = [
    nombreClienteDe(clientes, proyecto.cliente_id),
    `Responsable: ${responsable ? responsable.nombre : "—"}`,
    `Fase: ${textoEstadoProyecto(proyecto.estado)}`,
  ].join(" · ");
  const fechas = document.createElement("span");
  sub.append(fechas);
  textos.append(codigo, nombre, sub);
  elemento.append(textos, acciones);

  function ponerFechas(actividades) {
    const dias = (campo) =>
      actividades
        .map((a) => a[campo])
        .filter(Boolean)
        .map((f) => String(f).slice(0, 10))
        .sort();
    const inicios = dias("fecha_inicio");
    const fines = dias("fecha_fin");
    const partes = [];
    if (inicios.length) partes.push(`Inicio ${fechaCortaTexto(inicios[0])}`);
    if (fines.length) partes.push(`Fin previsto ${fechaCortaTexto(fines[fines.length - 1])}`);
    fechas.textContent = partes.length ? ` · ${partes.join(" · ")}` : "";
  }
  return { elemento, ponerFechas };
}

async function vistaProyectoForm(id, opciones = {}) {
  const modoVersion = Boolean(id && opciones.modoVersion);
  marcarMenu("proyectos");
  mostrarCargando();

  const [clientes, usuarios, cotizaciones] = await Promise.all([
    obtenerClientes(),
    obtenerUsuarios(),
    obtenerCotizaciones(),
  ]);
  let proyecto = null;
  if (id) {
    const r = await api("GET", `/proyectos/${id}`);
    if (r.status !== 200) {
      contenido.replaceChildren(encabezado("Proyecto"), alerta("error", "No se encontró el proyecto."));
      return;
    }
    proyecto = r.cuerpo.proyecto;
  } else if (clientes.length === 0) {
    contenido.replaceChildren(
      encabezado("Nuevo proyecto"),
      alerta("error", "Primero crea al menos un cliente.")
    );
    return;
  }

  const opcionesClientes = clientes.map((c) => ({ valor: String(c.id), texto: c.nombre_razon_social }));
  const opcionesUsuarios = usuarios.map((u) => ({ valor: String(u.id), texto: u.nombre }));
  const cotizacionesAceptadas = cotizaciones.filter((c) => c.estado === "aceptada");
  const opcionesCotizacion = [
    { valor: "", texto: "Ninguna" },
    ...(id
      ? cotizacionesAceptadas.filter((c) => c.cliente_id === proyecto.cliente_id)
      : cotizacionesAceptadas
    ).map((c) => ({
      valor: String(c.id),
      texto: id ? c.numero_cotizacion : `${c.numero_cotizacion} — ${nombreClienteDe(clientes, c.cliente_id)}`,
    })),
  ];

  contenido.replaceChildren();
  const volver = modoVersion
    ? boton("Cancelar nueva versión", () => (window.location.hash = `#/proyectos/${id}`), true)
    : boton("Volver a proyectos", () => (window.location.hash = "#/proyectos"), true);
  const tituloProyecto = id
    ? `${modoVersion ? "Nueva versión del proyecto" : "Proyecto"} ${proyecto.codigo_pry}${proyecto.version > 1 ? ` · v${proyecto.version}` : ""}`
    : "Nuevo proyecto";
  // La ficha de un proyecto existente (maqueta PropuestaRediseno.html):
  // cabecera con código, nombre y fechas; "Siguiente paso"; y cinco
  // pestañas: Actividades (abre primero), Resumen por etapa, Línea de
  // tiempo, Documentos y Datos y versiones.
  const conFicha = Boolean(id) && !modoVersion;
  const acciones = document.createElement("div");
  acciones.className = "encabezado-acciones";
  if (conFicha) acciones.append(botonEvidenciasProyecto(id));
  acciones.append(volver);
  const cabecera = conFicha ? cabeceraFichaProyecto(proyecto, clientes, usuarios, acciones) : null;
  contenido.append(cabecera ? cabecera.elemento : encabezado(tituloProyecto, [acciones]));
  // Se recargan cada vez que se abre la pestaña: siempre al día.
  const pestanaQueCarga = (vista) => async (panel) => {
    const cargando = document.createElement("p");
    cargando.className = "subtitulo";
    cargando.textContent = "Cargando…";
    panel.replaceChildren(cargando);
    panel.replaceChildren(await vista(id));
  };
  const definicionesPestanas = [
    { clave: "actividades", texto: "Actividades" },
    { clave: "etapas", texto: "Resumen por etapa", alActivar: pestanaQueCarga(window.vistaResumenEtapas) },
    { clave: "linea", texto: "Línea de tiempo", alActivar: pestanaQueCarga(window.vistaLineaTiempo) },
    {
      clave: "documentos",
      texto: "Documentos",
      alActivar: pestanaQueCarga((pid) => renderSeccionDocumentosProyecto(pid, { conCrear: true })),
    },
    { clave: "datos", texto: "Datos y versiones" },
  ];
  const pestanas = conFicha ? pestanasVista(definicionesPestanas) : null;
  // "Siguiente paso" va arriba de las pestañas: qué sigue, quién y qué implica.
  const lugarSiguientePaso = document.createElement("div");
  if (pestanas) contenido.append(lugarSiguientePaso, pestanas.lista, ...Object.values(pestanas.paneles));

  const tarjeta = document.createElement("div");
  tarjeta.className = "tarjeta-ancha";
  const mensaje = document.createElement("div");
  const form = document.createElement("form");
  form.noValidate = true;
  const grid = document.createElement("div");
  grid.className = "formulario-grid";

  const camposProyecto = id
    ? [
        { nombre: "cliente", etiqueta: "Cliente", tipo: "estatico" },
        { nombre: "codigo_pry", etiqueta: "Código del proyecto", requerido: true },
        {
          nombre: "responsable_id",
          etiqueta: "Responsable",
          tipo: "select",
          requerido: true,
          opciones: opcionesUsuarios,
        },
        { nombre: "nombre_proyecto", etiqueta: "Nombre del proyecto", requerido: true },
        { nombre: "linea_negocio", etiqueta: "Línea de negocio" },
        { nombre: "presupuesto_estimado", etiqueta: "Presupuesto estimado", tipo: "number" },
        { nombre: "cotizacion_id", etiqueta: "Cotización de origen", tipo: "select", opciones: opcionesCotizacion },
      ]
    : [
        {
          nombre: "cliente_id",
          etiqueta: "Cliente",
          tipo: "select",
          requerido: true,
          opciones: opcionesClientes,
        },
        {
          nombre: "responsable_id",
          etiqueta: "Responsable",
          tipo: "select",
          requerido: true,
          opciones: opcionesUsuarios,
        },
        { nombre: "nombre_proyecto", etiqueta: "Nombre del proyecto", requerido: true },
        { nombre: "linea_negocio", etiqueta: "Línea de negocio" },
        { nombre: "presupuesto_estimado", etiqueta: "Presupuesto estimado", tipo: "number" },
        { nombre: "cotizacion_id", etiqueta: "Cotización de origen", tipo: "select", opciones: opcionesCotizacion },
      ];

  camposProyecto.forEach((config) => {
    let valor = "";
    if (proyecto) {
      if (config.nombre === "cliente") valor = nombreClienteDe(clientes, proyecto.cliente_id);
      else if (config.nombre === "responsable_id") valor = String(proyecto.responsable_id);
      else if (config.nombre === "cotizacion_id") valor = proyecto.cotizacion_id ? String(proyecto.cotizacion_id) : "";
      else valor = proyecto[config.nombre];
    }
    grid.append(construirCampo(config, valor));
  });

  const guardar = document.createElement("button");
  guardar.type = "submit";
  guardar.className = "boton boton-pequeno";
  guardar.textContent = modoVersion
    ? `Guardar como versión ${(proyecto.version || 1) + 1}`
    : id
      ? "Guardar cambios"
      : "Crear proyecto";

  if (modoVersion) form.append(bloqueModoVersion(proyecto.version || 1));
  form.append(grid, guardar);
  if (!id) form.append(botonCancelar("#/proyectos"));
  tarjeta.append(mensaje, form);
  (pestanas ? pestanas.paneles.datos : contenido).append(tarjeta);

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    mensaje.replaceChildren();
    const datos = {};
    camposProyecto
      .filter((c) => c.tipo !== "estatico")
      .forEach((config) => {
        const valor = form.elements[config.nombre].value.trim();
        if (valor !== "") datos[config.nombre] = valor;
      });
    const faltantes = camposProyecto.filter(
      (c) => c.tipo !== "estatico" && c.requerido && !datos[c.nombre]
    );
    if (faltantes.length > 0) {
      mensaje.append(alerta("error", "Completa los campos obligatorios marcados con *."));
      return;
    }
    if (!id && !confirmarCreacion("este proyecto")) return;

    guardar.disabled = true;
    try {
      const r = await guardarDocumento("proyectos", { id, modoVersion, datos, form, mensaje });
      if (!r) return;
      if (r.status === 200 || r.status === 201) {
        if (modoVersion) {
          window.location.hash = `#/proyectos/${id}`;
          return;
        }
        window.location.hash = id ? `#/proyectos/${id}` : "#/proyectos";
        // se vuelve a la pestaña de los datos que se acaban de guardar
        if (id) vistaProyectoForm(id, { pestana: "datos" });
        return;
      }
      if (r.status === 400 && Array.isArray(r.cuerpo?.detalles)) {
        const mensajes = mostrarErroresValidacion(form, camposProyecto, r.cuerpo.detalles);
        mensaje.append(alerta("error", mensajes.join(" · ")));
      } else {
        mensaje.append(alerta("error", r.cuerpo?.error || "No se pudo guardar el proyecto."));
      }
    } catch (error) {
      if (error.message !== "sesion-expirada") {
        mensaje.append(alerta("error", "No hay conexión con el servidor."));
      }
    } finally {
      guardar.disabled = false;
    }
  });

  if (modoVersion) return;
  if (id) {
    // Datos y versiones: formulario, presupuesto y panel de versiones
    tarjeta.append(renderSeccionPresupuestoProyecto(proyecto));
    tarjeta.append(await renderPanelVersiones("proyectos", id));

    // Actividades: la fase del proyecto y el Gantt de cada fase
    const bloqueFase = document.createElement("div");
    bloqueFase.className = "tarjeta-ancha ficha-fase";

    const subtitulo = document.createElement("h3");
    subtitulo.textContent = "Fase del proyecto";
    bloqueFase.append(subtitulo, construirStageTrack(proyecto.estado));

    const mensajeFase = document.createElement("div");
    const filaFase = document.createElement("div");
    filaFase.className = "formulario-grid";
    filaFase.append(
      construirCampo(
        {
          nombre: "nueva_fase",
          etiqueta: "Cambiar a la fase",
          tipo: "select",
          opciones: opcionesSegunPermiso(ESTADOS_PROYECTO, proyecto.estado, (destino) =>
            destino !== "cancelado" || puede("cancelar_proyecto")
          ),
        },
        proyecto.estado
      ),
      construirCampo({ nombre: "observacion_fase", etiqueta: "Observación (opcional)" }, "")
    );
    const botonFase = boton("Actualizar fase", async () => {
      mensajeFase.replaceChildren();
      const nuevaFase = document.getElementById("nueva_fase").value;
      const observacion = document.getElementById("observacion_fase").value.trim();
      const r = await api("PATCH", `/proyectos/${id}/estado`, {
        estado: nuevaFase,
        observacion: observacion || undefined,
      });
      if (r.status === 200) {
        vistaProyectoForm(id);
        return;
      }
      mensajeFase.append(alerta("error", r.cuerpo?.error || "No se pudo cambiar la fase."));
    });

    bloqueFase.append(filaFase, botonFase, mensajeFase);
    pestanas.paneles.actividades.append(
      bloqueFase,
      await renderSeccionActividadesProyecto(id, opcionesUsuarios, {
        actividadId: opciones.actividadId,
        alCargar: cabecera.ponerFechas,
      })
    );
    if (opciones.pestana) {
      const indice = definicionesPestanas.findIndex((p) => p.clave === opciones.pestana);
      if (indice >= 0) pestanas.activar(indice);
    }
    lugarSiguientePaso.replaceChildren(await window.panelSiguientePaso(proyecto, opcionesUsuarios));
    const refrescarPaso = async (evento) => {
      if (!lugarSiguientePaso.isConnected) {
        document.removeEventListener("actividades-cambiaron", refrescarPaso);
        return;
      }
      if (String(evento.detail.proyectoId) !== String(id)) return;
      lugarSiguientePaso.replaceChildren(await window.panelSiguientePaso(proyecto, opcionesUsuarios));
    };
    document.addEventListener("actividades-cambiaron", refrescarPaso);
    if (opciones.actividadId) enfocarActividad(opciones.actividadId);
  }
}

function nombreClienteDe(clientes, id) {
  return clientes.find((c) => c.id === id)?.nombre_razon_social || "—";
}
