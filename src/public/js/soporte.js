/* global
   alerta, api, bloqueModoVersion, boton, botonCancelar, celda, confirmarCreacion,
   construirCampo, contenido, encabezado, enlazarClienteConProyectos, estadoPill,
   fechaCortaTexto, guardarDocumento, marcarMenu, montarListado, mostrarCargando,
   mostrarErroresValidacion, obtenerClientes, obtenerProyectos, opcionesProyectosDeCliente,
   recargarSelect, renderPanelVersiones, renderSeccionEvidencias, renderSeccionSubrecurso */
/* exported vistaEquipoForm, vistaEquipos, vistaReporteServicioForm, vistaReportesServicio */
// Soporte técnico: reportes de servicio (con parámetros medidos) y equipos instalados.

// Parámetros de funcionamiento impresos en el formato FO-ST-005 (reporte de
// servicio técnico): se ofrecen para cargarlos de una vez en un reporte nuevo.
const PARAMETROS_FORMATO_FO_ST_005 = [
  { parametro: "Presión manométrica", unidad: "PSI" },
  { parametro: "Flujo de oxígeno", unidad: "LPM" },
  { parametro: "Concentración de oxígeno", unidad: "%" },
  { parametro: "Voltaje", unidad: "V" },
  { parametro: "Consumo de corriente", unidad: "A" },
  { parametro: "Horómetro", unidad: "Hrs" },
  { parametro: "Concentración de oxígeno disuelto", unidad: "%" },
];

// Sección "Parámetros de funcionamiento" del reporte: lo que se midió frente
// a lo esperado. Usa la misma tabla editable que las secciones del expediente.
function renderSeccionParametrosReporte(reporteId) {
  const rutaBase = `/reportes-servicio-tecnico/${reporteId}`;
  return renderSeccionSubrecurso(
    reporteId,
    {
      titulo: "Parámetros de funcionamiento",
      ayuda: "Lo que se midió en el servicio frente al valor esperado (formato FO-ST-005).",
      ruta: "parametros-medidos",
      rutaBase,
      clave: "parametros",
      nombreSingular: "parámetro",
      campos: [
        { nombre: "parametro", etiqueta: "Parámetro", requerido: true },
        { nombre: "unidad", etiqueta: "Unidad" },
        { nombre: "valor_medido", etiqueta: "Valor medido" },
        { nombre: "valor_esperado", etiqueta: "Valor esperado" },
      ],
      accionVacia: (recargar) => {
        const caja = document.createElement("div");
        caja.className = "accion-vacia";
        const aviso = document.createElement("div");
        const cargarFormato = boton("Cargar parámetros del formato (FO-ST-005)", async () => {
          cargarFormato.disabled = true;
          aviso.replaceChildren();
          try {
            for (const p of PARAMETROS_FORMATO_FO_ST_005) {
              const r = await api("POST", `${rutaBase}/parametros-medidos`, p);
              if (r.status !== 201) throw new Error(r.cuerpo?.error || "No se pudieron cargar.");
            }
          } catch (error) {
            if (error.message !== "sesion-expirada") aviso.append(alerta("error", error.message));
          } finally {
            cargarFormato.disabled = false;
            recargar();
          }
        }, true);
        caja.append(cargarFormato, aviso);
        return caja;
      },
    },
    true
  );
}

const TIPOS_SERVICIO = [
  { valor: "instalacion", texto: "Instalación" },
  { valor: "inspeccion", texto: "Inspección" },
  { valor: "asistencia", texto: "Asistencia" },
  { valor: "mantenimiento_preventivo", texto: "Mantenimiento preventivo" },
  { valor: "mantenimiento_correctivo", texto: "Mantenimiento correctivo" },
  { valor: "garantia", texto: "Garantía" },
  { valor: "validacion", texto: "Validación" },
];

function textoTipoServicio(valor) {
  const encontrado = TIPOS_SERVICIO.find((t) => t.valor === valor);
  return encontrado ? encontrado.texto : valor;
}

function tipoPillTipoServicio(valor) {
  if (valor === "mantenimiento_correctivo" || valor === "garantia") return "warn";
  if (valor === "instalacion" || valor === "mantenimiento_preventivo") return "good";
  return "info";
}

