/* global
   alerta, api, boton, botonCancelar, celda, confirmarCreacion, construirCampo, contenido,
   encabezado, estadoPill, formatearCop, marcarMenu, montarListado, mostrarCargando,
   mostrarErroresValidacion, pill, preferenciaVista, selectorVista, textoEstadoOrdenCompra,
   tipoPillOrdenCompra */
/* exported vistaProveedorForm, vistaProveedores */
// Proveedores: tarjetas, tabla y formulario.

const CAMPOS_PROVEEDOR = [
  { nombre: "nit_cc", etiqueta: "NIT o CC", requerido: true },
  { nombre: "razon_social", etiqueta: "Razón social", requerido: true },
  { nombre: "tipo_persona", etiqueta: "Tipo de persona", tipo: "select", requerido: true,
    opciones: [{ valor: "natural", texto: "Natural" }, { valor: "juridica", texto: "Jurídica" }] },
  { nombre: "origen", etiqueta: "Origen", tipo: "select", requerido: true,
    opciones: [{ valor: "nacional", texto: "Nacional" }, { valor: "extranjera", texto: "Extranjera" }] },
  { nombre: "clasificacion", etiqueta: "Clasificación", tipo: "select", requerido: true,
    opciones: [
      { valor: "productos", texto: "Productos" },
      { valor: "servicios", texto: "Servicios" },
      { valor: "ambos", texto: "Ambos" },
    ] },
  { nombre: "contacto_comercial_nombre", etiqueta: "Contacto comercial" },
  { nombre: "contacto_comercial_telefono", etiqueta: "Teléfono comercial" },
  { nombre: "contacto_comercial_email", etiqueta: "Correo comercial", tipo: "email" },
  { nombre: "contacto_pagos_nombre", etiqueta: "Contacto de pagos" },
  { nombre: "contacto_pagos_telefono", etiqueta: "Teléfono de pagos" },
  { nombre: "contacto_pagos_email", etiqueta: "Correo de pagos", tipo: "email" },
  { nombre: "contacto_tecnico_nombre", etiqueta: "Contacto técnico" },
  { nombre: "contacto_tecnico_telefono", etiqueta: "Teléfono técnico" },
  { nombre: "contacto_tecnico_email", etiqueta: "Correo técnico", tipo: "email" },
];

function textoClasificacionProveedor(valor) {
  const encontrado = CAMPOS_PROVEEDOR.find((c) => c.nombre === "clasificacion");
  const opcion = encontrado.opciones.find((o) => o.valor === valor);
  return opcion ? opcion.texto : valor;
}

function tipoPillOrigenProveedor(valor) {
  return valor === "nacional" ? "good" : "info";
}

function tipoPillClasificacionProveedor(valor) {
  if (valor === "ambos") return "good";
  if (valor === "servicios") return "mute";
  return "info";
}

async function vistaProveedores() {
  marcarMenu("proveedores");
  const nuevo = boton("Nuevo proveedor", () => (window.location.hash = "#/proveedores/nuevo"));
  const acciones = document.createElement("div");
  acciones.className = "encabezado-acciones";
  acciones.append(selectorVista("proveedores", vistaProveedores), nuevo);
  contenido.replaceChildren(encabezado("Proveedores", [acciones]));
  await montarListado({
    clave: "proveedores",
    api: "/proveedores",
    campo: "proveedores",
    titulo: "proveedores",
    buscar: "Buscar por razón social o NIT",
    vacio: "Aún no hay proveedores registrados.",
    pintar: preferenciaVista("proveedores") === "tabla" ? tablaProveedores : tarjetasProveedores,
  });
}

// Calificación del proveedor (0–100): aprobado desde 80.
const UMBRAL_CALIFICACION_PROVEEDOR = 80;

