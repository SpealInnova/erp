/* global
   alerta, api, bloqueModoVersion, boton, botonCancelar, celda, confirmarCreacion,
   construirCampo, contenido, encabezado, estadoPill, guardarDocumento, marcarMenu,
   montarListado, mostrarCargando, mostrarErroresValidacion, nombreClienteDe,
   notaSinPermisoEstado, obtenerClientes, obtenerUsuarios, opcionesSegunPermiso, puede,
   renderPanelVersiones */
/* exported vistaCotizacionForm, vistaCotizaciones */
// Cotizaciones: lista, formulario e ítems.

const ESTADOS_COTIZACION = [
  { valor: "borrador", texto: "Borrador" },
  { valor: "revision", texto: "Revisión" },
  { valor: "aprobacion", texto: "Aprobación" },
  { valor: "enviada", texto: "Enviada" },
  { valor: "aceptada", texto: "Aceptada" },
  { valor: "rechazada", texto: "Rechazada" },
];

function textoEstadoCotizacion(valor) {
  const encontrado = ESTADOS_COTIZACION.find((e) => e.valor === valor);
  return encontrado ? encontrado.texto : valor;
}

function tipoPillCotizacion(valor) {
  if (valor === "aceptada") return "good";
  if (valor === "rechazada") return "crit";
  if (valor === "borrador") return "mute";
  return "info";
}

function calcularTotalItem(item) {
  const cantidad = Number(item.cantidad) || 0;
  const valorUnitario = Number(item.valor_unitario) || 0;
  const descuento = Number(item.descuento_porcentaje) || 0;
  const iva = Number(item.iva_porcentaje) || 0;
  const baseConDescuento = cantidad * valorUnitario * (1 - descuento / 100);
  return baseConDescuento * (1 + iva / 100);
}

function formatearMoneda(valor) {
  return valor.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function vistaCotizaciones() {
  marcarMenu("cotizaciones");
  const nuevo = boton("Nueva cotización", () => (window.location.hash = "#/cotizaciones/nuevo"));
  contenido.replaceChildren(encabezado("Cotizaciones", [nuevo]));
  await montarListado({
    clave: "cotizaciones",
    api: "/cotizaciones",
    campo: "cotizaciones",
    titulo: "cotizaciones",
    buscar: "Buscar por número o cliente",
    estados: ESTADOS_COTIZACION,
    vacio: "Aún no hay cotizaciones registradas.",
    pintar: tablaCotizaciones,
  });
}

function tablaCotizaciones(cotizaciones) {
  const tarjeta = document.createElement("div");
  tarjeta.className = "tarjeta-ancha";
  const tabla = document.createElement("table");
  const thead = document.createElement("thead");
  const filaCabecera = document.createElement("tr");
  ["Número", "Cliente", "Asesor", "Estado", "Fecha validez", ""].forEach((texto) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = texto;
    filaCabecera.append(th);
  });
  thead.append(filaCabecera);

  const tbody = document.createElement("tbody");
  cotizaciones.forEach((c) => {
    const fila = document.createElement("tr");
    [
      c.numero_cotizacion,
      c.cliente_nombre || "—",
      c.asesor_nombre || "—",
      estadoPill(textoEstadoCotizacion(c.estado), tipoPillCotizacion(c.estado)),
      c.fecha_validez ? c.fecha_validez.substring(0, 10) : "—",
    ].forEach((valor) => {
      fila.append(celda(valor));
    });
    const accion = document.createElement("td");
    const editar = boton(
      "Ver / Editar",
      () => (window.location.hash = `#/cotizaciones/${c.id}`),
      true
    );
    editar.setAttribute("aria-label", `Ver cotización ${c.numero_cotizacion}`);
    accion.append(editar);
    fila.append(accion);
    tbody.append(fila);
  });

  tabla.append(thead, tbody);
  tarjeta.append(tabla);
  return tarjeta;
}

const ETIQUETAS_ITEM_COTIZACION = {
  descripcion: "Descripción",
  cantidad: "Cantidad",
  valor_unitario: "Valor unitario",
  descuento_porcentaje: "Descuento %",
  iva_porcentaje: "IVA %",
};