// El equipo va primero: al escribir su serial se completan solos el cliente y
// el proyecto (el del equipo, que puede cambiarse por otro del mismo cliente,
// p. ej. un contrato de mantenimiento). Todo reporte queda en un proyecto.
const CAMPOS_REPORTE = (clientes, proyectos) => [
  { nombre: "equipo_numero_serie", etiqueta: "Número de serie del equipo", requerido: true },
  { nombre: "cliente_id", etiqueta: "Cliente", tipo: "select", requerido: true,
    opciones: clientes.map((c) => ({ valor: String(c.id), texto: c.nombre_razon_social })) },
  { nombre: "proyecto_id", etiqueta: "Proyecto", tipo: "select", requerido: true,
    opciones: opcionesProyectosDeCliente(proyectos, null) },
  { nombre: "tipo_servicio", etiqueta: "Tipo de servicio", tipo: "select", requerido: true, opciones: TIPOS_SERVICIO },
  { nombre: "en_garantia", etiqueta: "¿En garantía?", tipo: "select",
    opciones: [{ valor: "no", texto: "No" }, { valor: "si", texto: "Sí" }] },
  { nombre: "fecha_servicio", etiqueta: "Fecha de servicio", tipo: "date" },
  { nombre: "hora_inicio", etiqueta: "Hora de inicio", tipo: "time" },
  { nombre: "hora_fin", etiqueta: "Hora de fin", tipo: "time" },
  { nombre: "motivo", etiqueta: "Motivo" },
  { nombre: "hallazgos", etiqueta: "Hallazgos" },
  { nombre: "recomendaciones", etiqueta: "Recomendaciones" },
];

async function vistaReportesServicio() {
  marcarMenu("reportes-servicio");
  const nuevo = boton("Nuevo reporte", () => (window.location.hash = "#/reportes-servicio/nuevo"));
  contenido.replaceChildren(encabezado("Reportes de servicio técnico", [nuevo]));
  await montarListado({
    clave: "reportes-servicio",
    api: "/reportes-servicio-tecnico",
    campo: "reportes",
    titulo: "reportes de servicio",
    buscar: "Buscar por número, serial, cliente o proyecto",
    vacio: "Aún no hay reportes de servicio registrados.",
    pintar: tablaReportesServicio,
  });
}

function tablaReportesServicio(reportes) {
  const tarjeta = document.createElement("div");
  tarjeta.className = "tarjeta-ancha";
  const tabla = document.createElement("table");
  const thead = document.createElement("thead");
  const filaCabecera = document.createElement("tr");
  ["Número", "Equipo (N° serie)", "Cliente", "Proyecto", "Tipo de servicio", "Fecha", ""].forEach((texto) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = texto;
    filaCabecera.append(th);
  });
  thead.append(filaCabecera);

  const tbody = document.createElement("tbody");
  reportes.forEach((r) => {
    const fila = document.createElement("tr");
    fila.append(celda(r.numero_reporte));
    fila.append(celda(r.equipo_numero_serie));
    fila.append(celda(r.cliente_nombre || "—"));
    fila.append(celda(r.proyecto_codigo || "—"));
    fila.append(celda(estadoPill(textoTipoServicio(r.tipo_servicio), tipoPillTipoServicio(r.tipo_servicio))));
    fila.append(celda(r.fecha_servicio ? r.fecha_servicio.substring(0, 10) : "—"));
    const accion = document.createElement("td");
    const editar = boton("Editar", () => (window.location.hash = `#/reportes-servicio/${r.id}`), true);
    editar.setAttribute("aria-label", `Editar reporte de ${r.equipo_numero_serie}`);
    accion.append(editar);
    fila.append(accion);
    tbody.append(fila);
  });

  tabla.append(thead, tbody);
  tarjeta.append(tabla);
  return tarjeta;
}