// Proveedores como tarjetas: calificación frente al umbral, contacto
// comercial y su historial de órdenes de compra.
function tarjetasProveedores(proveedores) {
  const rejilla = document.createElement("div");
  rejilla.className = "prov-tarjetas";
  proveedores.forEach((p) => {
    const tarjeta = document.createElement("article");
    tarjeta.className = "prov-tarjeta";

    const cab = document.createElement("div");
    cab.className = "prov-cab";
    const calificacion = p.calificacion_actual === null ? null : Number(p.calificacion_actual);
    const anillo = document.createElement("div");
    let tonoAnillo = "mute";
    if (calificacion !== null) {
      tonoAnillo = calificacion >= UMBRAL_CALIFICACION_PROVEEDOR ? "good" : "crit";
    }
    anillo.className = `anillo anillo--${tonoAnillo}`;
    anillo.style.setProperty("--p", String(calificacion ?? 0));
    const valorAnillo = document.createElement("span");
    valorAnillo.textContent = calificacion === null ? "—" : String(Math.round(calificacion));
    anillo.append(valorAnillo);
    anillo.title =
      calificacion === null
        ? "Sin calificación"
        : `Calificación ${calificacion} de 100 (aprobado desde ${UMBRAL_CALIFICACION_PROVEEDOR})`;
    anillo.setAttribute("role", "img");
    anillo.setAttribute("aria-label", anillo.title);

    const textos = document.createElement("div");
    const nombre = document.createElement("h3");
    nombre.className = "prov-nombre";
    nombre.textContent = p.razon_social;
    const nit = document.createElement("div");
    nit.className = "muted";
    nit.textContent = `NIT/CC ${p.nit_cc}`;
    const etiquetas = document.createElement("div");
    etiquetas.className = "prov-etiquetas";
    etiquetas.append(
      pill(p.origen === "nacional" ? "Nacional" : "Extranjera", tipoPillOrigenProveedor(p.origen)),
      pill(textoClasificacionProveedor(p.clasificacion), tipoPillClasificacionProveedor(p.clasificacion))
    );
    if (calificacion === null) etiquetas.append(pill("Sin calificación", "mute"));
    else if (calificacion < UMBRAL_CALIFICACION_PROVEEDOR) etiquetas.append(pill("Bajo el umbral", "crit"));
    textos.append(nombre, nit, etiquetas);
    cab.append(anillo, textos);

    const datos = document.createElement("dl");
    datos.className = "prov-datos";
    const dato = (titulo, ...valores) => {
      const dt = document.createElement("dt");
      dt.textContent = titulo;
      const dd = document.createElement("dd");
      dd.append(...valores);
      datos.append(dt, dd);
    };
    const contacto = [p.contacto_comercial_nombre, p.contacto_comercial_telefono]
      .filter(Boolean)
      .join(" · ");
    dato("Contacto comercial", contacto || "Sin registrar");
    if (p.contacto_comercial_email) {
      const correo = document.createElement("a");
      correo.href = `mailto:${p.contacto_comercial_email}`;
      correo.textContent = p.contacto_comercial_email;
      dato("Correo", correo);
    }
    const totalOc = Number(p.oc_total) || 0;
    dato(
      "Órdenes de compra",
      totalOc ? `${totalOc} · ${formatearCop(p.oc_valor)}` : "Ninguna todavía"
    );
    if (p.ultima_oc_id) {
      const enlace = document.createElement("a");
      enlace.href = `#/ordenes-compra/${p.ultima_oc_id}`;
      enlace.textContent = p.ultima_oc_numero || `OC ${p.ultima_oc_id}`;
      const espacio = document.createTextNode(" ");
      dato(
        "Última OC",
        enlace,
        espacio,
        pill(textoEstadoOrdenCompra(p.ultima_oc_estado), tipoPillOrdenCompra(p.ultima_oc_estado))
      );
    }

    const pie = document.createElement("div");
    pie.className = "prov-pie";
    const editar = boton("Ver y editar", () => (window.location.hash = `#/proveedores/${p.id}`), true);
    editar.setAttribute("aria-label", `Ver y editar ${p.razon_social}`);
    const nuevaOc = boton(
      "Nueva OC",
      () => (window.location.hash = `#/ordenes-compra/nuevo?proveedor=${p.id}`),
      true
    );
    nuevaOc.setAttribute("aria-label", `Nueva orden de compra para ${p.razon_social}`);
    pie.append(editar, nuevaOc);

    tarjeta.append(cab, datos, pie);
    rejilla.append(tarjeta);
  });
  return rejilla;
}

