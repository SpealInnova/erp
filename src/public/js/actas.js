/* global
   PAGINA_SELECTORES, alerta, api, bloqueModoVersion, boton, botonCancelar, celda,
   confirmarCreacion, construirCampo, contenido, encabezado, estadoPill, guardarDocumento,
   marcarMenu, montarListado, mostrarCargando, mostrarErroresValidacion, obtenerClientes,
   obtenerProyectos, renderPanelVersiones, renderSeccionEvidencias */
/* exported vistaActaCierreForm, vistaActaEntregaForm, vistaActasCierre, vistaActasEntrega */
// Actas de cierre a satisfacción y actas de entrega de equipos.

const OPCIONES_TIPO_ENTREGA = [
  { valor: "venta", texto: "Venta" },
  { valor: "demostracion", texto: "Demostración" },
  { valor: "piloto", texto: "Piloto" },
];

const OPCIONES_DOCUMENTO_REFERENCIA = [
  { valor: "orden_compra", texto: "Orden de compra" },
  { valor: "contrato", texto: "Contrato" },
  { valor: "consorcio", texto: "Consorcio" },
  { valor: "union_temporal", texto: "Unión temporal" },
  { valor: "otro", texto: "Otro" },
];

function textoTipoEntrega(valor) {
  const encontrado = OPCIONES_TIPO_ENTREGA.find((o) => o.valor === valor);
  return encontrado ? encontrado.texto : valor;
}

function tipoPillTipoEntrega(valor) {
  if (valor === "venta") return "good";
  if (valor === "piloto") return "warn";
  return "info";
}

async function vistaActasCierre() {
  marcarMenu("actas-cierre");
  const nuevo = boton("Nueva acta", () => (window.location.hash = "#/actas-cierre/nuevo"));
  contenido.replaceChildren(encabezado("Actas de cierre a satisfacción", [nuevo]));
  await montarListado({
    clave: "actas-cierre",
    api: "/actas-cierre-satisfaccion",
    campo: "actas",
    titulo: "actas de cierre",
    buscar: "Buscar por número, proyecto o cliente",
    vacio: "Aún no hay actas de cierre registradas.",
    pintar: tablaActasCierre,
  });
}

function tablaActasCierre(actas) {
  const tarjeta = document.createElement("div");
  tarjeta.className = "tarjeta-ancha";
  const tabla = document.createElement("table");
  const thead = document.createElement("thead");
  const filaCabecera = document.createElement("tr");
  ["Número", "Proyecto", "Cliente", "Tipo de entrega", ""].forEach((texto) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = texto;
    filaCabecera.append(th);
  });
  thead.append(filaCabecera);

  const tbody = document.createElement("tbody");
  actas.forEach((a) => {
    const fila = document.createElement("tr");
    [a.numero_acta, a.proyecto_codigo || "—", a.cliente_nombre || "—"].forEach((valor) => {
      fila.append(celda(valor));
    });
    fila.append(celda(estadoPill(textoTipoEntrega(a.tipo_entrega), tipoPillTipoEntrega(a.tipo_entrega))));
    const accion = document.createElement("td");
    const editar = boton("Ver / Editar", () => (window.location.hash = `#/actas-cierre/${a.id}`), true);
    editar.setAttribute("aria-label", `Ver acta ${a.numero_acta}`);
    accion.append(editar);
    fila.append(accion);
    tbody.append(fila);
  });

  tabla.append(thead, tbody);
  tarjeta.append(tabla);
  return tarjeta;
}