// opciones.modoVersion: corrige el reporte como nueva versión (no se elimina).
async function vistaReporteServicioForm(id, opciones = {}) {
  const modoVersion = Boolean(id && opciones.modoVersion);
  marcarMenu("reportes-servicio");
  mostrarCargando();

  const [clientes, proyectos] = await Promise.all([obtenerClientes(), obtenerProyectos()]);
  let reporte = null;
  if (id) {
    const r = await api("GET", `/reportes-servicio-tecnico/${id}`);
    if (r.status !== 200) {
      contenido.replaceChildren(encabezado("Reporte de servicio"), alerta("error", "No se encontró el reporte."));
      return;
    }
    reporte = r.cuerpo.reporte;
  } else if (clientes.length === 0) {
    contenido.replaceChildren(
      encabezado("Nuevo reporte"),
      alerta("error", "Primero crea al menos un cliente.")
    );
    return;
  }

  const campos = CAMPOS_REPORTE(clientes, proyectos);

  contenido.replaceChildren();
  const volver = modoVersion
    ? boton("Cancelar nueva versión", () => (window.location.hash = `#/reportes-servicio/${id}`), true)
    : boton("Volver a reportes", () => (window.location.hash = "#/reportes-servicio"), true);
  const tituloReporte = !id
    ? "Nuevo reporte de servicio"
    : `${modoVersion ? "Nueva versión del reporte" : "Reporte de servicio"} ${reporte.numero_reporte}${reporte.version > 1 ? ` · v${reporte.version}` : ""}`;
  contenido.append(encabezado(tituloReporte, [volver]));

  const tarjeta = document.createElement("div");
  tarjeta.className = "tarjeta-ancha";
  const mensaje = document.createElement("div");
  const form = document.createElement("form");
  form.noValidate = true;
  const grid = document.createElement("div");
  grid.className = "formulario-grid";

  campos.forEach((config) => {
    let valor = "";
    if (reporte) {
      if (config.nombre === "en_garantia") valor = reporte.en_garantia ? "si" : "no";
      else if (config.nombre === "proyecto_id") valor = reporte.proyecto_id ? String(reporte.proyecto_id) : "";
      else if (config.nombre === "fecha_servicio") valor = reporte.fecha_servicio ? reporte.fecha_servicio.substring(0, 10) : "";
      else valor = reporte[config.nombre] || "";
    }
    grid.append(construirCampo(config, valor));
  });

  const guardar = document.createElement("button");
  guardar.type = "submit";
  guardar.className = "boton boton-pequeno";
  guardar.textContent = modoVersion
    ? `Guardar como versión ${(reporte.version || 1) + 1}`
    : id
      ? "Guardar cambios"
      : "Crear reporte";

  const infoEquipo = document.createElement("p");
  infoEquipo.className = "subtitulo info-equipo";
  if (modoVersion) form.append(bloqueModoVersion(reporte.version || 1));
  form.append(grid, infoEquipo, guardar);
  if (!id) form.append(botonCancelar("#/reportes-servicio"));
  tarjeta.append(mensaje, form);
  contenido.append(tarjeta);

  enlazarClienteConProyectos(form, proyectos);
  const inputSerie = form.elements.equipo_numero_serie;
  // Busca el equipo por su serial y completa cliente y proyecto.
  async function completarDesdeEquipo({ conservarProyecto = false } = {}) {
    const serie = inputSerie.value.trim();
    infoEquipo.replaceChildren();
    if (!serie) return;
    const r = await api("GET", `/equipos?numero_serie=${encodeURIComponent(serie)}`);
    const equipo = r.status === 200 ? r.cuerpo.equipos[0] : null;
    if (!equipo) {
      infoEquipo.append(
        "No hay un equipo registrado con ese número de serie. Si es anterior al ERP, ",
        Object.assign(document.createElement("a"), {
          href: "#/equipos/nuevo",
          textContent: "regístralo en Equipos",
          className: "enlace-documento",
        }),
        "."
      );
      return;
    }
    const selectCliente = form.elements.cliente_id;
    const selectProyecto = form.elements.proyecto_id;
    const proyectoActual = selectProyecto.value;
    selectCliente.value = String(equipo.cliente_id);
    const opciones = opcionesProyectosDeCliente(proyectos, equipo.cliente_id);
    // si el proyecto del equipo no vino en la lista (más de 100), se agrega
    if (!opciones.some((o) => o.valor === String(equipo.proyecto_id))) {
      opciones.push({
        valor: String(equipo.proyecto_id),
        texto: `${equipo.proyecto_codigo} · ${equipo.proyecto_nombre}`,
      });
    }
    const mismoCliente = opciones.some((o) => o.valor && o.valor === proyectoActual);
    recargarSelect(
      selectProyecto,
      opciones,
      conservarProyecto && mismoCliente ? proyectoActual : String(equipo.proyecto_id)
    );
    infoEquipo.textContent =
      `${equipo.descripcion} · ${equipo.cliente} · equipo del proyecto ${equipo.proyecto_codigo}` +
      (equipo.origen === "historico" ? " (equipo histórico)" : "") +
      ". Puedes elegir otro proyecto del mismo cliente, p. ej. un contrato de mantenimiento.";
  }
  inputSerie.addEventListener("change", () => completarDesdeEquipo());
  const seriePrevia = sessionStorage.getItem("reporte_equipo_serie");
  if (!id && seriePrevia) {
    sessionStorage.removeItem("reporte_equipo_serie");
    inputSerie.value = seriePrevia;
    completarDesdeEquipo();
  } else if (id) {
    completarDesdeEquipo({ conservarProyecto: true });
  }

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    mensaje.replaceChildren();
    const datos = {};
    campos.forEach((config) => {
      const valor = form.elements[config.nombre].value.trim();
      if (valor === "") return;
      if (config.nombre === "en_garantia") datos.en_garantia = valor === "si";
      else datos[config.nombre] = valor;
    });
    const faltantes = campos.filter((c) => c.requerido && !datos[c.nombre]);
    if (faltantes.length > 0) {
      mensaje.append(alerta("error", "Completa los campos obligatorios marcados con *."));
      return;
    }
    if (!id && !confirmarCreacion("este reporte de servicio")) return;

    guardar.disabled = true;
    try {
      const r = await guardarDocumento("reportes-servicio", { id, modoVersion, datos, form, mensaje });
      if (!r) return;
      if (r.status === 200 || r.status === 201) {
        window.location.hash = modoVersion ? `#/reportes-servicio/${id}` : "#/reportes-servicio";
        return;
      }
      if (r.status === 400 && Array.isArray(r.cuerpo?.detalles)) {
        const mensajes = mostrarErroresValidacion(form, campos, r.cuerpo.detalles);
        mensaje.append(alerta("error", mensajes.join(" · ")));
      } else {
        mensaje.append(alerta("error", r.cuerpo?.error || "No se pudo guardar el reporte."));
      }
    } catch (error) {
      if (error.message !== "sesion-expirada") {
        mensaje.append(alerta("error", "No hay conexión con el servidor."));
      }
    } finally {
      guardar.disabled = false;
    }
  });

  if (id && !modoVersion) {
    tarjeta.append(await renderSeccionParametrosReporte(id));
    tarjeta.append(renderSeccionEvidencias("reportes_servicio_tecnico", id, "Evidencias del servicio"));
    tarjeta.append(await renderPanelVersiones("reportes-servicio", id));
  }
}