function construirFilaItem(item, editable, onCambio, onEliminar) {
  const fila = document.createElement("tr");

  function celdaInput(nombre, tipo, valor, min) {
    const td = document.createElement("td");
    if (!editable) {
      td.textContent = nombre === "descripcion" ? valor : valor;
      return td;
    }
    const input = document.createElement("input");
    input.type = tipo;
    input.name = nombre;
    input.setAttribute("aria-label", ETIQUETAS_ITEM_COTIZACION[nombre]);
    input.value = valor;
    if (tipo === "number") {
      input.step = "0.01";
      input.min = min ?? "0";
    }
    input.required = nombre === "descripcion" || nombre === "cantidad" || nombre === "valor_unitario";
    input.addEventListener("input", () => {
      item[nombre] = tipo === "number" ? input.value : input.value;
      onCambio();
    });
    td.append(input);
    return td;
  }

  fila.append(
    celdaInput("descripcion", "text", item.descripcion || ""),
    celdaInput("cantidad", "number", item.cantidad ?? "1", "0.0001"),
    celdaInput("valor_unitario", "number", item.valor_unitario ?? "0"),
    celdaInput("descuento_porcentaje", "number", item.descuento_porcentaje ?? "0"),
    celdaInput("iva_porcentaje", "number", item.iva_porcentaje ?? "19")
  );

  const tdTotal = document.createElement("td");
  tdTotal.className = "item-total";
  tdTotal.textContent = formatearMoneda(calcularTotalItem(item));
  fila.append(tdTotal);

  const tdAccion = document.createElement("td");
  if (editable) {
    const quitar = boton("Quitar", onEliminar, true);
    tdAccion.append(quitar);
  }
  fila.append(tdAccion);

  fila._actualizarTotal = () => {
    tdTotal.textContent = formatearMoneda(calcularTotalItem(item));
  };

  return fila;
}

