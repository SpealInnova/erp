/* global
   alerta, api, boton, botonCancelar, celda, confirmarCreacion, construirCampo, contenido,
   encabezado, estadoPill, marcarMenu, montarListado, mostrarCargando,
   mostrarErroresValidacion, obtenerProyectos, renderSeccionEvidencias */
/* exported vistaRequisicionForm, vistaRequisiciones */
// Requisiciones: lista, formulario e ítems.

const ESTADOS_REQUISICION = [
  { valor: "solicitada", texto: "Solicitada" },
  { valor: "en_cotizacion", texto: "En cotización" },
  { valor: "convertida_oc", texto: "Convertida a OC" },
  { valor: "cerrada", texto: "Cerrada" },
];

function textoEstadoRequisicion(valor) {
  const encontrado = ESTADOS_REQUISICION.find((e) => e.valor === valor);
  return encontrado ? encontrado.texto : valor;
}

function tipoPillRequisicion(valor) {
  if (valor === "cerrada") return "good";
  if (valor === "convertida_oc") return "info";
  if (valor === "solicitada") return "mute";
  return "warn";
}

const OPCIONES_PROCEDENCIA = [
  { valor: "nacional", texto: "Nacional" },
  { valor: "importacion", texto: "Importación" },
  { valor: "almacen", texto: "Almacén" },
];

function textoProcedencia(valor) {
  const encontrado = OPCIONES_PROCEDENCIA.find((o) => o.valor === valor);
  return encontrado ? encontrado.texto : valor;
}

async function vistaRequisiciones() {
  marcarMenu("requisiciones");
  const nuevo = boton("Nueva requisición", () => (window.location.hash = "#/requisiciones/nuevo"));
  contenido.replaceChildren(encabezado("Requisiciones", [nuevo]));
  await montarListado({
    clave: "requisiciones",
    api: "/requisiciones",
    campo: "requisiciones",
    titulo: "requisiciones",
    buscar: "Buscar por número o proyecto",
    estados: ESTADOS_REQUISICION,
    vacio: "Aún no hay requisiciones registradas.",
    pintar: tablaRequisiciones,
  });
}

function tablaRequisiciones(requisiciones) {
  const tarjeta = document.createElement("div");
  tarjeta.className = "tarjeta-ancha";
  const tabla = document.createElement("table");
  const thead = document.createElement("thead");
  const filaCabecera = document.createElement("tr");
  ["Número", "Proyecto", "Procedencia", "Estado", ""].forEach((texto) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = texto;
    filaCabecera.append(th);
  });
  thead.append(filaCabecera);

  const tbody = document.createElement("tbody");
  requisiciones.forEach((r) => {
    const fila = document.createElement("tr");
    [
      r.numero_requisicion,
      r.proyecto_nombre || "—",
      textoProcedencia(r.procedencia),
      estadoPill(textoEstadoRequisicion(r.estado), tipoPillRequisicion(r.estado)),
    ].forEach((valor) => {
      fila.append(celda(valor));
    });
    const accion = document.createElement("td");
    const editar = boton(
      "Ver / Editar",
      () => (window.location.hash = `#/requisiciones/${r.id}`),
      true
    );
    editar.setAttribute("aria-label", `Ver requisición ${r.numero_requisicion}`);
    accion.append(editar);
    fila.append(accion);
    tbody.append(fila);
  });

  tabla.append(thead, tbody);
  tarjeta.append(tabla);
  return tarjeta;
}

function construirFilaItemSimple(item, campos, editable, onEliminar) {
  const fila = document.createElement("tr");

  campos.forEach((campo) => {
    const td = document.createElement("td");
    if (!editable) {
      td.textContent = item[campo.nombre] ?? "";
      fila.append(td);
      return;
    }
    const input = document.createElement("input");
    input.type = campo.tipo || "text";
    input.name = campo.nombre;
    input.setAttribute("aria-label", campo.etiqueta);
    input.value = item[campo.nombre] ?? "";
    if (campo.tipo === "number") {
      input.step = "1";
      input.min = "1";
    }
    input.required = true;
    input.addEventListener("input", () => {
      item[campo.nombre] = input.value;
    });
    td.append(input);
    fila.append(td);
  });

  const tdAccion = document.createElement("td");
  if (editable) {
    tdAccion.append(boton("Quitar", onEliminar, true));
  }
  fila.append(tdAccion);

  return fila;
}