/* ------------------------------------------------------------------
   Equipos instalados (Soporte técnico): trazabilidad de cada equipo,
   tenga o no expediente de diseño.
   ------------------------------------------------------------------ */
function pillOrigenEquipo(equipo) {
  return equipo.origen === "historico"
    ? estadoPill("Histórico", "mute")
    : estadoPill(`Expediente ${equipo.codigo_expediente || ""}`.trim(), "info");
}

async function vistaEquipos() {
  marcarMenu("equipos");
  const nuevo = boton("Registrar equipo histórico", () => (window.location.hash = "#/equipos/nuevo"));
  const nota = document.createElement("p");
  nota.className = "subtitulo";
  nota.textContent =
    "Los equipos con expediente de diseño se registran solos. Aquí se agregan los equipos anteriores al ERP, para poder hacerles reportes de servicio y seguir su historia.";
  contenido.replaceChildren(encabezado("Equipos instalados", [nuevo]), nota);
  await montarListado({
    clave: "equipos",
    api: "/equipos",
    campo: "equipos",
    titulo: "equipos",
    buscar: "Buscar por serial, equipo, marca, cliente o proyecto",
    vacio: "Aún no hay equipos registrados.",
    pintar: tablaEquipos,
  });
}

function tablaEquipos(equipos) {
  const tarjeta = document.createElement("div");
  tarjeta.className = "tarjeta-ancha";
  const tabla = document.createElement("table");
  const thead = document.createElement("thead");
  const filaCabecera = document.createElement("tr");
  ["Número de serie", "Equipo", "Cliente", "Proyecto", "Origen", "Reportes", "Último servicio", ""].forEach(
    (texto) => {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = texto;
      filaCabecera.append(th);
    }
  );
  thead.append(filaCabecera);
  const tbody = document.createElement("tbody");
  equipos.forEach((q) => {
    const fila = document.createElement("tr");
    [
      q.numero_serie,
      q.descripcion,
      q.cliente,
      q.proyecto_codigo,
      pillOrigenEquipo(q),
      String(q.reportes),
      q.ultimo_servicio ? fechaCortaTexto(q.ultimo_servicio) : "—",
    ].forEach((valor) => fila.append(celda(valor)));
    const accion = document.createElement("td");
    const ver = boton("Ver", () => (window.location.hash = `#/equipos/${q.id}`), true);
    ver.setAttribute("aria-label", `Ver equipo ${q.numero_serie}`);
    accion.append(ver);
    fila.append(accion);
    tbody.append(fila);
  });
  tabla.append(thead, tbody);
  tarjeta.append(tabla);
  return tarjeta;
}

