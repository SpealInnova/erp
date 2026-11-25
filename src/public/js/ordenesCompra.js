/* global
   alerta, api, bloqueModoVersion, boton, botonCancelar, celda, confirmarCreacion,
   construirCampo, contenido, encabezado, estadoPill, formatearMoneda, guardarDocumento,
   marcarMenu, montarListado, mostrarCargando, mostrarErroresValidacion, notaSinPermisoEstado,
   obtenerProveedores, obtenerRequisiciones, opcionesSegunPermiso, puede,
   puedeAprobarDocumento, renderPanelVersiones, renderSeccionEvidencias */
/* exported vistaOrdenCompraForm, vistaOrdenesCompra */
// Órdenes de compra: lista, formulario e ítems.

const ESTADOS_ORDEN_COMPRA = [
  { valor: "pte_aprobar", texto: "Pendiente de aprobar" },
  { valor: "aprobada_pte_pago", texto: "Aprobada, pendiente de pago" },
  { valor: "paga", texto: "Pagada" },
  { valor: "contabilizada", texto: "Contabilizada" },
];

function textoEstadoOrdenCompra(valor) {
  const encontrado = ESTADOS_ORDEN_COMPRA.find((e) => e.valor === valor);
  return encontrado ? encontrado.texto : valor;
}

function tipoPillOrdenCompra(valor) {
  if (valor === "paga" || valor === "contabilizada") return "good";
  if (valor === "pte_aprobar") return "warn";
  return "info";
}

function calcularTotalItemOC(item) {
  return (Number(item.cantidad) || 0) * (Number(item.precio_unitario) || 0);
}

async function vistaOrdenesCompra() {
  marcarMenu("ordenes-compra");
  const nuevo = boton("Nueva orden de compra", () => (window.location.hash = "#/ordenes-compra/nuevo"));
  contenido.replaceChildren(encabezado("Órdenes de compra", [nuevo]));
  await montarListado({
    clave: "ordenes-compra",
    api: "/ordenes-compra",
    campo: "ordenes",
    titulo: "órdenes de compra",
    buscar: "Buscar por número, proveedor, requisición o proyecto",
    estados: ESTADOS_ORDEN_COMPRA,
    vacio: "Aún no hay órdenes de compra registradas.",
    pintar: tablaOrdenesCompra,
  });
}

function tablaOrdenesCompra(ordenes) {
  const tarjeta = document.createElement("div");
  tarjeta.className = "tarjeta-ancha";
  const tabla = document.createElement("table");
  const thead = document.createElement("thead");
  const filaCabecera = document.createElement("tr");
  ["Número", "Proveedor", "Proyecto", "Estado", ""].forEach((texto) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = texto;
    filaCabecera.append(th);
  });
  thead.append(filaCabecera);

  const tbody = document.createElement("tbody");
  ordenes.forEach((o) => {
    const fila = document.createElement("tr");
    [
      o.numero_oc,
      o.proveedor_nombre || "—",
      o.proyecto_codigo || "—",
      estadoPill(textoEstadoOrdenCompra(o.estado), tipoPillOrdenCompra(o.estado)),
    ].forEach((valor) => {
      fila.append(celda(valor));
    });
    const accion = document.createElement("td");
    const editar = boton(
      "Ver / Editar",
      () => (window.location.hash = `#/ordenes-compra/${o.id}`),
      true
    );
    editar.setAttribute("aria-label", `Ver orden de compra ${o.numero_oc}`);
    accion.append(editar);
    fila.append(accion);
    tbody.append(fila);
  });

  tabla.append(thead, tbody);
  tarjeta.append(tabla);
  return tarjeta;
}