// opciones.modoVersion: corrige el acta firmada como nueva versión (no se elimina).
async function vistaActaCierreForm(id, opciones = {}) {
  const modoVersion = Boolean(id && opciones.modoVersion);
  marcarMenu("actas-cierre");
  mostrarCargando();

  const [proyectos, clientes, actasEntrega] = await Promise.all([
    obtenerProyectos(),
    obtenerClientes(),
    obtenerActasEntrega(),
  ]);
  let acta = null;
  if (id) {
    const r = await api("GET", `/actas-cierre-satisfaccion/${id}`);
    if (r.status !== 200) {
      contenido.replaceChildren(encabezado("Acta de cierre"), alerta("error", "No se encontró el acta."));
      return;
    }
    acta = r.cuerpo.acta;
  } else if (proyectos.length === 0 || clientes.length === 0) {
    contenido.replaceChildren(
      encabezado("Nueva acta"),
      alerta("error", "Primero crea al menos un proyecto y un cliente.")
    );
    return;
  }

  const opcionesProyectos = proyectos.map((p) => ({ valor: String(p.id), texto: p.nombre_proyecto }));
  const opcionesClientes = clientes.map((c) => ({ valor: String(c.id), texto: c.nombre_razon_social }));
  const nombreClienteActaEntrega = (clienteId) =>
    clientes.find((c) => c.id === clienteId)?.nombre_razon_social || "—";
  const actasEntregaFiltradas = id
    ? actasEntrega.filter((a) => a.proyecto_id === acta.proyecto_id)
    : actasEntrega;
  const opcionesActaEntrega = [
    { valor: "", texto: "Ninguna" },
    ...actasEntregaFiltradas.map((a) => ({
      valor: String(a.id),
      texto: id ? a.numero_acta : `${a.numero_acta} — ${nombreClienteActaEntrega(a.cliente_id)}`,
    })),
  ];

  const camposCabecera = [
    { nombre: "proyecto_id", etiqueta: "Proyecto", tipo: "select", requerido: true, opciones: opcionesProyectos },
    { nombre: "cliente_id", etiqueta: "Cliente", tipo: "select", requerido: true, opciones: opcionesClientes },
    { nombre: "acta_entrega_id", etiqueta: "Acta de entrega de origen", tipo: "select", opciones: opcionesActaEntrega },
    { nombre: "tipo_entrega", etiqueta: "Tipo de entrega", tipo: "select", requerido: true, opciones: OPCIONES_TIPO_ENTREGA },
    { nombre: "tipo_documento_referencia", etiqueta: "Documento de referencia", tipo: "select", requerido: true, opciones: OPCIONES_DOCUMENTO_REFERENCIA },
    { nombre: "numero_documento_referencia", etiqueta: "Número de documento" },
    { nombre: "objeto", etiqueta: "Objeto", requerido: true },
    { nombre: "receptor_cliente_nombre", etiqueta: "Nombre de quien recibe", requerido: true },
    { nombre: "receptor_cliente_cargo", etiqueta: "Cargo de quien recibe" },
    { nombre: "fecha_elaboracion", etiqueta: "Fecha de elaboración", tipo: "date" },
  ];

  contenido.replaceChildren();
  const volver = modoVersion
    ? boton("Cancelar nueva versión", () => (window.location.hash = `#/actas-cierre/${id}`), true)
    : boton("Volver a actas de cierre", () => (window.location.hash = "#/actas-cierre"), true);
  contenido.append(
    encabezado(
      id
        ? `${modoVersion ? "Nueva versión del acta" : "Acta"} ${acta.numero_acta}${acta.version > 1 ? ` · v${acta.version}` : ""}`
        : "Nueva acta de cierre",
      [volver]
    )
  );

  const tarjeta = document.createElement("div");
  tarjeta.className = "tarjeta-ancha";
  const mensaje = document.createElement("div");
  const form = document.createElement("form");
  form.noValidate = true;
  const grid = document.createElement("div");
  grid.className = "formulario-grid";

  camposCabecera.forEach((config) => {
    let valor = "";
    if (acta) {
      if (config.nombre === "fecha_elaboracion") valor = acta.fecha_elaboracion ? acta.fecha_elaboracion.substring(0, 10) : "";
      else valor = acta[config.nombre] !== null && acta[config.nombre] !== undefined ? String(acta[config.nombre]) : "";
    }
    grid.append(construirCampo(config, valor));
  });

  const subtituloItems = document.createElement("h3");
  subtituloItems.textContent = "Ítems verificados";
  subtituloItems.style.marginTop = "24px";

  const tablaItems = document.createElement("table");
  tablaItems.className = "tabla-items";
  const theadItems = document.createElement("thead");
  const filaCabeceraItems = document.createElement("tr");
  ["Elemento", "Cantidad", "Cumple", ""].forEach((texto) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = texto;
    filaCabeceraItems.append(th);
  });
  theadItems.append(filaCabeceraItems);
  const tbodyItems = document.createElement("tbody");
  tablaItems.append(theadItems, tbodyItems);

  const items = acta
    ? acta.items.map((i) => ({ ...i }))
    : [{ elemento: "", cantidad: "1", cumple: "si" }];

  function construirFilaActaItem(item, onEliminar) {
    const fila = document.createElement("tr");

    const tdElemento = document.createElement("td");
    const inputElemento = document.createElement("input");
    inputElemento.type = "text";
    inputElemento.name = "elemento";
    inputElemento.setAttribute("aria-label", "Elemento");
    inputElemento.value = item.elemento || "";
    inputElemento.required = true;
    inputElemento.addEventListener("input", () => (item.elemento = inputElemento.value));
    tdElemento.append(inputElemento);
    fila.append(tdElemento);

    const tdCantidad = document.createElement("td");
    const inputCantidad = document.createElement("input");
    inputCantidad.type = "number";
    inputCantidad.name = "cantidad";
    inputCantidad.setAttribute("aria-label", "Cantidad");
    inputCantidad.step = "1";
    inputCantidad.min = "1";
    inputCantidad.value = item.cantidad ?? "1";
    inputCantidad.required = true;
    inputCantidad.addEventListener("input", () => (item.cantidad = inputCantidad.value));
    tdCantidad.append(inputCantidad);
    fila.append(tdCantidad);

    const tdCumple = document.createElement("td");
    const selectCumple = document.createElement("select");
    selectCumple.name = "cumple";
    selectCumple.setAttribute("aria-label", "Cumple");
    [{ valor: "si", texto: "Sí" }, { valor: "no", texto: "No" }].forEach((op) => {
      const o = document.createElement("option");
      o.value = op.valor;
      o.textContent = op.texto;
      selectCumple.append(o);
    });
    selectCumple.value = item.cumple || "si";
    selectCumple.addEventListener("change", () => (item.cumple = selectCumple.value));
    tdCumple.append(selectCumple);
    fila.append(tdCumple);

    const tdAccion = document.createElement("td");
    tdAccion.append(boton("Quitar", onEliminar, true));
    fila.append(tdAccion);

    return fila;
  }

  function redibujarItems() {
    tbodyItems.replaceChildren();
    items.forEach((item, indice) => {
      const fila = construirFilaActaItem(item, () => {
        items.splice(indice, 1);
        if (items.length === 0) {
          items.push({ elemento: "", cantidad: "1", cumple: "si" });
        }
        redibujarItems();
      });
      tbodyItems.append(fila);
    });
  }

  redibujarItems();

  const bloqueItems = document.createElement("div");
  bloqueItems.className = "tarjeta-ancha";
  bloqueItems.style.boxShadow = "none";
  bloqueItems.style.padding = "0";
  bloqueItems.append(tablaItems);

  const agregar = boton("Agregar ítem", () => {
    items.push({ elemento: "", cantidad: "1", cumple: "si" });
    redibujarItems();
  }, true);
  agregar.style.marginTop = "12px";
  bloqueItems.append(agregar);

  const guardar = document.createElement("button");
  guardar.type = "submit";
  guardar.className = "boton boton-pequeno";
  guardar.style.marginTop = "16px";
  guardar.textContent = modoVersion
    ? `Guardar como versión ${(acta.version || 1) + 1}`
    : id
      ? "Guardar cambios"
      : "Crear acta";

  if (modoVersion) form.append(bloqueModoVersion(acta.version || 1));
  form.append(grid, subtituloItems, bloqueItems, guardar);
  if (!id) form.append(botonCancelar("#/actas-cierre"));
  tarjeta.append(mensaje, form);
  contenido.append(tarjeta);

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    mensaje.replaceChildren();

    const datos = {};
    camposCabecera.forEach((config) => {
      const valor = form.elements[config.nombre].value.trim();
      if (valor !== "") datos[config.nombre] = valor;
    });

    const itemsInvalidos = items.some((item) => !item.elemento || !item.cantidad);
    if (itemsInvalidos) {
      mensaje.append(alerta("error", "Completa elemento y cantidad de cada ítem."));
      return;
    }
    datos.items = items.map((item) => ({
      elemento: item.elemento,
      cantidad: Number(item.cantidad),
      cumple: item.cumple,
    }));

    const faltantes = camposCabecera.filter((c) => c.requerido && !datos[c.nombre]);
    if (faltantes.length > 0) {
      mensaje.append(alerta("error", "Completa los campos obligatorios marcados con *."));
      return;
    }
    if (!id && !confirmarCreacion("esta acta de cierre")) return;

    guardar.disabled = true;
    try {
      const r = await guardarDocumento("actas-cierre", { id, modoVersion, datos, form, mensaje });
      if (!r) return;
      if (r.status === 200 || r.status === 201) {
        window.location.hash = modoVersion ? `#/actas-cierre/${id}` : "#/actas-cierre";
        return;
      }
      if (r.status === 400 && Array.isArray(r.cuerpo?.detalles)) {
        const mensajes = mostrarErroresValidacion(form, camposCabecera, r.cuerpo.detalles);
        mensaje.append(alerta("error", mensajes.join(" · ")));
      } else {
        mensaje.append(alerta("error", r.cuerpo?.error || "No se pudo guardar el acta."));
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
    tarjeta.append(renderSeccionEvidencias("actas_cierre_satisfaccion", id, "Evidencias del cierre"));
    tarjeta.append(await renderPanelVersiones("actas-cierre", id));
  }
}