function renderHistorialServicioEquipo(equipo) {
  const bloque = document.createElement("div");
  bloque.className = "docs-proyecto";
  const cabecera = document.createElement("div");
  cabecera.className = "docs-cabecera";
  const titulo = document.createElement("h3");
  titulo.textContent = "Historial de servicio";
  const nuevo = boton("Nuevo reporte para este equipo", () => {
    sessionStorage.setItem("reporte_equipo_serie", equipo.numero_serie);
    window.location.hash = "#/reportes-servicio/nuevo";
  });
  cabecera.append(titulo, nuevo);
  bloque.append(cabecera);

  if (equipo.historial_reportes.length === 0) {
    const p = document.createElement("p");
    p.className = "subtitulo";
    p.textContent = "Este equipo aún no tiene reportes de servicio.";
    bloque.append(p);
    return bloque;
  }
  const tabla = document.createElement("table");
  const thead = document.createElement("thead");
  const filaCabecera = document.createElement("tr");
  ["Reporte", "Tipo", "Fecha", "Proyecto", "Técnico", "Garantía"].forEach((texto) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = texto;
    filaCabecera.append(th);
  });
  thead.append(filaCabecera);
  const tbody = document.createElement("tbody");
  equipo.historial_reportes.forEach((r) => {
    const fila = document.createElement("tr");
    const tdReporte = document.createElement("td");
    tdReporte.append(
      Object.assign(document.createElement("a"), {
        href: `#/reportes-servicio/${r.id}`,
        textContent: r.numero_reporte,
        className: "enlace-documento",
      })
    );
    fila.append(
      tdReporte,
      celda(estadoPill(textoTipoServicio(r.tipo_servicio), tipoPillTipoServicio(r.tipo_servicio))),
      celda(fechaCortaTexto(r.fecha_servicio || r.creado)),
      celda(r.proyecto_codigo),
      celda(r.tecnico || "—"),
      celda(r.en_garantia ? "Sí" : "No")
    );
    tbody.append(fila);
  });
  tabla.append(thead, tbody);
  bloque.append(tabla);
  return bloque;
}