function tablaProveedores(proveedores) {
  const tarjeta = document.createElement("div");
  tarjeta.className = "tarjeta-ancha";
  const tabla = document.createElement("table");
  const thead = document.createElement("thead");
  const filaCabecera = document.createElement("tr");
  ["Razón social", "NIT/CC", "Origen", "Clasificación", ""].forEach((texto) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = texto;
    filaCabecera.append(th);
  });
  thead.append(filaCabecera);

  const tbody = document.createElement("tbody");
  proveedores.forEach((p) => {
    const fila = document.createElement("tr");
    fila.append(celda(p.razon_social));
    fila.append(celda(p.nit_cc));
    fila.append(celda(estadoPill(p.origen === "nacional" ? "Nacional" : "Extranjera", tipoPillOrigenProveedor(p.origen))));
    fila.append(
      celda(estadoPill(textoClasificacionProveedor(p.clasificacion), tipoPillClasificacionProveedor(p.clasificacion)))
    );
    const accion = document.createElement("td");
    const editar = boton(
      "Editar",
      () => (window.location.hash = `#/proveedores/${p.id}`),
      true
    );
    editar.setAttribute("aria-label", `Editar ${p.razon_social}`);
    accion.append(editar);
    fila.append(accion);
    tbody.append(fila);
  });

  tabla.append(thead, tbody);
  tarjeta.append(tabla);
  return tarjeta;
}

async function vistaProveedorForm(id) {
  marcarMenu("proveedores");
  mostrarCargando();
  let proveedor = null;
  if (id) {
    const r = await api("GET", `/proveedores/${id}`);
    if (r.status !== 200) {
      contenido.replaceChildren(encabezado("Proveedor"), alerta("error", "No se encontró el proveedor."));
      return;
    }
    proveedor = r.cuerpo.proveedor;
  }

  contenido.replaceChildren();
  const volver = boton("Volver a proveedores", () => (window.location.hash = "#/proveedores"), true);
  contenido.append(encabezado(id ? "Editar proveedor" : "Nuevo proveedor", [volver]));

  const tarjeta = document.createElement("div");
  tarjeta.className = "tarjeta-ancha";
  const mensaje = document.createElement("div");
  const form = document.createElement("form");
  form.noValidate = true;
  const grid = document.createElement("div");
  grid.className = "formulario-grid";

  CAMPOS_PROVEEDOR.forEach((config) => {
    grid.append(construirCampo(config, proveedor ? proveedor[config.nombre] : ""));
  });

  const guardar = document.createElement("button");
  guardar.type = "submit";
  guardar.className = "boton boton-pequeno";
  guardar.textContent = id ? "Guardar cambios" : "Crear proveedor";

  form.append(grid, guardar);
  if (!id) form.append(botonCancelar("#/proveedores"));
  tarjeta.append(mensaje, form);
  contenido.append(tarjeta);

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    mensaje.replaceChildren();
    const datos = {};
    CAMPOS_PROVEEDOR.forEach((config) => {
      const valor = form.elements[config.nombre].value.trim();
      if (valor !== "") datos[config.nombre] = valor;
    });
    const faltantes = CAMPOS_PROVEEDOR.filter((c) => c.requerido && !datos[c.nombre]);
    if (faltantes.length > 0) {
      mensaje.append(alerta("error", "Completa los campos obligatorios marcados con *."));
      return;
    }
    if (!id && !confirmarCreacion("este proveedor")) return;

    guardar.disabled = true;
    try {
      const r = id
        ? await api("PUT", `/proveedores/${id}`, datos)
        : await api("POST", "/proveedores", datos);
      if (r.status === 200 || r.status === 201) {
        window.location.hash = "#/proveedores";
        return;
      }
      if (r.status === 400 && Array.isArray(r.cuerpo?.detalles)) {
        const mensajes = mostrarErroresValidacion(form, CAMPOS_PROVEEDOR, r.cuerpo.detalles);
        mensaje.append(alerta("error", mensajes.join(" · ")));
      } else {
        mensaje.append(alerta("error", r.cuerpo?.error || "No se pudo guardar el proveedor."));
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