async function vistaRequisicionForm(id) {
  marcarMenu("requisiciones");
  mostrarCargando();

  const proyectos = await obtenerProyectos();
  let requisicion = null;
  if (id) {
    const r = await api("GET", `/requisiciones/${id}`);
    if (r.status !== 200) {
      contenido.replaceChildren(encabezado("Requisición"), alerta("error", "No se encontró la requisición."));
      return;
    }
    requisicion = r.cuerpo.requisicion;
  } else if (proyectos.length === 0) {
    contenido.replaceChildren(
      encabezado("Nueva requisición"),
      alerta("error", "Primero crea al menos un proyecto.")
    );
    return;
  }

  const editable = !id || requisicion.estado === "solicitada";
  const opcionesProyectos = proyectos.map((p) => ({ valor: String(p.id), texto: p.nombre_proyecto }));

  contenido.replaceChildren();
  const volver = boton("Volver a requisiciones", () => (window.location.hash = "#/requisiciones"), true);
  contenido.append(
    encabezado(id ? `Requisición ${requisicion.numero_requisicion}` : "Nueva requisición", [volver])
  );

  const tarjeta = document.createElement("div");
  tarjeta.className = "tarjeta-ancha";
  const mensaje = document.createElement("div");
  const form = document.createElement("form");
  form.noValidate = true;
  const grid = document.createElement("div");
  grid.className = "formulario-grid";

  const camposCabecera = id
    ? [
        { nombre: "numero_requisicion", etiqueta: "Número de requisición", tipo: "estatico" },
        { nombre: "proyecto", etiqueta: "Proyecto", tipo: "estatico" },
        editable
          ? { nombre: "procedencia", etiqueta: "Procedencia", tipo: "select", requerido: true, opciones: OPCIONES_PROCEDENCIA }
          : { nombre: "procedencia_txt", etiqueta: "Procedencia", tipo: "estatico" },
      ]
    : [
        { nombre: "numero_requisicion", etiqueta: "Número de requisición", requerido: true },
        { nombre: "proyecto_id", etiqueta: "Proyecto", tipo: "select", requerido: true, opciones: opcionesProyectos },
        { nombre: "procedencia", etiqueta: "Procedencia", tipo: "select", requerido: true, opciones: OPCIONES_PROCEDENCIA },
      ];

  camposCabecera.forEach((config) => {
    let valor = "";
    if (requisicion) {
      if (config.nombre === "numero_requisicion") {
        valor = requisicion.numero_requisicion;
      } else if (config.nombre === "proyecto") {
        valor = proyectos.find((p) => p.id === requisicion.proyecto_id)?.nombre_proyecto || "—";
      } else if (config.nombre === "procedencia" || config.nombre === "procedencia_txt") {
        valor = config.tipo === "estatico" ? textoProcedencia(requisicion.procedencia) : requisicion.procedencia;
      }
    }
    grid.append(construirCampo(config, valor));
  });

  if (!editable) {
    const aviso = document.createElement("p");
    aviso.className = "subtitulo";
    aviso.textContent = "Solo se puede editar una requisición en estado solicitada.";
    grid.append(aviso);
  }

  const subtituloItems = document.createElement("h3");
  subtituloItems.textContent = "Ítems";
  subtituloItems.style.marginTop = "24px";

  const camposItem = [
    { nombre: "descripcion", etiqueta: "Descripción" },
    { nombre: "cantidad", etiqueta: "Cantidad", tipo: "number" },
    { nombre: "unidad", etiqueta: "Unidad" },
  ];

  const tablaItems = document.createElement("table");
  tablaItems.className = "tabla-items";
  const theadItems = document.createElement("thead");
  const filaCabeceraItems = document.createElement("tr");
  ["Descripción", "Cantidad", "Unidad", ""].forEach((texto) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = texto;
    filaCabeceraItems.append(th);
  });
  theadItems.append(filaCabeceraItems);
  const tbodyItems = document.createElement("tbody");
  tablaItems.append(theadItems, tbodyItems);

  const items = requisicion
    ? requisicion.items.map((i) => ({ ...i }))
    : [{ descripcion: "", cantidad: "1", unidad: "" }];

  function redibujarItems() {
    tbodyItems.replaceChildren();
    items.forEach((item, indice) => {
      const fila = construirFilaItemSimple(item, camposItem, editable, () => {
        items.splice(indice, 1);
        if (items.length === 0) {
          items.push({ descripcion: "", cantidad: "1", unidad: "" });
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

  if (editable) {
    const agregar = boton("Agregar ítem", () => {
      items.push({ descripcion: "", cantidad: "1", unidad: "" });
      redibujarItems();
    }, true);
    agregar.style.marginTop = "12px";
    bloqueItems.append(agregar);
  }

  const guardar = document.createElement("button");
  guardar.type = "submit";
  guardar.className = "boton boton-pequeno";
  guardar.style.marginTop = "16px";
  guardar.textContent = id ? "Guardar cambios" : "Crear requisición";

  form.append(grid, subtituloItems, bloqueItems);
  if (editable) form.append(guardar);
  if (!id) form.append(botonCancelar("#/requisiciones"));
  tarjeta.append(mensaje, form);
  contenido.append(tarjeta);

  if (editable) {
    form.addEventListener("submit", async (evento) => {
      evento.preventDefault();
      mensaje.replaceChildren();

      const datos = {};
      camposCabecera
        .filter((c) => c.tipo !== "estatico")
        .forEach((config) => {
          const valor = form.elements[config.nombre].value.trim();
          if (valor !== "") datos[config.nombre] = valor;
        });

      const itemsInvalidos = items.some((item) => !item.descripcion || !item.cantidad || !item.unidad);
      if (itemsInvalidos) {
        mensaje.append(alerta("error", "Completa descripción, cantidad y unidad de cada ítem."));
        return;
      }
      datos.items = items.map((item) => ({
        descripcion: item.descripcion,
        cantidad: Number(item.cantidad),
        unidad: item.unidad,
      }));

      const faltantes = camposCabecera.filter(
        (c) => c.tipo !== "estatico" && c.requerido && !datos[c.nombre]
      );
      if (faltantes.length > 0) {
        mensaje.append(alerta("error", "Completa los campos obligatorios marcados con *."));
        return;
      }
      if (!id && !confirmarCreacion("esta requisición")) return;

      guardar.disabled = true;
      try {
        const r = id
          ? await api("PUT", `/requisiciones/${id}`, datos)
          : await api("POST", "/requisiciones", datos);
        if (r.status === 200 || r.status === 201) {
          window.location.hash = id ? `#/requisiciones/${id}` : "#/requisiciones";
          if (id) vistaRequisicionForm(id);
          return;
        }
        if (r.status === 400 && Array.isArray(r.cuerpo?.detalles)) {
          const mensajes = mostrarErroresValidacion(form, camposCabecera, r.cuerpo.detalles);
          mensaje.append(alerta("error", mensajes.join(" · ")));
        } else {
          mensaje.append(alerta("error", r.cuerpo?.error || "No se pudo guardar la requisición."));
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

  if (id) {
    const bloqueEstado = document.createElement("div");
    bloqueEstado.style.marginTop = "24px";
    bloqueEstado.style.paddingTop = "24px";
    bloqueEstado.style.borderTop = "1px solid var(--borde)";

    const subtituloEstado = document.createElement("p");
    subtituloEstado.className = "subtitulo";
    subtituloEstado.textContent = `Estado actual: ${textoEstadoRequisicion(requisicion.estado)}`;
    bloqueEstado.append(subtituloEstado);

    const mensajeEstado = document.createElement("div");
    const filaEstado = document.createElement("div");
    filaEstado.className = "formulario-grid";
    filaEstado.append(
      construirCampo(
        { nombre: "nuevo_estado", etiqueta: "Cambiar a", tipo: "select", opciones: ESTADOS_REQUISICION },
        requisicion.estado
      )
    );
    const botonEstado = boton("Actualizar estado", async () => {
      mensajeEstado.replaceChildren();
      const nuevoEstado = document.getElementById("nuevo_estado").value;
      const r = await api("PATCH", `/requisiciones/${id}/estado`, { estado: nuevoEstado });
      if (r.status === 200) {
        vistaRequisicionForm(id);
        return;
      }
      mensajeEstado.append(alerta("error", r.cuerpo?.error || "No se pudo cambiar el estado."));
    });

    bloqueEstado.append(filaEstado, botonEstado, mensajeEstado);
    tarjeta.append(bloqueEstado);
    tarjeta.append(renderSeccionEvidencias("requisiciones", id, "Evidencias / soportes"));
  }
}