async function vistaEquipoForm(id) {
  marcarMenu("equipos");
  mostrarCargando();
  const [clientes, proyectos] = await Promise.all([obtenerClientes(), obtenerProyectos()]);
  let equipo = null;
  if (id) {
    const r = await api("GET", `/equipos/${id}`);
    if (r.status !== 200) {
      contenido.replaceChildren(encabezado("Equipo"), alerta("error", "No se encontró el equipo."));
      return;
    }
    equipo = r.cuerpo.equipo;
  }

  contenido.replaceChildren();
  const volver = boton("Volver a equipos", () => (window.location.hash = "#/equipos"), true);
  contenido.append(
    encabezado(equipo ? `Equipo ${equipo.numero_serie}` : "Registrar equipo histórico", [volver])
  );
  const tarjeta = document.createElement("div");
  tarjeta.className = "tarjeta-ancha";
  contenido.append(tarjeta);

  // Los equipos de expediente se ven aquí, pero se corrigen desde su expediente.
  if (equipo && equipo.origen === "expediente") {
    const ficha = document.createElement("div");
    ficha.className = "formulario-grid";
    [
      { nombre: "e_serie", etiqueta: "Número de serie", valor: equipo.numero_serie },
      { nombre: "e_desc", etiqueta: "Equipo", valor: equipo.descripcion },
      { nombre: "e_modelo", etiqueta: "Modelo", valor: equipo.modelo },
      { nombre: "e_cliente", etiqueta: "Cliente", valor: equipo.cliente },
      { nombre: "e_proyecto", etiqueta: "Proyecto", valor: `${equipo.proyecto_codigo} · ${equipo.proyecto_nombre}` },
    ].forEach((c) => ficha.append(construirCampo({ ...c, tipo: "estatico" }, c.valor)));
    const nota = document.createElement("p");
    nota.className = "subtitulo";
    nota.append(
      "Este equipo sale del expediente ",
      Object.assign(document.createElement("a"), {
        href: `#/expedientes-diseno/${equipo.expediente_id}`,
        textContent: equipo.codigo_expediente,
        className: "enlace-documento",
      }),
      ": sus datos se corrigen desde allí."
    );
    tarjeta.append(ficha, nota, renderHistorialServicioEquipo(equipo));
    return;
  }

  const campos = [
    { nombre: "numero_serie", etiqueta: "Número de serie", requerido: true },
    { nombre: "descripcion", etiqueta: "Equipo (descripción)", requerido: true },
    {
      nombre: "cliente_id",
      etiqueta: "Cliente",
      tipo: "select",
      requerido: true,
      opciones: [
        { valor: "", texto: "— Elige el cliente —" },
        ...clientes.map((c) => ({ valor: String(c.id), texto: c.nombre_razon_social })),
      ],
    },
    {
      nombre: "proyecto_id",
      etiqueta: "Proyecto",
      tipo: "select",
      requerido: true,
      opciones: opcionesProyectosDeCliente(proyectos, null),
    },
    { nombre: "marca", etiqueta: "Marca" },
    { nombre: "modelo", etiqueta: "Modelo" },
    { nombre: "fecha_instalacion", etiqueta: "Fecha de instalación", tipo: "date" },
  ];

  const mensaje = document.createElement("div");
  const form = document.createElement("form");
  form.noValidate = true;
  const grid = document.createElement("div");
  grid.className = "formulario-grid";
  campos.forEach((config) => {
    let valor = "";
    if (equipo) {
      valor = equipo[config.nombre] === null || equipo[config.nombre] === undefined ? "" : String(equipo[config.nombre]);
    }
    grid.append(construirCampo(config, valor));
  });
  const ayuda = document.createElement("p");
  ayuda.className = "subtitulo";
  ayuda.textContent =
    "El proyecto es aquel en el que se vendió o instaló el equipo. Si es anterior al ERP, usa el proyecto con el que se le da soporte a ese cliente.";
  const guardar = document.createElement("button");
  guardar.type = "submit";
  guardar.className = "boton boton-pequeno";
  guardar.textContent = equipo ? "Guardar cambios" : "Registrar equipo";
  form.append(grid, ayuda, guardar);
  if (!equipo) form.append(botonCancelar("#/equipos"));
  tarjeta.append(mensaje, form);
  enlazarClienteConProyectos(form, proyectos);
  if (equipo) tarjeta.append(renderHistorialServicioEquipo(equipo));

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    mensaje.replaceChildren();
    const datos = {};
    campos.forEach((config) => {
      const valor = form.elements[config.nombre].value.trim();
      if (valor !== "") datos[config.nombre] = valor;
    });
    if (campos.some((c) => c.requerido && !datos[c.nombre])) {
      mensaje.append(alerta("error", "Completa los campos obligatorios marcados con *."));
      return;
    }
    if (!equipo && !confirmarCreacion("este equipo")) return;
    guardar.disabled = true;
    try {
      const r = equipo
        ? await api("PUT", `/equipos/${equipo.id}`, datos)
        : await api("POST", "/equipos", datos);
      if (r.status === 200 || r.status === 201) {
        window.location.hash = `#/equipos/${r.cuerpo.equipo.id}`;
        if (equipo) vistaEquipoForm(equipo.id);
        return;
      }
      if (r.status === 400 && Array.isArray(r.cuerpo?.detalles)) {
        mensaje.append(alerta("error", mostrarErroresValidacion(form, campos, r.cuerpo.detalles).join(" · ")));
      } else {
        mensaje.append(alerta("error", r.cuerpo?.error || "No se pudo guardar el equipo."));
      }
    } catch (error) {
      if (error.message !== "sesion-expirada") {
        mensaje.append(alerta("error", "No hay conexión con el servidor."));
      }
    } finally {
      guardar.disabled = false;
    }
  });
}