async function obtenerActasEntrega() {
  const r = await api("GET", `/actas-entrega-equipos${PAGINA_SELECTORES}`);
  return r.status === 200 ? r.cuerpo.actas : [];
}

async function vistaActasEntrega() {
  marcarMenu("actas-entrega");
  const nuevo = boton("Nueva acta", () => (window.location.hash = "#/actas-entrega/nuevo"));
  contenido.replaceChildren(encabezado("Actas de entrega de equipos", [nuevo]));
  await montarListado({
    clave: "actas-entrega",
    api: "/actas-entrega-equipos",
    campo: "actas",
    titulo: "actas de entrega",
    buscar: "Buscar por número, proyecto o cliente",
    vacio: "Aún no hay actas de entrega registradas.",
    pintar: tablaActasEntrega,
  });
}

function tablaActasEntrega(actas) {
  const tarjeta = document.createElement("div");
  tarjeta.className = "tarjeta-ancha";
  const tabla = document.createElement("table");
  const thead = document.createElement("thead");
  const filaCabecera = document.createElement("tr");
  ["Número", "Proyecto", "Cliente", "Lugar de entrega", ""].forEach((texto) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = texto;
    filaCabecera.append(th);
  });
  thead.append(filaCabecera);

  const tbody = document.createElement("tbody");
  actas.forEach((a) => {
    const fila = document.createElement("tr");
    [a.numero_acta, a.proyecto_codigo || "—", a.cliente_nombre || "—", a.lugar_entrega || "—"].forEach(
      (valor) => {
        fila.append(celda(valor));
      }
    );
    const accion = document.createElement("td");
    const editar = boton("Ver / Editar", () => (window.location.hash = `#/actas-entrega/${a.id}`), true);
    editar.setAttribute("aria-label", `Ver acta ${a.numero_acta}`);
    accion.append(editar);
    fila.append(accion);
    tbody.append(fila);
  });

  tabla.append(thead, tbody);
  tarjeta.append(tabla);
  return tarjeta;
}