// opciones.modoVersion: corrige la cotización como nueva versión, en cualquier estado.
async function vistaCotizacionForm(id, opciones = {}) {
  const modoVersion = Boolean(id && opciones.modoVersion);
  marcarMenu("cotizaciones");
  mostrarCargando();

  const [clientes, usuarios] = await Promise.all([obtenerClientes(), obtenerUsuarios()]);
  let cotizacion = null;
  if (id) {
    const r = await api("GET", `/cotizaciones/${id}`);
    if (r.status !== 200) {
      contenido.replaceChildren(encabezado("Cotización"), alerta("error", "No se encontró la cotización."));
      return;
    }
    cotizacion = r.cuerpo.cotizacion;
  } else if (clientes.length === 0) {
    contenido.replaceChildren(
      encabezado("Nueva cotización"),
      alerta("error", "Primero crea al menos un cliente.")
    );
    return;
  }

  const editable = modoVersion || !id || cotizacion.estado === "borrador";
  const opcionesClientes = clientes.map((c) => ({ valor: String(c.id), texto: c.nombre_razon_social }));
  const opcionesUsuarios = usuarios.map((u) => ({ valor: String(u.id), texto: u.nombre }));

  contenido.replaceChildren();
  const volver = modoVersion
    ? boton("Cancelar nueva versión", () => (window.location.hash = `#/cotizaciones/${id}`), true)
    : boton("Volver a cotizaciones", () => (window.location.hash = "#/cotizaciones"), true);
  contenido.append(
    encabezado(
      id
        ? `${modoVersion ? "Nueva versión de la cotización" : "Cotización"} ${cotizacion.numero_cotizacion}${cotizacion.version > 1 ? ` · v${cotizacion.version}` : ""}`
        : "Nueva cotización",
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

  const camposCabecera = id
    ? [
        { nombre: "cliente", etiqueta: "Cliente", tipo: "estatico" },
        editable
          ? {
              nombre: "asesor_comercial_id",
              etiqueta: "Asesor comercial",
              tipo: "select",
              requerido: true,
              opciones: opcionesUsuarios,
            }
          : { nombre: "asesor", etiqueta: "Asesor comercial", tipo: "estatico" },
        editable
          ? { nombre: "fecha_validez", etiqueta: "Fecha de validez", tipo: "date" }
          : { nombre: "fecha_validez_txt", etiqueta: "Fecha de validez", tipo: "estatico" },
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
          nombre: "asesor_comercial_id",
          etiqueta: "Asesor comercial",
          tipo: "select",
          requerido: true,
          opciones: opcionesUsuarios,
        },
        { nombre: "fecha_validez", etiqueta: "Fecha de validez", tipo: "date" },
      ];

  camposCabecera.forEach((config) => {
    let valor = "";
    if (cotizacion) {
      if (config.nombre === "cliente") valor = nombreClienteDe(clientes, cotizacion.cliente_id);
      else if (config.nombre === "asesor") valor = nombreClienteDe(usuarios.map((u) => ({
        id: u.id, nombre_razon_social: u.nombre,
      })), cotizacion.asesor_comercial_id);
      else if (config.nombre === "asesor_comercial_id") valor = String(cotizacion.asesor_comercial_id);
      else if (config.nombre === "fecha_validez" || config.nombre === "fecha_validez_txt") {
        valor = cotizacion.fecha_validez ? cotizacion.fecha_validez.substring(0, 10) : "";
      }
    }
    grid.append(construirCampo(config, valor));
  });

  if (!editable) {
    const avisoSoloLectura = document.createElement("p");
    avisoSoloLectura.className = "subtitulo";
    avisoSoloLectura.textContent =
      "Solo se puede editar una cotización en estado borrador. Para corregirla, crea una nueva versión (abajo).";
    grid.append(avisoSoloLectura);
  }

  const subtituloItems = document.createElement("h3");
  subtituloItems.textContent = "Ítems";
  subtituloItems.style.marginTop = "24px";

  const tablaItems = document.createElement("table");
  tablaItems.className = "tabla-items";
  const theadItems = document.createElement("thead");
  const filaCabeceraItems = document.createElement("tr");
  ["Descripción", "Cantidad", "Valor unitario", "Descuento %", "IVA %", "Total", ""].forEach((texto) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = texto;
    filaCabeceraItems.append(th);
  });
  theadItems.append(filaCabeceraItems);
  const tbodyItems = document.createElement("tbody");
  tablaItems.append(theadItems, tbodyItems);

  const totalGeneral = document.createElement("p");
  totalGeneral.className = "subtitulo";

  const items = cotizacion
    ? cotizacion.items.map((i) => ({ ...i }))
    : [{ descripcion: "", cantidad: "1", valor_unitario: "0", descuento_porcentaje: "0", iva_porcentaje: "19" }];

  function recalcularTotalGeneral() {
    const total = items.reduce((acc, item) => acc + calcularTotalItem(item), 0);
    totalGeneral.textContent = `Total: $${formatearMoneda(total)}`;
  }

  function redibujarItems() {
    tbodyItems.replaceChildren();
    items.forEach((item, indice) => {
      const fila = construirFilaItem(
        item,
        editable,
        recalcularTotalGeneral,
        () => {
          items.splice(indice, 1);
          if (items.length === 0) {
            items.push({
              descripcion: "",
              cantidad: "1",
              valor_unitario: "0",
              descuento_porcentaje: "0",
              iva_porcentaje: "19",
            });
          }
          redibujarItems();
          recalcularTotalGeneral();
        }
      );
      tbodyItems.append(fila);
    });
  }

  redibujarItems();
  recalcularTotalGeneral();

  const bloqueItems = document.createElement("div");
  bloqueItems.className = "tarjeta-ancha";
  bloqueItems.style.boxShadow = "none";
  bloqueItems.style.padding = "0";
  bloqueItems.append(tablaItems);

  if (editable) {
    const agregar = boton("Agregar ítem", () => {
      items.push({
        descripcion: "",
        cantidad: "1",
        valor_unitario: "0",
        descuento_porcentaje: "0",
        iva_porcentaje: "19",
      });
      redibujarItems();
      recalcularTotalGeneral();
    }, true);
    agregar.style.marginTop = "12px";
    bloqueItems.append(agregar);
  }

  const guardar = document.createElement("button");
  guardar.type = "submit";
  guardar.className = "boton boton-pequeno";
  guardar.style.marginTop = "16px";
  guardar.textContent = modoVersion
    ? `Guardar como versión ${(cotizacion.version || 1) + 1}`
    : id
      ? "Guardar cambios"
      : "Crear cotización";

  if (modoVersion) form.append(bloqueModoVersion(cotizacion.version || 1));
  form.append(grid, subtituloItems, bloqueItems, totalGeneral);
  if (editable) form.append(guardar);
  if (!id) form.append(botonCancelar("#/cotizaciones"));
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

      const itemsInvalidos = items.some(
        (item) => !item.descripcion || !item.cantidad || Number(item.valor_unitario) < 0
      );
      if (itemsInvalidos) {
        mensaje.append(alerta("error", "Completa descripción, cantidad y valor unitario de cada ítem."));
        return;
      }
      datos.items = items.map((item) => ({
        descripcion: item.descripcion,
        cantidad: Number(item.cantidad),
        valor_unitario: Number(item.valor_unitario),
        descuento_porcentaje: Number(item.descuento_porcentaje) || 0,
        iva_porcentaje: Number(item.iva_porcentaje) || 0,
      }));

      const faltantes = camposCabecera.filter(
        (c) => c.tipo !== "estatico" && c.requerido && !datos[c.nombre]
      );
      if (faltantes.length > 0) {
        mensaje.append(alerta("error", "Completa los campos obligatorios marcados con *."));
        return;
      }
      if (!id && !confirmarCreacion("esta cotización")) return;

      guardar.disabled = true;
      try {
        const r = await guardarDocumento("cotizaciones", { id, modoVersion, datos, form, mensaje });
        if (!r) return;
        if (r.status === 200 || r.status === 201) {
          if (modoVersion) {
            window.location.hash = `#/cotizaciones/${id}`;
            return;
          }
          window.location.hash = id ? `#/cotizaciones/${id}` : "#/cotizaciones";
          if (id) vistaCotizacionForm(id);
          return;
        }
        if (r.status === 400 && Array.isArray(r.cuerpo?.detalles)) {
          const mensajes = mostrarErroresValidacion(form, camposCabecera, r.cuerpo.detalles);
          mensaje.append(alerta("error", mensajes.join(" · ")));
        } else {
          mensaje.append(alerta("error", r.cuerpo?.error || "No se pudo guardar la cotización."));
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

  if (modoVersion) return;
  if (id) {
    const bloqueEstado = document.createElement("div");
    bloqueEstado.style.marginTop = "24px";
    bloqueEstado.style.paddingTop = "24px";
    bloqueEstado.style.borderTop = "1px solid var(--borde)";

    const subtituloEstado = document.createElement("p");
    subtituloEstado.className = "subtitulo";
    subtituloEstado.textContent = `Estado actual: ${textoEstadoCotizacion(cotizacion.estado)}`;
    bloqueEstado.append(subtituloEstado);

    // En "aprobación", solo quien aprueba cotizaciones decide (enviar o devolver).
    const opcionesEstado = opcionesSegunPermiso(
      ESTADOS_COTIZACION,
      cotizacion.estado,
      () => cotizacion.estado !== "aprobacion" || puede("aprobar_cotizacion")
    );
    if (opcionesEstado.length > 1) {
      const mensajeEstado = document.createElement("div");
      const filaEstado = document.createElement("div");
      filaEstado.className = "formulario-grid";
      filaEstado.append(
        construirCampo(
          { nombre: "nuevo_estado", etiqueta: "Cambiar a", tipo: "select", opciones: opcionesEstado },
          cotizacion.estado
        )
      );
      const botonEstado = boton("Actualizar estado", async () => {
        mensajeEstado.replaceChildren();
        const nuevoEstado = document.getElementById("nuevo_estado").value;
        const r = await api("PATCH", `/cotizaciones/${id}/estado`, { estado: nuevoEstado });
        if (r.status === 200) {
          vistaCotizacionForm(id);
          return;
        }
        mensajeEstado.append(alerta("error", r.cuerpo?.error || "No se pudo cambiar el estado."));
      });
      bloqueEstado.append(filaEstado, botonEstado, mensajeEstado);
    } else {
      bloqueEstado.append(notaSinPermisoEstado("La decisión sobre esta cotización la toma el Gerente Comercial o el Gerente General."));
    }

    tarjeta.append(bloqueEstado);
    tarjeta.append(await renderPanelVersiones("cotizaciones", id));
  }
}