// opciones.modoVersion: corrige la OC como nueva versión, en cualquier estado.
async function vistaOrdenCompraForm(id, opciones = {}) {
  const modoVersion = Boolean(id && opciones.modoVersion);
  marcarMenu("ordenes-compra");
  mostrarCargando();

  const [proveedores, requisiciones] = await Promise.all([obtenerProveedores(), obtenerRequisiciones()]);
  let orden = null;
  if (id) {
    const r = await api("GET", `/ordenes-compra/${id}`);
    if (r.status !== 200) {
      contenido.replaceChildren(encabezado("Orden de compra"), alerta("error", "No se encontró la orden de compra."));
      return;
    }
    orden = r.cuerpo.orden;
  } else if (proveedores.length === 0 || requisiciones.length === 0) {
    contenido.replaceChildren(
      encabezado("Nueva orden de compra"),
      alerta("error", "Primero crea al menos un proveedor y una requisición.")
    );
    return;
  }

  const editable = modoVersion || !id || orden.estado === "pte_aprobar";
  const opcionesProveedores = proveedores.map((p) => ({ valor: String(p.id), texto: p.razon_social }));
  const opcionesRequisiciones = requisiciones.map((r) => ({ valor: String(r.id), texto: r.numero_requisicion }));

  contenido.replaceChildren();
  const volver = modoVersion
    ? boton("Cancelar nueva versión", () => (window.location.hash = `#/ordenes-compra/${id}`), true)
    : boton("Volver a órdenes de compra", () => (window.location.hash = "#/ordenes-compra"), true);
  contenido.append(
    encabezado(
      id
        ? `${modoVersion ? "Nueva versión de la orden de compra" : "Orden de compra"} ${orden.numero_oc}${orden.version > 1 ? ` · v${orden.version}` : ""}`
        : "Nueva orden de compra",
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
        { nombre: "requisicion", etiqueta: "Requisición", tipo: "estatico" },
        editable
          ? { nombre: "proveedor_id", etiqueta: "Proveedor", tipo: "select", requerido: true, opciones: opcionesProveedores }
          : { nombre: "proveedor", etiqueta: "Proveedor", tipo: "estatico" },
      ]
    : [
        { nombre: "requisicion_id", etiqueta: "Requisición", tipo: "select", requerido: true, opciones: opcionesRequisiciones },
        { nombre: "proveedor_id", etiqueta: "Proveedor", tipo: "select", requerido: true, opciones: opcionesProveedores },
      ];

  camposCabecera.forEach((config) => {
    let valor = "";
    if (orden) {
      if (config.nombre === "requisicion") {
        valor = requisiciones.find((r) => r.id === orden.requisicion_id)?.numero_requisicion || "—";
      } else if (config.nombre === "proveedor") {
        valor = proveedores.find((p) => p.id === orden.proveedor_id)?.razon_social || "—";
      } else if (config.nombre === "proveedor_id") {
        valor = String(orden.proveedor_id);
      }
    }
    grid.append(construirCampo(config, valor));
  });

  if (!editable) {
    const aviso = document.createElement("p");
    aviso.className = "subtitulo";
    aviso.textContent = "Solo se puede editar una orden de compra en estado pendiente de aprobar.";
    grid.append(aviso);
  }

  const subtituloItems = document.createElement("h3");
  subtituloItems.textContent = "Ítems";
  subtituloItems.style.marginTop = "24px";

  const tablaItems = document.createElement("table");
  tablaItems.className = "tabla-items";
  const theadItems = document.createElement("thead");
  const filaCabeceraItems = document.createElement("tr");
  ["Descripción", "Cantidad", "Precio unitario", "Total", ""].forEach((texto) => {
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

  const items = orden
    ? orden.items.map((i) => ({ ...i }))
    : [{ descripcion: "", cantidad: "1", precio_unitario: "0" }];

  function recalcularTotalGeneral() {
    const total = items.reduce((acc, item) => acc + calcularTotalItemOC(item), 0);
    totalGeneral.textContent = `Total: $${formatearMoneda(total)}`;
  }

  function construirFilaItemOC(item, onEliminar) {
    const fila = document.createElement("tr");

    function celda(nombre, tipo, requerida) {
      const td = document.createElement("td");
      if (!editable) {
        td.textContent = item[nombre] ?? "";
        return td;
      }
      const input = document.createElement("input");
      input.type = tipo;
      input.name = nombre;
      input.setAttribute(
        "aria-label",
        { descripcion: "Descripción", cantidad: "Cantidad", precio_unitario: "Precio unitario" }[nombre]
      );
      input.value = item[nombre] ?? "";
      if (tipo === "number") {
        input.step = "0.01";
        input.min = "0";
      }
      input.required = requerida;
      input.addEventListener("input", () => {
        item[nombre] = input.value;
        fila._actualizarTotal();
        recalcularTotalGeneral();
      });
      td.append(input);
      return td;
    }

    fila.append(
      celda("descripcion", "text", true),
      celda("cantidad", "number", true),
      celda("precio_unitario", "number", true)
    );

    const tdTotal = document.createElement("td");
    tdTotal.className = "item-total";
    tdTotal.textContent = formatearMoneda(calcularTotalItemOC(item));
    fila.append(tdTotal);
    fila._actualizarTotal = () => {
      tdTotal.textContent = formatearMoneda(calcularTotalItemOC(item));
    };

    const tdAccion = document.createElement("td");
    if (editable) {
      tdAccion.append(boton("Quitar", onEliminar, true));
    }
    fila.append(tdAccion);

    return fila;
  }

  function redibujarItems() {
    tbodyItems.replaceChildren();
    items.forEach((item, indice) => {
      const fila = construirFilaItemOC(item, () => {
        items.splice(indice, 1);
        if (items.length === 0) {
          items.push({ descripcion: "", cantidad: "1", precio_unitario: "0" });
        }
        redibujarItems();
        recalcularTotalGeneral();
      });
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
      items.push({ descripcion: "", cantidad: "1", precio_unitario: "0" });
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
    ? `Guardar como versión ${(orden.version || 1) + 1}`
    : id
      ? "Guardar cambios"
      : "Crear orden de compra";

  if (modoVersion) {
    form.append(bloqueModoVersion(orden.version || 1));
    if (orden.estado === "aprobada_pte_pago") {
      form.append(
        alerta("aviso", "Esta OC ya está aprobada: si cambias ítems o proveedor, volverá a quedar pendiente de aprobar.")
      );
    }
  }
  form.append(grid, subtituloItems, bloqueItems, totalGeneral);
  if (editable) form.append(guardar);
  if (!id) form.append(botonCancelar("#/ordenes-compra"));
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
        (item) => !item.descripcion || !item.cantidad || Number(item.precio_unitario) < 0
      );
      if (itemsInvalidos) {
        mensaje.append(alerta("error", "Completa descripción, cantidad y precio unitario de cada ítem."));
        return;
      }
      datos.items = items.map((item) => ({
        descripcion: item.descripcion,
        cantidad: Number(item.cantidad),
        precio_unitario: Number(item.precio_unitario),
      }));

      const faltantes = camposCabecera.filter(
        (c) => c.tipo !== "estatico" && c.requerido && !datos[c.nombre]
      );
      if (faltantes.length > 0) {
        mensaje.append(alerta("error", "Completa los campos obligatorios marcados con *."));
        return;
      }
      if (!id && !confirmarCreacion("esta orden de compra")) return;

      guardar.disabled = true;
      try {
        const r = await guardarDocumento("ordenes-compra", { id, modoVersion, datos, form, mensaje });
        if (!r) return;
        if (r.status === 200 || r.status === 201) {
          if (modoVersion) {
            window.location.hash = `#/ordenes-compra/${id}`;
            return;
          }
          window.location.hash = id ? `#/ordenes-compra/${id}` : "#/ordenes-compra";
          if (id) vistaOrdenCompraForm(id);
          return;
        }
        if (r.status === 400 && Array.isArray(r.cuerpo?.detalles)) {
          const mensajes = mostrarErroresValidacion(form, camposCabecera, r.cuerpo.detalles);
          mensaje.append(alerta("error", mensajes.join(" · ")));
        } else {
          mensaje.append(alerta("error", r.cuerpo?.error || "No se pudo guardar la orden de compra."));
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
    subtituloEstado.textContent = `Estado actual: ${textoEstadoOrdenCompra(orden.estado)}`;
    bloqueEstado.append(subtituloEstado);

    // Aprobar exige el permiso y no haber creado la OC; pagar/contabilizar, el suyo.
    const opcionesEstado = opcionesSegunPermiso(ESTADOS_ORDEN_COMPRA, orden.estado, (destino) =>
      destino === "aprobada_pte_pago"
        ? puedeAprobarDocumento("aprobar_oc", orden.created_by)
        : puede("pagar_oc")
    );
    if (opcionesEstado.length > 1) {
      const mensajeEstado = document.createElement("div");
      const filaEstado = document.createElement("div");
      filaEstado.className = "formulario-grid";
      filaEstado.append(
        construirCampo(
          { nombre: "nuevo_estado", etiqueta: "Cambiar a", tipo: "select", opciones: opcionesEstado },
          orden.estado
        )
      );
      const botonEstado = boton("Actualizar estado", async () => {
        mensajeEstado.replaceChildren();
        const nuevoEstado = document.getElementById("nuevo_estado").value;
        const r = await api("PATCH", `/ordenes-compra/${id}/estado`, { estado: nuevoEstado });
        if (r.status === 200) {
          vistaOrdenCompraForm(id);
          return;
        }
        mensajeEstado.append(alerta("error", r.cuerpo?.error || "No se pudo cambiar el estado."));
      });
      bloqueEstado.append(filaEstado, botonEstado, mensajeEstado);
    } else if (orden.estado !== "contabilizada") {
      bloqueEstado.append(
        notaSinPermisoEstado(
          orden.estado === "pte_aprobar"
            ? "La aprueba el Director Administrativo y Financiero o el Gerente General, y no puede ser quien la creó."
            : "El pago y la contabilización los registran Contabilidad o el Director Administrativo y Financiero."
        )
      );
    }

    tarjeta.append(bloqueEstado);
    tarjeta.append(renderSeccionEvidencias("ordenes_compra", id, "Evidencias / soportes"));
    tarjeta.append(await renderPanelVersiones("ordenes-compra", id));
  }
}