// opciones.modoVersion: corrige el acta firmada como nueva versión (no se elimina).
async function vistaActaEntregaForm(id, opciones = {}) {
  const modoVersion = Boolean(id && opciones.modoVersion);
  marcarMenu("actas-entrega");
  mostrarCargando();

  const [proyectos, clientes] = await Promise.all([obtenerProyectos(), obtenerClientes()]);
  let acta = null;
  if (id) {
    const r = await api("GET", `/actas-entrega-equipos/${id}`);
    if (r.status !== 200) {
      contenido.replaceChildren(encabezado("Acta de entrega"), alerta("error", "No se encontró el acta."));
      return;
    }
    acta = r.cuerpo.acta;
  } else if (proyectos.length === 0 || clientes.length === 0) {
    contenido.replaceChildren(
      encabezado("Nueva acta"),
      alerta("error", "Primero crea al menos un proyecto y un cliente.")
    );
    return;
  }

  const opcionesProyectos = proyectos.map((p) => ({ valor: String(p.id), texto: p.nombre_proyecto }));
  const opcionesClientes = clientes.map((c) => ({ valor: String(c.id), texto: c.nombre_razon_social }));

  const camposCabecera = [
    { nombre: "proyecto_id", etiqueta: "Proyecto", tipo: "select", requerido: true, opciones: opcionesProyectos },
    { nombre: "cliente_id", etiqueta: "Cliente (Contratante)", tipo: "select", requerido: true, opciones: opcionesClientes },
    { nombre: "numero_contrato_oc", etiqueta: "N° Contrato y/o orden de compra" },
    { nombre: "objeto", etiqueta: "Objeto", requerido: true },
    { nombre: "lugar_entrega", etiqueta: "Lugar de entrega" },
    { nombre: "receptor_nombre", etiqueta: "Nombre de quien recibe", requerido: true },
    { nombre: "receptor_identificacion", etiqueta: "Identificación de quien recibe" },
    { nombre: "receptor_cargo", etiqueta: "Cargo de quien recibe" },
    { nombre: "observaciones", etiqueta: "Observaciones" },
    { nombre: "fecha_elaboracion", etiqueta: "Fecha de elaboración", tipo: "date" },
  ];

  contenido.replaceChildren();
  const volver = modoVersion
    ? boton("Cancelar nueva versión", () => (window.location.hash = `#/actas-entrega/${id}`), true)
    : boton("Volver a actas de entrega", () => (window.location.hash = "#/actas-entrega"), true);
  contenido.append(
    encabezado(
      id
        ? `${modoVersion ? "Nueva versión del acta" : "Acta"} ${acta.numero_acta}${acta.version > 1 ? ` · v${acta.version}` : ""}`
        : "Nueva acta de entrega",
      [volver]
    )
  );

  const tarjeta = document.createElement("div");
  tarjeta.className = "tarjeta-ancha";
  const mensaje = document.createElement("div");
  const form = document.createElement("form");
  form.noValidate = true;
  const grid = document.createElement("div");
  grid.className = "formulario-grid";

  camposCabecera.forEach((config) => {
    let valor = "";
    if (acta) {
      if (config.nombre === "fecha_elaboracion") valor = acta.fecha_elaboracion ? acta.fecha_elaboracion.substring(0, 10) : "";
      else valor = acta[config.nombre] !== null && acta[config.nombre] !== undefined ? String(acta[config.nombre]) : "";
    }
    grid.append(construirCampo(config, valor));
  });

  const subtituloItems = document.createElement("h3");
  subtituloItems.textContent = "Equipos entregados";
  subtituloItems.style.marginTop = "24px";

  const tablaItems = document.createElement("table");
  tablaItems.className = "tabla-items";
  const theadItems = document.createElement("thead");
  const filaCabeceraItems = document.createElement("tr");
  ["Descripción", "Cantidad", "Marca", "Modelo", "N° Serie", "Cumple", ""].forEach((texto) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = texto;
    filaCabeceraItems.append(th);
  });
  theadItems.append(filaCabeceraItems);
  const tbodyItems = document.createElement("tbody");
  tablaItems.append(theadItems, tbodyItems);

  const itemVacio = () => ({
    descripcion_equipo: "",
    cantidad: "1",
    marca: "",
    modelo: "",
    numero_serie: "",
    cumple: "si",
  });
  const items = acta ? acta.items.map((i) => ({ ...i })) : [itemVacio()];

  function celdaInputItem(item, nombre, tipo, etiqueta, requerido) {
    const td = document.createElement("td");
    const input = document.createElement("input");
    input.type = tipo;
    input.name = nombre;
    input.setAttribute("aria-label", etiqueta);
    input.value = item[nombre] ?? "";
    if (tipo === "number") {
      input.step = "1";
      input.min = "1";
    }
    if (requerido) input.required = true;
    input.addEventListener("input", () => (item[nombre] = input.value));
    td.append(input);
    return td;
  }

  function construirFilaActaEntregaItem(item, onEliminar) {
    const fila = document.createElement("tr");
    fila.append(
      celdaInputItem(item, "descripcion_equipo", "text", "Descripción del equipo", true),
      celdaInputItem(item, "cantidad", "number", "Cantidad", true),
      celdaInputItem(item, "marca", "text", "Marca", false),
      celdaInputItem(item, "modelo", "text", "Modelo", false),
      celdaInputItem(item, "numero_serie", "text", "N° Serie", false)
    );

    const tdCumple = document.createElement("td");
    const selectCumple = document.createElement("select");
    selectCumple.name = "cumple";
    selectCumple.setAttribute("aria-label", "Cumple");
    [{ valor: "si", texto: "Sí" }, { valor: "no", texto: "No" }].forEach((op) => {
      const o = document.createElement("option");
      o.value = op.valor;
      o.textContent = op.texto;
      selectCumple.append(o);
    });
    selectCumple.value = item.cumple || "si";
    selectCumple.addEventListener("change", () => (item.cumple = selectCumple.value));
    tdCumple.append(selectCumple);
    fila.append(tdCumple);

    const tdAccion = document.createElement("td");
    tdAccion.append(boton("Quitar", onEliminar, true));
    fila.append(tdAccion);

    return fila;
  }

  function redibujarItems() {
    tbodyItems.replaceChildren();
    items.forEach((item, indice) => {
      const fila = construirFilaActaEntregaItem(item, () => {
        items.splice(indice, 1);
        if (items.length === 0) {
          items.push(itemVacio());
        }
        redibujarItems();
      });
      tbodyItems.append(fila);
    });
  }

  redibujarItems();

  const bloqueItems = document.createElement("div");
  bloqueItems.className = "tarjeta-ancha";
  bloqueItems.style.boxShadow = "none";
  bloqueItems.style.padding = "0";
  bloqueItems.append(tablaItems);

  const agregar = boton("Agregar equipo", () => {
    items.push(itemVacio());
    redibujarItems();
  }, true);
  agregar.style.marginTop = "12px";
  bloqueItems.append(agregar);

  const guardar = document.createElement("button");
  guardar.type = "submit";
  guardar.className = "boton boton-pequeno";
  guardar.style.marginTop = "16px";
  guardar.textContent = modoVersion
    ? `Guardar como versión ${(acta.version || 1) + 1}`
    : id
      ? "Guardar cambios"
      : "Crear acta";

  if (modoVersion) form.append(bloqueModoVersion(acta.version || 1));
  form.append(grid, subtituloItems, bloqueItems, guardar);
  if (!id) form.append(botonCancelar("#/actas-entrega"));
  tarjeta.append(mensaje, form);
  contenido.append(tarjeta);

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    mensaje.replaceChildren();

    const datos = {};
    camposCabecera.forEach((config) => {
      const valor = form.elements[config.nombre].value.trim();
      if (valor !== "") datos[config.nombre] = valor;
    });

    const itemsInvalidos = items.some((item) => !item.descripcion_equipo || !item.cantidad);
    if (itemsInvalidos) {
      mensaje.append(alerta("error", "Completa descripción y cantidad de cada equipo."));
      return;
    }
    datos.items = items.map((item) => ({
      descripcion_equipo: item.descripcion_equipo,
      cantidad: Number(item.cantidad),
      marca: item.marca || undefined,
      modelo: item.modelo || undefined,
      numero_serie: item.numero_serie || undefined,
      cumple: item.cumple,
    }));

    const faltantes = camposCabecera.filter((c) => c.requerido && !datos[c.nombre]);
    if (faltantes.length > 0) {
      mensaje.append(alerta("error", "Completa los campos obligatorios marcados con *."));
      return;
    }
    if (!id && !confirmarCreacion("esta acta de entrega")) return;

    guardar.disabled = true;
    try {
      const r = await guardarDocumento("actas-entrega", { id, modoVersion, datos, form, mensaje });
      if (!r) return;
      if (r.status === 200 || r.status === 201) {
        window.location.hash = modoVersion ? `#/actas-entrega/${id}` : "#/actas-entrega";
        return;
      }
      if (r.status === 400 && Array.isArray(r.cuerpo?.detalles)) {
        const mensajes = mostrarErroresValidacion(form, camposCabecera, r.cuerpo.detalles);
        mensaje.append(alerta("error", mensajes.join(" · ")));
      } else {
        mensaje.append(alerta("error", r.cuerpo?.error || "No se pudo guardar el acta."));
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
    tarjeta.append(renderSeccionEvidencias("actas_entrega_equipos", id, "Evidencias de la entrega"));
    tarjeta.append(await renderPanelVersiones("actas-entrega", id));
  }
}
