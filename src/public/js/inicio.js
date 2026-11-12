const token = sessionStorage.getItem("erp_token");
const contenido = document.getElementById("contenido");

function cerrarSesion() {
  sessionStorage.removeItem("erp_token");
  sessionStorage.removeItem("erp_usuario");
  window.location.replace("/login");
}

if (!token) {
  window.location.replace("/login");
}

async function api(metodo, ruta, cuerpo) {
  const respuesta = await fetch(ruta, {
    method: metodo,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  if (respuesta.status === 401) {
    cerrarSesion();
    throw new Error("sesion-expirada");
  }
  const texto = respuesta.status === 204 ? null : await respuesta.json().catch(() => null);
  return { status: respuesta.status, cuerpo: texto };
}

function alerta(tipo, mensaje) {
  const div = document.createElement("div");
  div.className = `alerta ${tipo}`;
  div.setAttribute("role", tipo === "error" ? "alert" : "status");
  div.textContent = mensaje;
  return div;
}

function pill(texto, tipo = "mute") {
  const span = document.createElement("span");
  span.className = `pill pill--${tipo}`;
  span.textContent = texto;
  return span;
}

function estadoPill(texto, tipo) {
  return { pill: texto, tipo };
}

function celda(valor) {
  const td = document.createElement("td");
  if (valor && typeof valor === "object" && "pill" in valor) {
    td.append(pill(valor.pill, valor.tipo));
  } else {
    td.textContent = valor;
  }
  return td;
}

function formatoEjemploCampo(config) {
  if (!config) return null;
  if (config.tipo === "email") return "ejemplo: nombre@dominio.com";
  if (config.tipo === "date") return "selecciona una fecha del calendario";
  if (config.tipo === "select" && config.opciones) {
    const opciones = normalizarOpciones(config.opciones).map((o) => o.texto);
    return `opciones válidas: ${opciones.join(", ")}`;
  }
  return null;
}

function traducirDetalleIssue(issue, config) {
  if (config && config.tipo === "email") {
    return "el formato de correo no es válido";
  }
  if (issue.code === "too_small" && issue.type === "string") {
    return "es obligatorio";
  }
  if (issue.code === "too_small") {
    return `debe ser mayor o igual a ${issue.minimum}`;
  }
  if (issue.code === "too_big") {
    return `debe ser menor o igual a ${issue.maximum}`;
  }
  if (issue.code === "invalid_type") {
    return "falta este dato o tiene un formato incorrecto";
  }
  if (issue.code === "invalid_enum_value" || issue.code === "invalid_value") {
    return "el valor elegido no es una opción válida";
  }
  return issue.message;
}

function mostrarErroresValidacion(form, campos, detalles) {
  form.querySelectorAll(".campo-error").forEach((el) => el.classList.remove("campo-error"));
  const mensajes = [];
  (detalles || []).forEach((issue) => {
    let nombreCampo = issue.path[0];
    let prefijo = "";
    if (nombreCampo === "items" && issue.path.length >= 3) {
      prefijo = `Ítem ${Number(issue.path[1]) + 1} — `;
      nombreCampo = issue.path[2];
    }
    const config = campos.find((c) => c.nombre === nombreCampo);
    const input = prefijo ? null : form.elements[nombreCampo];
    if (input) {
      const contenedor = input.closest(".campo");
      if (contenedor) contenedor.classList.add("campo-error");
    }
    const etiqueta = prefijo + (config ? config.etiqueta : nombreCampo);
    const ejemplo = formatoEjemploCampo(config);
    const detalle = traducirDetalleIssue(issue, config);
    mensajes.push(`${etiqueta}: ${detalle}${ejemplo ? " (" + ejemplo + ")" : ""}`);
  });
  return mensajes;
}

function encabezado(titulo, botones = []) {
  const bloque = document.createElement("div");
  bloque.className = "encabezado";
  const h = document.createElement("h2");
  h.textContent = titulo;
  bloque.append(h, ...botones);
  return bloque;
}

function boton(texto, onClick, secundario = false) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = secundario ? "boton boton-secundario boton-pequeno" : "boton boton-pequeno";
  b.textContent = texto;
  b.addEventListener("click", onClick);
  return b;
}

function botonCancelar(rutaVolver) {
  return boton("Cancelar", () => (window.location.hash = rutaVolver), true);
}

function confirmarCreacion(nombreObjeto) {
  return window.confirm(`¿Confirmas crear ${nombreObjeto}?`);
}

function mostrarCargando() {
  contenido.replaceChildren();
  const p = document.createElement("p");
  p.className = "subtitulo";
  p.textContent = "Cargando…";
  contenido.append(p);
}

// El menú lateral muestra módulos; los módulos con varias entidades las
// recorren con pestañas horizontales sobre el contenido. Cada vista sigue
// llamando a marcarMenu() con su propia sección (p. ej. "clientes").
const SECCIONES_POR_MODULO = {
  comercial: [
    { seccion: "cotizaciones", texto: "Cotizaciones", ruta: "#/cotizaciones" },
    { seccion: "clientes", texto: "Clientes", ruta: "#/clientes" },
  ],
  compras: [
    { seccion: "requisiciones", texto: "Requisiciones", ruta: "#/requisiciones" },
    { seccion: "ordenes-compra", texto: "Órdenes de compra", ruta: "#/ordenes-compra" },
    { seccion: "proveedores", texto: "Proveedores", ruta: "#/proveedores" },
  ],
  entregas: [
    { seccion: "actas-entrega", texto: "Actas de entrega", ruta: "#/actas-entrega" },
    { seccion: "actas-cierre", texto: "Actas de cierre", ruta: "#/actas-cierre" },
  ],
};

const MODULO_DE_SECCION = {
  "expedientes-diseno": "diseno",
  "reportes-servicio": "soporte",
};
Object.entries(SECCIONES_POR_MODULO).forEach(([modulo, secciones]) => {
  secciones.forEach((s) => (MODULO_DE_SECCION[s.seccion] = modulo));
});

function pintarPestanasModulo(modulo, seccionActual) {
  const nav = document.getElementById("subtabs");
  if (!nav) return;
  const secciones = SECCIONES_POR_MODULO[modulo];
  if (!secciones) {
    nav.hidden = true;
    nav.replaceChildren();
    return;
  }
  nav.replaceChildren(
    ...secciones.map((s) => {
      const a = document.createElement("a");
      a.href = s.ruta;
      a.textContent = s.texto;
      if (s.seccion === seccionActual) a.setAttribute("aria-current", "page");
      return a;
    })
  );
  nav.hidden = false;
}

function marcarMenu(seccion) {
  const modulo = MODULO_DE_SECCION[seccion] || seccion;
  const crumb = document.getElementById("crumb-modulo");
  document.querySelectorAll(".menu a[data-modulo]").forEach((a) => {
    if (a.dataset.modulo === modulo) {
      a.setAttribute("aria-current", "page");
      if (crumb) crumb.textContent = a.querySelector(".lbl")?.textContent || modulo;
    } else {
      a.removeAttribute("aria-current");
    }
  });
  pintarPestanasModulo(modulo, seccion);
}

function inicializarTopbar() {
  const nombre = sessionStorage.getItem("erp_usuario");
  if (!nombre) return;
  const iniciales = nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0].toUpperCase())
    .join("");
  const avatar = document.getElementById("topbar-avatar");
  const nombreEl = document.getElementById("topbar-nombre");
  if (avatar) avatar.textContent = iniciales || "--";
  if (nombreEl) nombreEl.textContent = nombre;
}
inicializarTopbar();

const INTERVALO_NOTIFICACIONES_MS = 45000;

function inicializarNotificaciones() {
  const boton = document.getElementById("btn-notificaciones");
  const contador = document.getElementById("campana-contador");
  const panel = document.getElementById("panel-notificaciones");
  if (!boton || !panel) return;

  function pintarContador(noLeidas) {
    if (noLeidas > 0) {
      contador.hidden = false;
      contador.textContent = noLeidas > 99 ? "99+" : String(noLeidas);
    } else {
      contador.hidden = true;
    }
  }

  async function actualizarContador() {
    try {
      const r = await api("GET", "/notificaciones");
      if (r.status === 200) pintarContador(r.cuerpo.no_leidas);
    } catch {
      // silencioso: no interrumpe la navegación por un fallo de red puntual
    }
  }

  function renderPanel(notificaciones) {
    panel.replaceChildren();

    if (notificaciones.length === 0) {
      const vacio = document.createElement("p");
      vacio.className = "notificacion-vacio";
      vacio.textContent = "No tienes notificaciones.";
      panel.append(vacio);
      return;
    }

    const marcarTodas = document.createElement("button");
    marcarTodas.type = "button";
    marcarTodas.className = "boton boton-pequeno boton-secundario";
    marcarTodas.style.margin = "0 0 8px";
    marcarTodas.textContent = "Marcar todas como leídas";
    marcarTodas.addEventListener("click", async () => {
      await api("PATCH", "/notificaciones/leer-todas");
      await cargarYRenderizar();
    });
    panel.append(marcarTodas);

    notificaciones.forEach((notificacion) => {
      const item = document.createElement("a");
      item.className = notificacion.leida_en ? "notificacion-item" : "notificacion-item no-leida";
      item.href = notificacion.enlace || "#";

      const mensaje = document.createElement("span");
      mensaje.className = "notificacion-mensaje";
      mensaje.textContent = notificacion.mensaje;

      const fecha = document.createElement("span");
      fecha.className = "notificacion-fecha";
      fecha.textContent = formatoFechaHora(notificacion.created_at);

      item.append(mensaje, fecha);
      item.addEventListener("click", async () => {
        if (!notificacion.leida_en) {
          await api("PATCH", `/notificaciones/${notificacion.id}/leida`);
        }
        abrir(false);
      });
      panel.append(item);
    });
  }

  async function cargarYRenderizar() {
    const r = await api("GET", "/notificaciones");
    if (r.status !== 200) return;
    pintarContador(r.cuerpo.no_leidas);
    renderPanel(r.cuerpo.notificaciones);
  }

  function abrir(abierto) {
    panel.classList.toggle("oculto", !abierto);
    boton.setAttribute("aria-expanded", String(abierto));
    if (abierto) cargarYRenderizar();
  }

  boton.addEventListener("click", () => abrir(panel.classList.contains("oculto")));

  document.addEventListener("click", (evento) => {
    if (!panel.classList.contains("oculto") && !panel.contains(evento.target) && evento.target !== boton) {
      abrir(false);
    }
  });

  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape" && !panel.classList.contains("oculto")) {
      abrir(false);
      boton.focus();
    }
  });

  actualizarContador();
  setInterval(actualizarContador, INTERVALO_NOTIFICACIONES_MS);
}
inicializarNotificaciones();

async function vistaClientes() {
  marcarMenu("clientes");
  mostrarCargando();
  const { status, cuerpo } = await api("GET", "/clientes");
  contenido.replaceChildren();

  if (status !== 200) {
    contenido.append(encabezado("Clientes"), alerta("error", "No se pudieron cargar los clientes."));
    return;
  }

  const nuevo = boton("Nuevo cliente", () => (window.location.hash = "#/clientes/nuevo"));
  contenido.append(encabezado("Clientes", [nuevo]));

  const clientes = cuerpo.clientes;
  if (clientes.length === 0) {
    const p = document.createElement("p");
    p.className = "subtitulo";
    p.textContent = "Aún no hay clientes registrados.";
    contenido.append(p);
    return;
  }

  const tarjeta = document.createElement("div");
  tarjeta.className = "tarjeta-ancha";
  const tabla = document.createElement("table");
  const thead = document.createElement("thead");
  const filaCabecera = document.createElement("tr");
  ["Nombre", "Tipo", "Número", "Ciudad", ""].forEach((texto) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = texto;
    filaCabecera.append(th);
  });
  thead.append(filaCabecera);

  const tbody = document.createElement("tbody");
  clientes.forEach((c) => {
    const fila = document.createElement("tr");
    [c.nombre_razon_social, c.tipo_identificacion, c.numero_identificacion, c.ciudad || "—"].forEach(
      (valor) => {
        fila.append(celda(valor));
      }
    );
    const accion = document.createElement("td");
    const editar = boton(
      "Editar",
      () => (window.location.hash = `#/clientes/${c.id}`),
      true
    );
    editar.setAttribute("aria-label", `Editar ${c.nombre_razon_social}`);
    accion.append(editar);
    fila.append(accion);
    tbody.append(fila);
  });

  tabla.append(thead, tbody);
  tarjeta.append(tabla);
  contenido.append(tarjeta);
}

const CAMPOS_CLIENTE = [
  { nombre: "nombre_razon_social", etiqueta: "Nombre o razón social", requerido: true },
  { nombre: "tipo_identificacion", etiqueta: "Tipo de identificación", tipo: "select", requerido: true,
    opciones: ["NIT", "CC", "CE", "Pasaporte"] },
  { nombre: "numero_identificacion", etiqueta: "Número de identificación", requerido: true },
  { nombre: "pais", etiqueta: "País" },
  { nombre: "ciudad", etiqueta: "Ciudad" },
  { nombre: "direccion", etiqueta: "Dirección" },
  { nombre: "contacto_nombre", etiqueta: "Nombre de contacto" },
  { nombre: "contacto_telefono", etiqueta: "Teléfono de contacto" },
  { nombre: "contacto_email", etiqueta: "Correo de contacto", tipo: "email" },
];

function normalizarOpciones(opciones) {
  return opciones.map((op) =>
    typeof op === "string" ? { valor: op, texto: op } : op
  );
}

function construirCampo(config, valor) {
  const div = document.createElement("div");
  div.className = "campo";
  const label = document.createElement("label");
  label.htmlFor = config.nombre;
  label.textContent = config.etiqueta + (config.requerido ? " *" : "");

  if (config.tipo === "estatico") {
    const p = document.createElement("p");
    p.id = config.nombre;
    p.className = "subtitulo";
    p.style.margin = "0";
    p.textContent = valor || "—";
    div.append(label, p);
    return div;
  }

  let input;
  if (config.tipo === "select") {
    input = document.createElement("select");
    normalizarOpciones(config.opciones).forEach((op) => {
      const o = document.createElement("option");
      o.value = op.valor;
      o.textContent = op.texto;
      input.append(o);
    });
    input.value = valor || normalizarOpciones(config.opciones)[0].valor;
  } else {
    input = document.createElement("input");
    input.type = config.tipo || "text";
    input.value = valor || "";
  }
  input.id = config.nombre;
  input.name = config.nombre;
  if (config.requerido) input.required = true;
  div.append(label, input);
  return div;
}

async function obtenerClientes() {
  const r = await api("GET", "/clientes");
  return r.status === 200 ? r.cuerpo.clientes : [];
}

async function obtenerUsuarios() {
  const r = await api("GET", "/usuarios");
  return r.status === 200 ? r.cuerpo.usuarios : [];
}

async function obtenerProyectos() {
  const r = await api("GET", "/proyectos");
  return r.status === 200 ? r.cuerpo.proyectos : [];
}

async function obtenerCotizaciones() {
  const r = await api("GET", "/cotizaciones");
  return r.status === 200 ? r.cuerpo.cotizaciones : [];
}

async function obtenerProveedores() {
  const r = await api("GET", "/proveedores");
  return r.status === 200 ? r.cuerpo.proveedores : [];
}

async function obtenerRequisiciones() {
  const r = await api("GET", "/requisiciones");
  return r.status === 200 ? r.cuerpo.requisiciones : [];
}

async function vistaClienteForm(id) {
  marcarMenu("clientes");
  mostrarCargando();
  let cliente = null;
  if (id) {
    const r = await api("GET", `/clientes/${id}`);
    if (r.status !== 200) {
      contenido.replaceChildren(encabezado("Cliente"), alerta("error", "No se encontró el cliente."));
      return;
    }
    cliente = r.cuerpo.cliente;
  }

  contenido.replaceChildren();
  const volver = boton("Volver a clientes", () => (window.location.hash = "#/clientes"), true);
  contenido.append(encabezado(id ? "Editar cliente" : "Nuevo cliente", [volver]));

  const tarjeta = document.createElement("div");
  tarjeta.className = "tarjeta-ancha";
  const mensaje = document.createElement("div");
  const form = document.createElement("form");
  form.noValidate = true;
  const grid = document.createElement("div");
  grid.className = "formulario-grid";

  CAMPOS_CLIENTE.forEach((config) => {
    grid.append(construirCampo(config, cliente ? cliente[config.nombre] : ""));
  });

  const guardar = document.createElement("button");
  guardar.type = "submit";
  guardar.className = "boton boton-pequeno";
  guardar.textContent = id ? "Guardar cambios" : "Crear cliente";

  form.append(grid, guardar);
  if (!id) form.append(botonCancelar("#/clientes"));
  tarjeta.append(mensaje, form);
  contenido.append(tarjeta);

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    mensaje.replaceChildren();
    const datos = {};
    CAMPOS_CLIENTE.forEach((config) => {
      const valor = form.elements[config.nombre].value.trim();
      if (valor !== "") datos[config.nombre] = valor;
    });
    const faltantes = CAMPOS_CLIENTE.filter((c) => c.requerido && !datos[c.nombre]);
    if (faltantes.length > 0) {
      mensaje.append(alerta("error", "Completa los campos obligatorios marcados con *."));
      return;
    }
    if (!id && !confirmarCreacion("este cliente")) return;

    guardar.disabled = true;
    try {
      const r = id
        ? await api("PUT", `/clientes/${id}`, datos)
        : await api("POST", "/clientes", datos);
      if (r.status === 200 || r.status === 201) {
        window.location.hash = "#/clientes";
        return;
      }
      if (r.status === 409) {
        mensaje.append(alerta("error", "Ya existe un cliente con ese número de identificación."));
      } else if (r.status === 400 && Array.isArray(r.cuerpo?.detalles)) {
        const mensajes = mostrarErroresValidacion(form, CAMPOS_CLIENTE, r.cuerpo.detalles);
        mensaje.append(alerta("error", mensajes.join(" · ")));
      } else if (r.status === 400) {
        mensaje.append(alerta("error", "Revisa los datos ingresados."));
      } else {
        mensaje.append(alerta("error", "No se pudo guardar el cliente."));
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

const ESTADOS_PROYECTO = [
  { valor: "prospecto", texto: "Prospecto" },
  { valor: "planeacion", texto: "Planeación" },
  { valor: "diseno", texto: "Diseño" },
  { valor: "compras", texto: "Compras" },
  { valor: "produccion", texto: "Producción" },
  { valor: "calidad_fat", texto: "Calidad / FAT" },
  { valor: "logistica", texto: "Logística" },
  { valor: "instalacion", texto: "Instalación" },
  { valor: "sat", texto: "SAT" },
  { valor: "seguimiento", texto: "Seguimiento" },
  { valor: "cerrado", texto: "Cerrado" },
  { valor: "cancelado", texto: "Cancelado" },
];

function textoEstadoProyecto(valor) {
  const encontrado = ESTADOS_PROYECTO.find((e) => e.valor === valor);
  return encontrado ? encontrado.texto : valor;
}

function tipoPillProyecto(valor) {
  if (valor === "cerrado") return "good";
  if (valor === "cancelado") return "crit";
  return "info";
}

const ETAPAS_PROYECTO_LINEAL = ESTADOS_PROYECTO.filter((e) => e.valor !== "cancelado");

function construirStageTrack(estadoActual) {
  const track = document.createElement("div");
  track.className = "stage-track";

  if (estadoActual === "cancelado") {
    track.append(pill("Proyecto cancelado", "crit"));
    return track;
  }

  const indiceActual = ETAPAS_PROYECTO_LINEAL.findIndex((e) => e.valor === estadoActual);

  ETAPAS_PROYECTO_LINEAL.forEach((etapa, indice) => {
    const stage = document.createElement("div");
    const clase = indice < indiceActual ? "hecha" : indice === indiceActual ? "actual" : "";
    stage.className = clase ? `stage ${clase}` : "stage";

    const linea = document.createElement("span");
    linea.className = "stage-linea";

    const punto = document.createElement("span");
    punto.className = "stage-punto";
    punto.textContent = indice < indiceActual ? "✓" : String(indice + 1);

    const nombre = document.createElement("span");
    nombre.className = "stage-nombre";
    nombre.textContent = etapa.texto;

    stage.append(linea, punto, nombre);
    track.append(stage);
  });

  return track;
}

function renderSeccionPresupuestoProyecto(proyecto) {
  const tarjeta = document.createElement("div");
  tarjeta.className = "tarjeta-ancha";
  tarjeta.style.marginTop = "24px";

  const h3 = document.createElement("h3");
  h3.style.margin = "0 0 16px";
  h3.style.fontSize = "1.125rem";
  h3.textContent = "Presupuesto";
  tarjeta.append(h3);

  const presupuesto =
    proyecto.presupuesto_estimado === null || proyecto.presupuesto_estimado === undefined
      ? null
      : Number(proyecto.presupuesto_estimado);
  const gastoReal = Number(proyecto.gasto_real || 0);

  const fila = document.createElement("div");
  fila.style.display = "flex";
  fila.style.gap = "24px";
  fila.style.flexWrap = "wrap";

  function dato(etiqueta, valor, pillTipo) {
    const bloque = document.createElement("div");
    const p = document.createElement("p");
    p.className = "subtitulo";
    p.style.margin = "0 0 4px";
    p.textContent = etiqueta;
    bloque.append(p);
    bloque.append(pillTipo ? pill(valor, pillTipo) : document.createTextNode(valor));
    return bloque;
  }

  fila.append(
    dato("Estimado", presupuesto !== null ? `$${formatearMoneda(presupuesto)}` : "— Sin definir —")
  );
  fila.append(dato("Gastado (vía OC)", `$${formatearMoneda(gastoReal)}`));

  if (presupuesto !== null) {
    const diferencia = presupuesto - gastoReal;
    fila.append(
      dato(
        "Diferencia",
        `${diferencia < 0 ? "-" : ""}$${formatearMoneda(Math.abs(diferencia))}`,
        diferencia < 0 ? "crit" : "good"
      )
    );
  }

  tarjeta.append(fila);
  return tarjeta;
}

async function apiSubirArchivo(ruta, formData) {
  const respuesta = await fetch(ruta, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (respuesta.status === 401) {
    cerrarSesion();
    throw new Error("sesion-expirada");
  }
  const texto = respuesta.status === 204 ? null : await respuesta.json().catch(() => null);
  return { status: respuesta.status, cuerpo: texto };
}

function contenidoEvidencias(tabla, registroId) {
  const contenedor = document.createElement("div");
  const mensaje = document.createElement("div");
  const lista = document.createElement("ul");
  lista.style.listStyle = "none";
  lista.style.margin = "0 0 12px";
  lista.style.padding = "0";
  contenedor.append(mensaje, lista);

  async function cargar() {
    mensaje.replaceChildren();
    lista.replaceChildren();
    const r = await api("GET", `/archivos-adjuntos?tabla=${tabla}&registro_id=${registroId}`);
    if (r.status !== 200) {
      mensaje.append(alerta("error", "No se pudieron cargar las evidencias."));
      return;
    }
    const archivos = r.cuerpo.archivos;
    if (archivos.length === 0) {
      const li = document.createElement("li");
      li.className = "subtitulo";
      li.textContent = "Aún no hay evidencias cargadas.";
      lista.append(li);
      return;
    }
    archivos.forEach((archivo) => {
      const li = document.createElement("li");
      li.style.display = "flex";
      li.style.alignItems = "center";
      li.style.gap = "8px";
      li.style.padding = "4px 0";

      const enlace = document.createElement("a");
      enlace.href = archivo.drive_enlace || "#";
      enlace.target = "_blank";
      enlace.rel = "noopener noreferrer";
      enlace.textContent = archivo.nombre_archivo;
      li.append(enlace);

      li.append(
        boton(
          "Quitar",
          async () => {
            if (!window.confirm(`¿Quitar la evidencia "${archivo.nombre_archivo}"?`)) return;
            const r2 = await api("DELETE", `/archivos-adjuntos/${archivo.id}`);
            if (r2.status === 204) {
              cargar();
              return;
            }
            mensaje.replaceChildren(
              alerta("error", r2.cuerpo?.error || "No se pudo quitar la evidencia.")
            );
          },
          true
        )
      );
      lista.append(li);
    });
  }

  const formSubir = document.createElement("form");
  formSubir.noValidate = true;
  formSubir.style.display = "flex";
  formSubir.style.gap = "8px";
  formSubir.style.alignItems = "center";
  formSubir.style.flexWrap = "wrap";

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/png,image/jpeg,image/webp,image/gif,application/pdf";
  input.setAttribute("aria-label", "Archivo de evidencia");
  formSubir.append(input);

  const subirBtn = document.createElement("button");
  subirBtn.type = "submit";
  subirBtn.className = "boton boton-pequeno";
  subirBtn.textContent = "Subir evidencia";
  formSubir.append(subirBtn);

  formSubir.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    mensaje.replaceChildren();
    const archivo = input.files[0];
    if (!archivo) {
      mensaje.append(alerta("error", "Selecciona un archivo primero."));
      return;
    }
    const formData = new FormData();
    formData.append("tabla", tabla);
    formData.append("registro_id", String(registroId));
    formData.append("archivo", archivo);

    subirBtn.disabled = true;
    try {
      const r = await apiSubirArchivo("/archivos-adjuntos", formData);
      if (r.status !== 201) {
        mensaje.append(alerta("error", r.cuerpo?.error || "No se pudo subir la evidencia."));
        return;
      }
      formSubir.reset();
      cargar();
    } catch (error) {
      if (error.message !== "sesion-expirada") {
        mensaje.append(alerta("error", "No hay conexión con el servidor."));
      }
    } finally {
      subirBtn.disabled = false;
    }
  });

  contenedor.append(formSubir);

  cargar();
  return contenedor;
}

function renderSeccionEvidencias(tabla, registroId, titulo = "Evidencias") {
  const tarjeta = document.createElement("div");
  tarjeta.className = "tarjeta-ancha";
  tarjeta.style.marginTop = "24px";
  const h3 = document.createElement("h3");
  h3.style.margin = "0 0 16px";
  h3.style.fontSize = "1.125rem";
  h3.textContent = titulo;
  tarjeta.append(h3, contenidoEvidencias(tabla, registroId));
  return tarjeta;
}

function formatearFechaISO(fecha) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

const DIAS_SEMANA_ABREV = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MESES_NOMBRE = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function semanaDelMes(fecha) {
  return Math.ceil(fecha.getDate() / 7);
}

function normalizarFechaISO(valor) {
  if (!valor) return valor;
  return formatearFechaISO(new Date(valor));
}

function aplicarEncabezadoPersonalizado(gantt) {
  gantt.get_date_info = function (date, last_date, i) {
    const primeraColumna = i === 0;
    const referencia = last_date || date;
    const cambioMes = primeraColumna || date.getMonth() !== referencia.getMonth();
    const cambioSemana =
      primeraColumna || cambioMes || semanaDelMes(date) !== semanaDelMes(referencia);

    const lower_text = `${DIAS_SEMANA_ABREV[date.getDay()]} ${date.getDate()}`;
    const upper_text = cambioSemana
      ? `Semana ${semanaDelMes(date)}${cambioMes ? ` · ${MESES_NOMBRE[date.getMonth()]}` : ""}`
      : "";

    const ancho = this.options.column_width;
    return {
      upper_text,
      lower_text,
      upper_x: i * ancho + (ancho * 7) / 2,
      upper_y: this.options.header_height - 25,
      lower_x: i * ancho + ancho / 2,
      lower_y: this.options.header_height,
    };
  };
}

function renderizarGantt(contenedor, actividades, proyectoId) {
  contenedor.replaceChildren();
  if (typeof window.Gantt === "undefined" || actividades.length === 0) {
    return;
  }

  const UN_DIA_MS = 24 * 60 * 60 * 1000;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const tareas = actividades.map((actividad, indice) => {
    let inicio = normalizarFechaISO(actividad.fecha_inicio);
    let fin = normalizarFechaISO(actividad.fecha_fin);
    if (!inicio) {
      const base = new Date(hoy);
      base.setDate(base.getDate() + indice);
      inicio = formatearFechaISO(base);
    }
    if (!fin) {
      const base = new Date(`${inicio}T00:00:00`);
      base.setDate(base.getDate() + 1);
      fin = formatearFechaISO(base);
    }
    return {
      id: String(actividad.id),
      name: `${textoEstadoProyecto(actividad.fase)}: ${actividad.descripcion}`,
      start: inicio,
      end: fin,
      progress: actividad.estado === "completada" ? 100 : 0,
    };
  });

  let inicioReal = null;
  let finReal = null;
  tareas.forEach((tarea) => {
    const ini = new Date(`${tarea.start}T00:00:00`);
    const fin = new Date(`${tarea.end}T00:00:00`);
    if (!inicioReal || ini < inicioReal) inicioReal = ini;
    if (!finReal || fin > finReal) finReal = fin;
  });

  const controles = document.createElement("div");
  controles.className = "gantt-controles";
  const lienzo = document.createElement("div");
  contenedor.append(controles, lienzo);

  const gantt = new window.Gantt(lienzo, tareas, {
    view_mode: "Day",
    language: "es",
    on_date_change: async (tarea, inicio, fin) => {
      await api("PUT", `/proyectos/${proyectoId}/actividades/${tarea.id}`, {
        fecha_inicio: formatearFechaISO(inicio),
        fecha_fin: formatearFechaISO(fin),
      });
    },
  });

  aplicarEncabezadoPersonalizado(gantt);

  function redibujarConLimites(nuevoInicio, nuevoFin) {
    gantt.gantt_start = nuevoInicio;
    gantt.gantt_end = nuevoFin;
    gantt.setup_date_values();
    gantt.render();
  }

  // Frappe agrega hasta ±1 mes de relleno automático alrededor de las
  // actividades; lo reemplazamos por el mes en curso (nunca antes de hoy),
  // extendiéndolo si ya hay actividades reales más allá de fin de mes.
  const margen = 2;
  const finDeMesActual = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
  finDeMesActual.setHours(0, 0, 0, 0);
  const finConMargen = new Date(finReal.getTime() + (margen + 1) * UN_DIA_MS);
  redibujarConLimites(
    new Date(Math.max(hoy.getTime(), inicioReal.getTime() - margen * UN_DIA_MS)),
    finConMargen > finDeMesActual ? finConMargen : finDeMesActual
  );

  function ajustarRango(dias) {
    if (dias < 0) {
      const propuesto = new Date(gantt.gantt_start.getTime() + dias * UN_DIA_MS);
      redibujarConLimites(propuesto < hoy ? new Date(hoy) : propuesto, gantt.gantt_end);
    } else {
      redibujarConLimites(gantt.gantt_start, new Date(gantt.gantt_end.getTime() + dias * UN_DIA_MS));
    }
  }

  controles.append(
    boton("+ Días atrás", () => ajustarRango(-7), true),
    boton("+ Días adelante", () => ajustarRango(7), true)
  );
}

async function renderSeccionActividadesProyecto(proyectoId, opcionesUsuarios) {
  const tarjeta = document.createElement("div");
  tarjeta.className = "tarjeta-ancha";
  tarjeta.style.marginTop = "24px";

  const h3 = document.createElement("h3");
  h3.style.margin = "0 0 16px";
  h3.style.fontSize = "1.125rem";
  h3.textContent = "Actividades por fase";
  tarjeta.append(h3);

  const mensaje = document.createElement("div");
  const contenedorGrupos = document.createElement("div");
  tarjeta.append(mensaje, contenedorGrupos);

  async function cargar() {
    mensaje.replaceChildren();
    contenedorGrupos.replaceChildren();
    const r = await api("GET", `/proyectos/${proyectoId}/actividades`);
    if (r.status !== 200) {
      mensaje.append(alerta("error", "No se pudieron cargar las actividades."));
      return;
    }
    const actividades = r.cuerpo.actividades;

    const porFase = new Map();
    actividades.forEach((actividad) => {
      if (!porFase.has(actividad.fase)) porFase.set(actividad.fase, []);
      porFase.get(actividad.fase).push(actividad);
    });

    const fasesConActividades = ETAPAS_PROYECTO_LINEAL.map((e) => e.valor).filter(
      (fase) => (porFase.get(fase) || []).length > 0
    );
    const ultimaFase = fasesConActividades[fasesConActividades.length - 1];

    ETAPAS_PROYECTO_LINEAL.forEach((etapa) => {
      const fase = etapa.valor;
      const lista = porFase.get(fase) || [];
      const completadas = lista.filter((actividad) => actividad.estado === "completada").length;

      const detalles = document.createElement("details");
      detalles.open = fase === ultimaFase;
      detalles.style.marginBottom = "12px";

      const resumen = document.createElement("summary");
      resumen.style.cursor = "pointer";
      resumen.style.fontWeight = "700";
      resumen.append(document.createTextNode(`${textoEstadoProyecto(fase)} `));
      if (lista.length > 0) {
        resumen.append(
          pill(`${completadas}/${lista.length}`, completadas === lista.length ? "good" : "info")
        );
        const conFechas = lista.filter((a) => a.fecha_inicio && a.fecha_fin);
        if (conFechas.length > 0) {
          const inicios = conFechas.map((a) => String(a.fecha_inicio).slice(0, 10)).sort();
          const fines = conFechas.map((a) => String(a.fecha_fin).slice(0, 10)).sort();
          const rango = document.createElement("span");
          rango.className = "subtitulo";
          rango.style.marginLeft = "8px";
          rango.style.fontWeight = "400";
          rango.textContent = `${inicios[0]} → ${fines[fines.length - 1]}`;
          resumen.append(rango);
        }
      }
      detalles.append(resumen);

      const contenidoFase = document.createElement("div");
      contenidoFase.style.padding = "8px 0 0";

      if (lista.length > 0) {
        const contenedorGanttFase = document.createElement("div");
        contenedorGanttFase.style.marginBottom = "16px";
        contenedorGanttFase.style.overflowX = "auto";
        contenidoFase.append(contenedorGanttFase);
        renderizarGantt(contenedorGanttFase, lista, proyectoId);
      }

      const tabla = document.createElement("table");
      tabla.className = "tabla-items";
      const thead = document.createElement("thead");
      const filaCabecera = document.createElement("tr");
      ["", "Categoría", "Actividad", "Responsable", "", ""].forEach((texto) => {
        const th = document.createElement("th");
        th.scope = "col";
        th.textContent = texto;
        filaCabecera.append(th);
      });
      thead.append(filaCabecera);
      const tbody = document.createElement("tbody");

      lista.forEach((actividad) => {
        const fila = document.createElement("tr");

        const tdCheck = document.createElement("td");
        const check = document.createElement("input");
        check.type = "checkbox";
        check.checked = actividad.estado === "completada";
        check.setAttribute("aria-label", `Marcar "${actividad.descripcion}" como completada`);
        check.addEventListener("change", async () => {
          const deseado = check.checked;
          check.disabled = true;
          const r2 = await api("PUT", `/proyectos/${proyectoId}/actividades/${actividad.id}`, {
            estado: deseado ? "completada" : "pendiente",
          });
          if (r2.status !== 200) {
            mensaje.replaceChildren(
              alerta("error", r2.cuerpo?.error || "No se pudo actualizar la actividad.")
            );
            check.disabled = false;
            return;
          }
          cargar();
        });
        tdCheck.append(check);
        fila.append(tdCheck);

        fila.append(celda(actividad.categoria));

        const tdDescripcion = document.createElement("td");
        tdDescripcion.textContent = actividad.descripcion;
        if (actividad.estado === "completada") {
          tdDescripcion.style.textDecoration = "line-through";
          tdDescripcion.style.color = "var(--ink-mute)";
        }
        fila.append(tdDescripcion);

        const tdResponsable = document.createElement("td");
        const selectResponsable = document.createElement("select");
        selectResponsable.setAttribute("aria-label", `Responsable de "${actividad.descripcion}"`);
        const vacio = document.createElement("option");
        vacio.value = "";
        vacio.textContent = "— Sin asignar —";
        selectResponsable.append(vacio);
        opcionesUsuarios.forEach((op) => {
          const o = document.createElement("option");
          o.value = op.valor;
          o.textContent = op.texto;
          selectResponsable.append(o);
        });
        selectResponsable.value = actividad.responsable_id ? String(actividad.responsable_id) : "";
        selectResponsable.addEventListener("change", async () => {
          await api("PUT", `/proyectos/${proyectoId}/actividades/${actividad.id}`, {
            responsable_id: Number(selectResponsable.value) || undefined,
          });
        });
        tdResponsable.append(selectResponsable);
        fila.append(tdResponsable);

        const filaEvidencias = document.createElement("tr");
        filaEvidencias.style.display = "none";
        const tdEvidenciasContenido = document.createElement("td");
        tdEvidenciasContenido.colSpan = 6;
        filaEvidencias.append(tdEvidenciasContenido);
        let evidenciasCargadas = false;

        const tdEvidencias = document.createElement("td");
        tdEvidencias.append(
          boton(
            "Evidencias",
            () => {
              const abierta = filaEvidencias.style.display !== "none";
              if (abierta) {
                filaEvidencias.style.display = "none";
                return;
              }
              if (!evidenciasCargadas) {
                tdEvidenciasContenido.append(
                  contenidoEvidencias("proyecto_actividades", actividad.id)
                );
                evidenciasCargadas = true;
              }
              filaEvidencias.style.display = "";
            },
            true
          )
        );
        fila.append(tdEvidencias);

        const tdAccion = document.createElement("td");
        const quitarBtn = boton(
          "Quitar",
          async () => {
            if (!window.confirm("¿Quitar esta actividad?")) return;
            const r2 = await api(
              "DELETE",
              `/proyectos/${proyectoId}/actividades/${actividad.id}`
            );
            if (r2.status === 204) {
              cargar();
              return;
            }
            mensaje.replaceChildren(
              alerta("error", r2.cuerpo?.error || "No se pudo quitar la actividad.")
            );
          },
          true
        );
        tdAccion.append(quitarBtn);
        fila.append(tdAccion);

        tbody.append(fila, filaEvidencias);
      });

      if (lista.length > 0) {
        tabla.append(thead, tbody);
        contenidoFase.append(tabla);
      }

      const filaAgregar = document.createElement("div");
      filaAgregar.style.marginTop = "8px";
      const mostrarFormAgregar = () => {
        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "Nombre de la subactividad";
        input.setAttribute("aria-label", `Nueva subactividad en ${textoEstadoProyecto(fase)}`);
        input.style.marginRight = "8px";
        const confirmar = boton(
          "Agregar",
          async () => {
            const nombre = input.value.trim();
            if (!nombre) return;
            const r2 = await api("POST", `/proyectos/${proyectoId}/actividades`, {
              categoria: "General",
              descripcion: nombre,
              fase,
            });
            if (r2.status !== 201) {
              mensaje.replaceChildren(
                alerta("error", r2.cuerpo?.error || "No se pudo agregar la subactividad.")
              );
              return;
            }
            cargar();
          },
          true
        );
        const cancelar = boton(
          "Cancelar",
          () => {
            filaAgregar.replaceChildren(botonMas);
          },
          true
        );
        filaAgregar.replaceChildren(input, confirmar, cancelar);
        input.focus();
      };
      const botonMas = boton("+ Agregar subactividad", mostrarFormAgregar, true);
      filaAgregar.append(botonMas);
      contenidoFase.append(filaAgregar);

      detalles.append(contenidoFase);
      contenedorGrupos.append(detalles);
    });
  }

  await cargar();
  return tarjeta;
}

async function renderSeccionEquipoProyecto(proyectoId, opcionesUsuarios) {
  const tarjeta = document.createElement("div");
  tarjeta.className = "tarjeta-ancha";
  tarjeta.style.marginTop = "24px";

  const h3 = document.createElement("h3");
  h3.style.margin = "0 0 16px";
  h3.style.fontSize = "1.125rem";
  h3.textContent = "Equipo del proyecto";
  tarjeta.append(h3);

  const mensaje = document.createElement("div");
  const tabla = document.createElement("table");
  tabla.className = "tabla-items";
  tarjeta.append(mensaje, tabla);

  async function cargar() {
    mensaje.replaceChildren();
    tabla.replaceChildren();
    const r = await api("GET", `/proyectos/${proyectoId}/equipo`);
    if (r.status !== 200) {
      mensaje.append(alerta("error", "No se pudo cargar el equipo."));
      return;
    }
    const equipo = r.cuerpo.equipo;

    const thead = document.createElement("thead");
    const filaCabecera = document.createElement("tr");
    ["Integrante", "Rol en el proyecto", ""].forEach((texto) => {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = texto;
      filaCabecera.append(th);
    });
    thead.append(filaCabecera);
    tabla.append(thead);

    const tbody = document.createElement("tbody");
    if (equipo.length === 0) {
      const fila = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 3;
      td.className = "subtitulo";
      td.textContent = "Aún no hay integrantes asignados.";
      fila.append(td);
      tbody.append(fila);
    }
    equipo.forEach((miembro) => {
      const fila = document.createElement("tr");
      fila.append(celda(miembro.usuario_nombre), celda(miembro.rol_en_proyecto));

      const tdAccion = document.createElement("td");
      const quitarBtn = boton(
        "Quitar",
        async () => {
          if (!window.confirm(`¿Quitar a ${miembro.usuario_nombre} del equipo?`)) return;
          const r2 = await api("DELETE", `/proyectos/${proyectoId}/equipo/${miembro.id}`);
          if (r2.status === 204) {
            cargar();
            return;
          }
          mensaje.replaceChildren(
            alerta("error", r2.cuerpo?.error || "No se pudo quitar al integrante.")
          );
        },
        true
      );
      tdAccion.append(quitarBtn);
      fila.append(tdAccion);

      tbody.append(fila);
    });
    tabla.append(tbody);
  }

  const formAgregar = document.createElement("form");
  formAgregar.noValidate = true;
  formAgregar.style.marginTop = "16px";
  const gridAgregar = document.createElement("div");
  gridAgregar.className = "formulario-grid";
  gridAgregar.append(
    construirCampo(
      {
        nombre: "equipo_usuario_id",
        etiqueta: "Integrante",
        tipo: "select",
        requerido: true,
        opciones: opcionesUsuarios,
      },
      ""
    ),
    construirCampo({ nombre: "equipo_rol", etiqueta: "Rol en el proyecto", requerido: true }, "")
  );
  const agregarBtn = document.createElement("button");
  agregarBtn.type = "submit";
  agregarBtn.className = "boton boton-pequeno";
  agregarBtn.textContent = "Agregar al equipo";
  formAgregar.append(gridAgregar, agregarBtn);

  formAgregar.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const usuarioId = formAgregar.elements.equipo_usuario_id.value;
    const rol = formAgregar.elements.equipo_rol.value.trim();
    if (!usuarioId || !rol) return;
    const r = await api("POST", `/proyectos/${proyectoId}/equipo`, {
      usuario_id: Number(usuarioId),
      rol_en_proyecto: rol,
    });
    if (r.status !== 201) {
      mensaje.replaceChildren(
        alerta("error", r.cuerpo?.error || "No se pudo agregar al integrante.")
      );
      return;
    }
    formAgregar.reset();
    cargar();
  });

  tarjeta.append(formAgregar);

  await cargar();
  return tarjeta;
}

function describirEventoLineaTiempo(evento) {
  if (evento.tabla === "proyectos") {
    if (evento.accion === "crear") return "Proyecto creado";
    if (evento.cambio_estado) {
      let texto = `Cambio de fase: ${textoEstadoProyecto(evento.cambio_estado.de)} → ${textoEstadoProyecto(evento.cambio_estado.a)}`;
      if (evento.observacion) texto += ` — "${evento.observacion}"`;
      return texto;
    }
    return "Datos del proyecto actualizados";
  }
  if (evento.tabla === "proyecto_equipo") {
    const nombre = evento.miembro_nombre || "un usuario";
    if (evento.accion === "crear") return `${nombre} se unió al equipo como ${evento.miembro_rol}`;
    if (evento.accion === "eliminar") return `${nombre} salió del equipo del proyecto`;
    return `Equipo actualizado: ${nombre}`;
  }
  if (evento.tabla === "proyecto_actividades") {
    const descripcion = evento.actividad_descripcion || "actividad";
    if (evento.accion === "crear") return `Actividad creada: ${descripcion}`;
    if (evento.accion === "eliminar") return `Actividad eliminada: ${descripcion}`;
    if (evento.actividad_cambio_estado) {
      return evento.actividad_cambio_estado.a === "completada"
        ? `Actividad completada: ${descripcion}`
        : `Actividad marcada como pendiente: ${descripcion}`;
    }
    return `Actividad actualizada: ${descripcion}`;
  }
  return "Evento registrado";
}

function formatoFechaHora(valor) {
  return new Date(valor).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

async function renderSeccionLineaTiempoProyecto(proyectoId) {
  const tarjeta = document.createElement("div");
  tarjeta.className = "tarjeta-ancha";
  tarjeta.style.marginTop = "24px";

  const h3 = document.createElement("h3");
  h3.style.margin = "0 0 16px";
  h3.style.fontSize = "1.125rem";
  h3.textContent = "Línea de tiempo";
  tarjeta.append(h3);

  const mensaje = document.createElement("div");
  const lista = document.createElement("ul");
  lista.style.listStyle = "none";
  lista.style.margin = "0";
  lista.style.padding = "0";
  tarjeta.append(mensaje, lista);

  const r = await api("GET", `/proyectos/${proyectoId}/linea-tiempo`);
  if (r.status !== 200) {
    mensaje.append(alerta("error", "No se pudo cargar la línea de tiempo."));
    return tarjeta;
  }

  const eventos = r.cuerpo.eventos;
  if (eventos.length === 0) {
    const p = document.createElement("p");
    p.className = "subtitulo";
    p.textContent = "Aún no hay eventos registrados para este proyecto.";
    lista.append(p);
    return tarjeta;
  }

  eventos.forEach((evento) => {
    const item = document.createElement("li");
    item.style.padding = "10px 0";
    item.style.borderBottom = "1px solid var(--borde)";

    const fila = document.createElement("div");
    fila.style.display = "flex";
    fila.style.justifyContent = "space-between";
    fila.style.gap = "12px";

    const texto = document.createElement("span");
    texto.textContent = describirEventoLineaTiempo(evento);

    const meta = document.createElement("span");
    meta.className = "subtitulo";
    meta.style.whiteSpace = "nowrap";
    meta.textContent = `${evento.usuario_nombre || "—"} · ${formatoFechaHora(evento.creado_en)}`;

    fila.append(texto, meta);
    item.append(fila);
    lista.append(item);
  });

  return tarjeta;
}

async function vistaProyectos() {
  marcarMenu("proyectos");
  mostrarCargando();
  const [{ status, cuerpo }, clientes, usuarios] = await Promise.all([
    api("GET", "/proyectos"),
    obtenerClientes(),
    obtenerUsuarios(),
  ]);
  contenido.replaceChildren();

  if (status !== 200) {
    contenido.append(encabezado("Proyectos"), alerta("error", "No se pudieron cargar los proyectos."));
    return;
  }

  const nombreCliente = (id) => clientes.find((c) => c.id === id)?.nombre_razon_social || "—";
  const nombreUsuario = (id) => usuarios.find((u) => u.id === id)?.nombre || "—";

  const nuevo = boton("Nuevo proyecto", () => (window.location.hash = "#/proyectos/nuevo"));
  contenido.append(encabezado("Proyectos", [nuevo]));

  const proyectos = cuerpo.proyectos;
  if (proyectos.length === 0) {
    const p = document.createElement("p");
    p.className = "subtitulo";
    p.textContent = "Aún no hay proyectos registrados.";
    contenido.append(p);
    return;
  }

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
      nombreCliente(p.cliente_id),
      estadoPill(textoEstadoProyecto(p.estado), tipoPillProyecto(p.estado)),
      nombreUsuario(p.responsable_id),
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

    const formEliminar = document.createElement("div");
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
          vistaProyectos();
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
      () => {
        filaConfirmacion.style.display = "none";
        inputPassword.value = "";
        textareaJustificacion.value = "";
        mensajeEliminar.replaceChildren();
      },
      true
    );

    formEliminar.append(inputPassword, textareaJustificacion, mensajeEliminar, confirmarEliminar, cancelarEliminar);
    tdConfirmacion.append(formEliminar);
    filaConfirmacion.append(tdConfirmacion);

    const eliminar = boton(
      "Eliminar",
      () => {
        filaConfirmacion.style.display = filaConfirmacion.style.display === "none" ? "" : "none";
      },
      true
    );
    eliminar.setAttribute("aria-label", `Eliminar proyecto ${p.codigo_pry}`);
    accion.append(editar, eliminar);
    fila.append(accion);
    tbody.append(fila, filaConfirmacion);
  });

  tabla.append(thead, tbody);
  tarjeta.append(tabla);
  contenido.append(tarjeta);
}

async function vistaProyectoForm(id) {
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
  const volver = boton("Volver a proyectos", () => (window.location.hash = "#/proyectos"), true);
  contenido.append(encabezado(id ? `Proyecto ${proyecto.codigo_pry}` : "Nuevo proyecto", [volver]));

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
  guardar.textContent = id ? "Guardar cambios" : "Crear proyecto";

  form.append(grid, guardar);
  if (!id) form.append(botonCancelar("#/proyectos"));
  tarjeta.append(mensaje, form);
  contenido.append(tarjeta);

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
      const r = id
        ? await api("PUT", `/proyectos/${id}`, datos)
        : await api("POST", "/proyectos", datos);
      if (r.status === 200 || r.status === 201) {
        window.location.hash = id ? `#/proyectos/${id}` : "#/proyectos";
        if (id) vistaProyectoForm(id);
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

  if (id) {
    const bloqueFase = document.createElement("div");
    bloqueFase.style.marginTop = "24px";
    bloqueFase.style.paddingTop = "24px";
    bloqueFase.style.borderTop = "1px solid var(--borde)";

    const subtitulo = document.createElement("p");
    subtitulo.className = "subtitulo";
    subtitulo.textContent = "Fase del proyecto";
    bloqueFase.append(subtitulo, construirStageTrack(proyecto.estado));

    const mensajeFase = document.createElement("div");
    const filaFase = document.createElement("div");
    filaFase.className = "formulario-grid";
    filaFase.append(
      construirCampo(
        { nombre: "nueva_fase", etiqueta: "Cambiar a la fase", tipo: "select", opciones: ESTADOS_PROYECTO },
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
    tarjeta.append(bloqueFase);

    tarjeta.append(renderSeccionPresupuestoProyecto(proyecto));
    tarjeta.append(await renderSeccionActividadesProyecto(id, opcionesUsuarios));
    tarjeta.append(await renderSeccionEquipoProyecto(id, opcionesUsuarios));
    tarjeta.append(renderSeccionEvidencias("proyectos", id, "Evidencias del proyecto"));
    tarjeta.append(await renderSeccionLineaTiempoProyecto(id));
  }
}

function nombreClienteDe(clientes, id) {
  return clientes.find((c) => c.id === id)?.nombre_razon_social || "—";
}

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
  mostrarCargando();
  const [{ status, cuerpo }, clientes, usuarios] = await Promise.all([
    api("GET", "/cotizaciones"),
    obtenerClientes(),
    obtenerUsuarios(),
  ]);
  contenido.replaceChildren();

  if (status !== 200) {
    contenido.append(encabezado("Cotizaciones"), alerta("error", "No se pudieron cargar las cotizaciones."));
    return;
  }

  const nombreCliente = (id) => clientes.find((c) => c.id === id)?.nombre_razon_social || "—";
  const nombreUsuario = (id) => usuarios.find((u) => u.id === id)?.nombre || "—";

  const nuevo = boton("Nueva cotización", () => (window.location.hash = "#/cotizaciones/nuevo"));
  contenido.append(encabezado("Cotizaciones", [nuevo]));

  const cotizaciones = cuerpo.cotizaciones;
  if (cotizaciones.length === 0) {
    const p = document.createElement("p");
    p.className = "subtitulo";
    p.textContent = "Aún no hay cotizaciones registradas.";
    contenido.append(p);
    return;
  }

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
      nombreCliente(c.cliente_id),
      nombreUsuario(c.asesor_comercial_id),
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
  contenido.append(tarjeta);
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

async function vistaCotizacionForm(id) {
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

  const editable = !id || cotizacion.estado === "borrador";
  const opcionesClientes = clientes.map((c) => ({ valor: String(c.id), texto: c.nombre_razon_social }));
  const opcionesUsuarios = usuarios.map((u) => ({ valor: String(u.id), texto: u.nombre }));

  contenido.replaceChildren();
  const volver = boton("Volver a cotizaciones", () => (window.location.hash = "#/cotizaciones"), true);
  contenido.append(
    encabezado(id ? `Cotización ${cotizacion.numero_cotizacion}` : "Nueva cotización", [volver])
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
    avisoSoloLectura.textContent = "Solo se puede editar una cotización en estado borrador.";
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
  guardar.textContent = id ? "Guardar cambios" : "Crear cotización";

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
        const r = id
          ? await api("PUT", `/cotizaciones/${id}`, datos)
          : await api("POST", "/cotizaciones", datos);
        if (r.status === 200 || r.status === 201) {
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

  if (id) {
    const bloqueEstado = document.createElement("div");
    bloqueEstado.style.marginTop = "24px";
    bloqueEstado.style.paddingTop = "24px";
    bloqueEstado.style.borderTop = "1px solid var(--borde)";

    const subtituloEstado = document.createElement("p");
    subtituloEstado.className = "subtitulo";
    subtituloEstado.textContent = `Estado actual: ${textoEstadoCotizacion(cotizacion.estado)}`;
    bloqueEstado.append(subtituloEstado);

    const mensajeEstado = document.createElement("div");
    const filaEstado = document.createElement("div");
    filaEstado.className = "formulario-grid";
    filaEstado.append(
      construirCampo(
        { nombre: "nuevo_estado", etiqueta: "Cambiar a", tipo: "select", opciones: ESTADOS_COTIZACION },
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
    tarjeta.append(bloqueEstado);
  }
}

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
  mostrarCargando();
  const { status, cuerpo } = await api("GET", "/proveedores");
  contenido.replaceChildren();

  if (status !== 200) {
    contenido.append(encabezado("Proveedores"), alerta("error", "No se pudieron cargar los proveedores."));
    return;
  }

  const nuevo = boton("Nuevo proveedor", () => (window.location.hash = "#/proveedores/nuevo"));
  contenido.append(encabezado("Proveedores", [nuevo]));

  const proveedores = cuerpo.proveedores;
  if (proveedores.length === 0) {
    const p = document.createElement("p");
    p.className = "subtitulo";
    p.textContent = "Aún no hay proveedores registrados.";
    contenido.append(p);
    return;
  }

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
  contenido.append(tarjeta);
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
  mostrarCargando();
  const [{ status, cuerpo }, proyectos] = await Promise.all([
    api("GET", "/requisiciones"),
    obtenerProyectos(),
  ]);
  contenido.replaceChildren();

  if (status !== 200) {
    contenido.append(encabezado("Requisiciones"), alerta("error", "No se pudieron cargar las requisiciones."));
    return;
  }

  const nombreProyecto = (id) => proyectos.find((p) => p.id === id)?.nombre_proyecto || "—";

  const nuevo = boton("Nueva requisición", () => (window.location.hash = "#/requisiciones/nuevo"));
  contenido.append(encabezado("Requisiciones", [nuevo]));

  const requisiciones = cuerpo.requisiciones;
  if (requisiciones.length === 0) {
    const p = document.createElement("p");
    p.className = "subtitulo";
    p.textContent = "Aún no hay requisiciones registradas.";
    contenido.append(p);
    return;
  }

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
      nombreProyecto(r.proyecto_id),
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
  contenido.append(tarjeta);
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
  mostrarCargando();
  const [{ status, cuerpo }, proveedores] = await Promise.all([
    api("GET", "/ordenes-compra"),
    obtenerProveedores(),
  ]);
  contenido.replaceChildren();

  if (status !== 200) {
    contenido.append(encabezado("Órdenes de compra"), alerta("error", "No se pudieron cargar las órdenes de compra."));
    return;
  }

  const nombreProveedor = (id) => proveedores.find((p) => p.id === id)?.razon_social || "—";

  const nuevo = boton("Nueva orden de compra", () => (window.location.hash = "#/ordenes-compra/nuevo"));
  contenido.append(encabezado("Órdenes de compra", [nuevo]));

  const ordenes = cuerpo.ordenes;
  if (ordenes.length === 0) {
    const p = document.createElement("p");
    p.className = "subtitulo";
    p.textContent = "Aún no hay órdenes de compra registradas.";
    contenido.append(p);
    return;
  }

  const tarjeta = document.createElement("div");
  tarjeta.className = "tarjeta-ancha";
  const tabla = document.createElement("table");
  const thead = document.createElement("thead");
  const filaCabecera = document.createElement("tr");
  ["Número", "Proveedor", "Estado", ""].forEach((texto) => {
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
      nombreProveedor(o.proveedor_id),
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
  contenido.append(tarjeta);
}

async function vistaOrdenCompraForm(id) {
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

  const editable = !id || orden.estado === "pte_aprobar";
  const opcionesProveedores = proveedores.map((p) => ({ valor: String(p.id), texto: p.razon_social }));
  const opcionesRequisiciones = requisiciones.map((r) => ({ valor: String(r.id), texto: r.numero_requisicion }));

  contenido.replaceChildren();
  const volver = boton("Volver a órdenes de compra", () => (window.location.hash = "#/ordenes-compra"), true);
  contenido.append(
    encabezado(id ? `Orden de compra ${orden.numero_oc}` : "Nueva orden de compra", [volver])
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
  guardar.textContent = id ? "Guardar cambios" : "Crear orden de compra";

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
        const r = id
          ? await api("PUT", `/ordenes-compra/${id}`, datos)
          : await api("POST", "/ordenes-compra", datos);
        if (r.status === 200 || r.status === 201) {
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

  if (id) {
    const bloqueEstado = document.createElement("div");
    bloqueEstado.style.marginTop = "24px";
    bloqueEstado.style.paddingTop = "24px";
    bloqueEstado.style.borderTop = "1px solid var(--borde)";

    const subtituloEstado = document.createElement("p");
    subtituloEstado.className = "subtitulo";
    subtituloEstado.textContent = `Estado actual: ${textoEstadoOrdenCompra(orden.estado)}`;
    bloqueEstado.append(subtituloEstado);

    const mensajeEstado = document.createElement("div");
    const filaEstado = document.createElement("div");
    filaEstado.className = "formulario-grid";
    filaEstado.append(
      construirCampo(
        { nombre: "nuevo_estado", etiqueta: "Cambiar a", tipo: "select", opciones: ESTADOS_ORDEN_COMPRA },
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
    tarjeta.append(bloqueEstado);
    tarjeta.append(renderSeccionEvidencias("ordenes_compra", id, "Evidencias / soportes"));
  }
}

const ESTADOS_EXPEDIENTE = [
  { valor: "pendiente", texto: "Pendiente" },
  { valor: "aprobado", texto: "Aprobado" },
  { valor: "aprobado_con_restricciones", texto: "Aprobado con restricciones" },
  { valor: "rechazado", texto: "Rechazado" },
];

function textoEstadoExpediente(valor) {
  const encontrado = ESTADOS_EXPEDIENTE.find((e) => e.valor === valor);
  return encontrado ? encontrado.texto : valor;
}

function tipoPillExpediente(valor) {
  if (valor === "aprobado") return "good";
  if (valor === "rechazado") return "crit";
  if (valor === "aprobado_con_restricciones") return "warn";
  return "mute";
}

async function vistaExpedientes() {
  marcarMenu("expedientes-diseno");
  mostrarCargando();
  const [{ status, cuerpo }, proyectos, usuarios] = await Promise.all([
    api("GET", "/expedientes-diseno"),
    obtenerProyectos(),
    obtenerUsuarios(),
  ]);
  contenido.replaceChildren();

  if (status !== 200) {
    contenido.append(encabezado("Expedientes de diseño"), alerta("error", "No se pudieron cargar los expedientes."));
    return;
  }

  const nombreProyecto = (id) => proyectos.find((p) => p.id === id)?.nombre_proyecto || "—";
  const nombreUsuario = (id) => usuarios.find((u) => u.id === id)?.nombre || "—";

  const nuevo = boton("Nuevo expediente", () => (window.location.hash = "#/expedientes-diseno/nuevo"));
  contenido.append(encabezado("Expedientes de diseño", [nuevo]));

  const expedientes = cuerpo.expedientes;
  if (expedientes.length === 0) {
    const p = document.createElement("p");
    p.className = "subtitulo";
    p.textContent = "Aún no hay expedientes de diseño registrados.";
    contenido.append(p);
    return;
  }

  const tarjeta = document.createElement("div");
  tarjeta.className = "tarjeta-ancha";
  const tabla = document.createElement("table");
  const thead = document.createElement("thead");
  const filaCabecera = document.createElement("tr");
  ["Código", "Producto", "Proyecto", "Responsable", "Estado", ""].forEach((texto) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = texto;
    filaCabecera.append(th);
  });
  thead.append(filaCabecera);

  const tbody = document.createElement("tbody");
  expedientes.forEach((e) => {
    const fila = document.createElement("tr");
    [
      e.codigo_expediente,
      e.producto_nombre,
      nombreProyecto(e.proyecto_id),
      nombreUsuario(e.responsable_diseno_id),
      estadoPill(textoEstadoExpediente(e.estado_liberacion), tipoPillExpediente(e.estado_liberacion)),
    ].forEach((valor) => {
      fila.append(celda(valor));
    });
    const accion = document.createElement("td");
    const editar = boton(
      "Ver / Editar",
      () => (window.location.hash = `#/expedientes-diseno/${e.id}`),
      true
    );
    editar.setAttribute("aria-label", `Ver expediente ${e.codigo_expediente}`);
    accion.append(editar);
    fila.append(accion);
    tbody.append(fila);
  });

  tabla.append(thead, tbody);
  tarjeta.append(tabla);
  contenido.append(tarjeta);
}

async function vistaExpedienteForm(id) {
  marcarMenu("expedientes-diseno");
  mostrarCargando();

  const [proyectos, usuarios] = await Promise.all([obtenerProyectos(), obtenerUsuarios()]);
  let expediente = null;
  if (id) {
    const r = await api("GET", `/expedientes-diseno/${id}`);
    if (r.status !== 200) {
      contenido.replaceChildren(encabezado("Expediente de diseño"), alerta("error", "No se encontró el expediente."));
      return;
    }
    expediente = r.cuerpo.expediente;
  } else if (proyectos.length === 0) {
    contenido.replaceChildren(
      encabezado("Nuevo expediente"),
      alerta("error", "Primero crea al menos un proyecto.")
    );
    return;
  }

  const editable = !id || expediente.estado_liberacion === "pendiente";
  const opcionesProyectos = proyectos.map((p) => ({ valor: String(p.id), texto: p.nombre_proyecto }));
  const opcionesUsuarios = usuarios.map((u) => ({ valor: String(u.id), texto: u.nombre }));

  contenido.replaceChildren();
  const volver = boton("Volver a expedientes", () => (window.location.hash = "#/expedientes-diseno"), true);
  contenido.append(
    encabezado(id ? `Expediente ${expediente.codigo_expediente}` : "Nuevo expediente", [volver])
  );

  const tarjeta = document.createElement("div");
  tarjeta.className = "tarjeta-ancha";
  const mensaje = document.createElement("div");
  const form = document.createElement("form");
  form.noValidate = true;
  const grid = document.createElement("div");
  grid.className = "formulario-grid";

  const camposBase = [
    { nombre: "producto_nombre", etiqueta: "Nombre del producto", requerido: true },
    { nombre: "modelo", etiqueta: "Modelo" },
    { nombre: "numero_serie", etiqueta: "Número de serie" },
  ];

  const camposCabecera = id
    ? [
        { nombre: "proyecto", etiqueta: "Proyecto", tipo: "estatico" },
        ...camposBase,
        editable
          ? { nombre: "responsable_diseno_id", etiqueta: "Responsable de diseño", tipo: "select", requerido: true, opciones: opcionesUsuarios }
          : { nombre: "responsable", etiqueta: "Responsable de diseño", tipo: "estatico" },
      ]
    : [
        { nombre: "proyecto_id", etiqueta: "Proyecto", tipo: "select", requerido: true, opciones: opcionesProyectos },
        ...camposBase,
        { nombre: "responsable_diseno_id", etiqueta: "Responsable de diseño", tipo: "select", requerido: true, opciones: opcionesUsuarios },
      ];

  camposCabecera.forEach((config) => {
    let valor = "";
    if (expediente) {
      if (config.nombre === "proyecto") {
        valor = proyectos.find((p) => p.id === expediente.proyecto_id)?.nombre_proyecto || "—";
      } else if (config.nombre === "responsable") {
        valor = usuarios.find((u) => u.id === expediente.responsable_diseno_id)?.nombre || "—";
      } else if (config.nombre === "responsable_diseno_id") {
        valor = String(expediente.responsable_diseno_id);
      } else if (config.tipo !== "estatico") {
        valor = expediente[config.nombre] || "";
      }
    }
    grid.append(construirCampo(config, valor));
  });

  if (!editable) {
    const aviso = document.createElement("p");
    aviso.className = "subtitulo";
    aviso.textContent = "Solo se puede editar un expediente en estado pendiente.";
    grid.append(aviso);
  }

  const guardar = document.createElement("button");
  guardar.type = "submit";
  guardar.className = "boton boton-pequeno";
  guardar.textContent = id ? "Guardar cambios" : "Crear expediente";

  form.append(grid);
  if (editable) form.append(guardar);
  if (!id) form.append(botonCancelar("#/expedientes-diseno"));
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
      const faltantes = camposCabecera.filter(
        (c) => c.tipo !== "estatico" && c.requerido && !datos[c.nombre]
      );
      if (faltantes.length > 0) {
        mensaje.append(alerta("error", "Completa los campos obligatorios marcados con *."));
        return;
      }
      if (!id && !confirmarCreacion("este expediente")) return;

      guardar.disabled = true;
      try {
        const r = id
          ? await api("PUT", `/expedientes-diseno/${id}`, datos)
          : await api("POST", "/expedientes-diseno", datos);
        if (r.status === 200 || r.status === 201) {
          window.location.hash = id ? `#/expedientes-diseno/${id}` : "#/expedientes-diseno";
          if (id) vistaExpedienteForm(id);
          return;
        }
        if (r.status === 400 && Array.isArray(r.cuerpo?.detalles)) {
          const mensajes = mostrarErroresValidacion(form, camposCabecera, r.cuerpo.detalles);
          mensaje.append(alerta("error", mensajes.join(" · ")));
        } else {
          mensaje.append(alerta("error", r.cuerpo?.error || "No se pudo guardar el expediente."));
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
    subtituloEstado.textContent = `Estado actual: ${textoEstadoExpediente(expediente.estado_liberacion)}`;
    bloqueEstado.append(subtituloEstado);

    const mensajeEstado = document.createElement("div");
    const filaEstado = document.createElement("div");
    filaEstado.className = "formulario-grid";
    filaEstado.append(
      construirCampo(
        { nombre: "nuevo_estado", etiqueta: "Cambiar a", tipo: "select", opciones: ESTADOS_EXPEDIENTE },
        expediente.estado_liberacion
      )
    );
    const botonEstado = boton("Actualizar estado", async () => {
      mensajeEstado.replaceChildren();
      const nuevoEstado = document.getElementById("nuevo_estado").value;
      const r = await api("PATCH", `/expedientes-diseno/${id}/estado`, { estado: nuevoEstado });
      if (r.status === 200) {
        vistaExpedienteForm(id);
        return;
      }
      mensajeEstado.append(alerta("error", r.cuerpo?.error || "No se pudo cambiar el estado."));
    });

    bloqueEstado.append(filaEstado, botonEstado, mensajeEstado);
    tarjeta.append(bloqueEstado);

    for (const config of subrecursosExpediente(opcionesUsuarios)) {
      const seccion = await renderSeccionSubrecurso(id, config, editable);
      contenido.append(seccion);
    }
  }
}

const OPCIONES_SI_NO = [
  { valor: "si", texto: "Sí" },
  { valor: "no", texto: "No" },
];

const OPCIONES_ESTADO_CAMBIO_DISENO = [
  { valor: "pendiente", texto: "Pendiente" },
  { valor: "aprobado", texto: "Aprobado" },
  { valor: "rechazado", texto: "Rechazado" },
];

function subrecursosExpediente(opcionesUsuarios) {
  return [
    {
      ruta: "requisitos-entrada",
      clave: "requisitos",
      titulo: "Requisitos de entrada",
      nombreSingular: "requisito",
      campos: [
        { nombre: "requisito", etiqueta: "Requisito", requerido: true },
        { nombre: "valor", etiqueta: "Valor" },
        { nombre: "fuente", etiqueta: "Fuente" },
        { nombre: "criterio_aceptacion", etiqueta: "Criterio de aceptación" },
        { nombre: "evidencia", etiqueta: "Evidencia" },
        { nombre: "cumple", etiqueta: "Cumple", tipo: "select", opciones: OPCIONES_SI_NO },
      ],
    },
    {
      ruta: "salidas-diseno",
      clave: "salidas",
      titulo: "Salidas de diseño",
      nombreSingular: "salida",
      campos: [
        { nombre: "salida", etiqueta: "Salida", requerido: true },
        { nombre: "codigo_version", etiqueta: "Código / versión" },
        {
          nombre: "responsable_id",
          etiqueta: "Responsable",
          tipo: "select",
          requerido: true,
          opciones: opcionesUsuarios,
        },
        { nombre: "fecha", etiqueta: "Fecha", tipo: "date" },
        { nombre: "estado", etiqueta: "Estado" },
      ],
    },
    {
      ruta: "verificaciones",
      clave: "verificaciones",
      titulo: "Verificaciones",
      nombreSingular: "verificación",
      campos: [
        { nombre: "requisito_verificado", etiqueta: "Requisito verificado", requerido: true },
        { nombre: "metodo", etiqueta: "Método" },
        { nombre: "criterio", etiqueta: "Criterio" },
        { nombre: "resultado", etiqueta: "Resultado" },
        { nombre: "evidencia", etiqueta: "Evidencia" },
      ],
    },
    {
      ruta: "validaciones",
      clave: "validaciones",
      titulo: "Validaciones",
      nombreSingular: "validación",
      campos: [
        { nombre: "aspecto_validado", etiqueta: "Aspecto validado", requerido: true },
        { nombre: "metodo", etiqueta: "Método" },
        { nombre: "condicion_prueba", etiqueta: "Condición de prueba" },
        { nombre: "resultado", etiqueta: "Resultado" },
      ],
    },
    {
      ruta: "revisiones-diseno",
      clave: "revisiones",
      titulo: "Revisiones de diseño",
      nombreSingular: "revisión",
      campos: [
        { nombre: "fecha", etiqueta: "Fecha", tipo: "date" },
        { nombre: "hallazgos", etiqueta: "Hallazgos" },
        { nombre: "acciones", etiqueta: "Acciones" },
        {
          nombre: "responsable_id",
          etiqueta: "Responsable",
          tipo: "select",
          requerido: true,
          opciones: opcionesUsuarios,
        },
        { nombre: "cierre", etiqueta: "Cierre", tipo: "select", opciones: OPCIONES_SI_NO },
      ],
    },
    {
      ruta: "riesgos-diseno",
      clave: "riesgos",
      titulo: "Riesgos de diseño",
      nombreSingular: "riesgo",
      campos: [
        { nombre: "peligro", etiqueta: "Peligro", requerido: true },
        { nombre: "situacion_peligrosa", etiqueta: "Situación peligrosa" },
        { nombre: "dano_potencial", etiqueta: "Daño potencial" },
        { nombre: "severidad", etiqueta: "Severidad" },
        { nombre: "probabilidad", etiqueta: "Probabilidad" },
        { nombre: "control", etiqueta: "Control" },
        {
          nombre: "responsable_id",
          etiqueta: "Responsable",
          tipo: "select",
          requerido: true,
          opciones: opcionesUsuarios,
        },
      ],
    },
    {
      ruta: "cambios-diseno",
      clave: "cambios",
      titulo: "Cambios de diseño",
      nombreSingular: "cambio",
      campos: [
        { nombre: "fecha", etiqueta: "Fecha", tipo: "date" },
        { nombre: "descripcion", etiqueta: "Descripción" },
        { nombre: "motivo", etiqueta: "Motivo" },
        { nombre: "estado", etiqueta: "Estado", tipo: "select", opciones: OPCIONES_ESTADO_CAMBIO_DISENO },
      ],
    },
    {
      ruta: "transferencias",
      clave: "transferencias",
      titulo: "Transferencias",
      nombreSingular: "transferencia",
      campos: [
        { nombre: "elemento_transferido", etiqueta: "Elemento transferido", requerido: true },
        { nombre: "area_receptora", etiqueta: "Área receptora" },
        {
          nombre: "responsable_id",
          etiqueta: "Responsable",
          tipo: "select",
          requerido: true,
          opciones: opcionesUsuarios,
        },
        { nombre: "fecha", etiqueta: "Fecha", tipo: "date" },
        { nombre: "cumple", etiqueta: "Cumple", tipo: "select", opciones: OPCIONES_SI_NO },
      ],
    },
  ];
}

function valorMostrableSubrecurso(config, valor) {
  if (valor === null || valor === undefined || valor === "") return "—";
  if (config.tipo === "select") {
    const encontrada = normalizarOpciones(config.opciones).find(
      (o) => String(o.valor) === String(valor)
    );
    return encontrada ? encontrada.texto : valor;
  }
  if (config.tipo === "date" && typeof valor === "string") return valor.substring(0, 10);
  return valor;
}

function tipoPillSubrecurso(config, valor) {
  if (config.opciones === OPCIONES_SI_NO) {
    if (valor === "si") return "good";
    if (valor === "no") return "crit";
    return null;
  }
  if (config.opciones === OPCIONES_ESTADO_CAMBIO_DISENO) {
    if (valor === "aprobado") return "good";
    if (valor === "rechazado") return "crit";
    if (valor === "pendiente") return "warn";
  }
  return null;
}

function construirInputCeldaSubrecurso(config, valor) {
  let input;
  if (config.tipo === "select") {
    input = document.createElement("select");
    normalizarOpciones(config.opciones).forEach((op) => {
      const o = document.createElement("option");
      o.value = op.valor;
      o.textContent = op.texto;
      input.append(o);
    });
    input.value = valor !== null && valor !== undefined ? String(valor) : normalizarOpciones(config.opciones)[0].valor;
  } else {
    input = document.createElement("input");
    input.type = config.tipo === "date" ? "date" : "text";
    input.value = config.tipo === "date" && valor ? String(valor).substring(0, 10) : valor || "";
  }
  input.name = config.nombre;
  input.setAttribute("aria-label", config.etiqueta);
  if (config.requerido) input.required = true;
  return input;
}

async function renderSeccionSubrecurso(expedienteId, config, editable) {
  const tarjeta = document.createElement("div");
  tarjeta.className = "tarjeta-ancha";
  tarjeta.style.marginTop = "24px";

  const h3 = document.createElement("h3");
  h3.style.margin = "0 0 16px";
  h3.style.fontSize = "1.125rem";
  h3.textContent = config.titulo;

  const mensaje = document.createElement("div");

  const tabla = document.createElement("table");
  tabla.className = "tabla-items";
  const thead = document.createElement("thead");
  const filaCabecera = document.createElement("tr");
  config.campos.forEach((c) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = c.etiqueta;
    filaCabecera.append(th);
  });
  if (editable) {
    const thAccion = document.createElement("th");
    thAccion.scope = "col";
    filaCabecera.append(thAccion);
  }
  thead.append(filaCabecera);
  const tbody = document.createElement("tbody");
  tabla.append(thead, tbody);

  const formAgregar = document.createElement("form");
  formAgregar.noValidate = true;
  formAgregar.style.marginTop = "16px";
  const gridAgregar = document.createElement("div");
  gridAgregar.className = "formulario-grid";
  config.campos.forEach((c) => {
    gridAgregar.append(construirCampo({ ...c, nombre: `${config.ruta}__${c.nombre}` }, ""));
  });
  const agregarBtn = document.createElement("button");
  agregarBtn.type = "submit";
  agregarBtn.className = "boton boton-pequeno";
  agregarBtn.textContent = `Agregar ${config.nombreSingular}`;
  const mensajeAgregar = document.createElement("div");
  formAgregar.append(gridAgregar, agregarBtn, mensajeAgregar);

  async function cargar() {
    mensaje.replaceChildren();
    const r = await api("GET", `/expedientes-diseno/${expedienteId}/${config.ruta}`);
    tbody.replaceChildren();
    if (r.status !== 200) {
      mensaje.append(alerta("error", `No se pudo cargar: ${config.titulo.toLowerCase()}.`));
      return;
    }
    const lista = r.cuerpo[config.clave] || [];
    if (lista.length === 0) {
      const fila = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = config.campos.length + (editable ? 1 : 0);
      td.className = "subtitulo";
      td.textContent = "Sin registros.";
      fila.append(td);
      tbody.append(fila);
      return;
    }
    lista.forEach((registro) => renderFila(registro));
  }

  function renderFila(registro) {
    const fila = document.createElement("tr");

    function renderVista() {
      fila.replaceChildren();
      config.campos.forEach((c) => {
        const td = document.createElement("td");
        const texto = valorMostrableSubrecurso(c, registro[c.nombre]);
        const tipo = tipoPillSubrecurso(c, registro[c.nombre]);
        if (tipo) td.append(pill(texto, tipo));
        else td.textContent = texto;
        fila.append(td);
      });
      if (!editable) return;
      const tdAccion = document.createElement("td");
      const editarBtn = boton("Editar", () => renderEdicion(), true);
      const eliminarBtn = boton(
        "Eliminar",
        async () => {
          if (!window.confirm(`¿Eliminar este/a ${config.nombreSingular}?`)) return;
          const r = await api(
            "DELETE",
            `/expedientes-diseno/${expedienteId}/${config.ruta}/${registro.id}`
          );
          if (r.status === 204) {
            cargar();
            return;
          }
          mensaje.replaceChildren(alerta("error", r.cuerpo?.error || "No se pudo eliminar."));
        },
        true
      );
      tdAccion.append(editarBtn, eliminarBtn);
      fila.append(tdAccion);
    }

    function renderEdicion() {
      fila.replaceChildren();
      const inputs = {};
      config.campos.forEach((c) => {
        const td = document.createElement("td");
        const input = construirInputCeldaSubrecurso(c, registro[c.nombre]);
        inputs[c.nombre] = input;
        td.append(input);
        fila.append(td);
      });
      const tdAccion = document.createElement("td");
      const guardarBtn = boton("Guardar", async () => {
        const datos = {};
        config.campos.forEach((c) => {
          const valor = inputs[c.nombre].value.trim();
          if (valor !== "") datos[c.nombre] = valor;
        });
        const faltantes = config.campos.filter((c) => c.requerido && !datos[c.nombre]);
        if (faltantes.length > 0) {
          mensaje.replaceChildren(alerta("error", "Completa los campos obligatorios."));
          return;
        }
        const r = await api(
          "PUT",
          `/expedientes-diseno/${expedienteId}/${config.ruta}/${registro.id}`,
          datos
        );
        if (r.status === 200) {
          cargar();
          return;
        }
        if (r.status === 400 && Array.isArray(r.cuerpo?.detalles)) {
          const mensajes = mostrarErroresValidacion(formAgregar, config.campos, r.cuerpo.detalles);
          mensaje.replaceChildren(alerta("error", mensajes.join(" · ")));
        } else {
          mensaje.replaceChildren(alerta("error", r.cuerpo?.error || "No se pudo guardar."));
        }
      });
      const cancelarBtn = boton("Cancelar", () => renderVista(), true);
      tdAccion.append(guardarBtn, cancelarBtn);
      fila.append(tdAccion);
    }

    renderVista();
    tbody.append(fila);
  }

  if (editable) {
    formAgregar.addEventListener("submit", async (evento) => {
      evento.preventDefault();
      mensajeAgregar.replaceChildren();
      const datos = {};
      config.campos.forEach((c) => {
        const valor = formAgregar.elements[`${config.ruta}__${c.nombre}`].value.trim();
        if (valor !== "") datos[c.nombre] = valor;
      });
      const faltantes = config.campos.filter((c) => c.requerido && !datos[c.nombre]);
      if (faltantes.length > 0) {
        mensajeAgregar.append(alerta("error", "Completa los campos obligatorios marcados con *."));
        return;
      }
      agregarBtn.disabled = true;
      try {
        const r = await api("POST", `/expedientes-diseno/${expedienteId}/${config.ruta}`, datos);
        if (r.status === 201) {
          formAgregar.reset();
          cargar();
          return;
        }
        if (r.status === 400 && Array.isArray(r.cuerpo?.detalles)) {
          const mensajes = mostrarErroresValidacion(formAgregar, config.campos, r.cuerpo.detalles);
          mensajeAgregar.append(alerta("error", mensajes.join(" · ")));
        } else {
          mensajeAgregar.append(alerta("error", r.cuerpo?.error || "No se pudo agregar."));
        }
      } catch (error) {
        if (error.message !== "sesion-expirada") {
          mensajeAgregar.append(alerta("error", "No hay conexión con el servidor."));
        }
      } finally {
        agregarBtn.disabled = false;
      }
    });
  }

  tarjeta.append(h3, mensaje, tabla);
  if (editable) tarjeta.append(formAgregar);
  await cargar();
  return tarjeta;
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

const CAMPOS_REPORTE = (clientes, proyectos) => [
  { nombre: "cliente_id", etiqueta: "Cliente", tipo: "select", requerido: true,
    opciones: clientes.map((c) => ({ valor: String(c.id), texto: c.nombre_razon_social })) },
  { nombre: "proyecto_id", etiqueta: "Proyecto (opcional)", tipo: "select",
    opciones: [{ valor: "", texto: "— Sin proyecto —" }, ...proyectos.map((p) => ({ valor: String(p.id), texto: p.nombre_proyecto }))] },
  { nombre: "equipo_numero_serie", etiqueta: "Número de serie del equipo", requerido: true },
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
  mostrarCargando();
  const [{ status, cuerpo }, clientes] = await Promise.all([
    api("GET", "/reportes-servicio-tecnico"),
    obtenerClientes(),
  ]);
  contenido.replaceChildren();

  if (status !== 200) {
    contenido.append(encabezado("Reportes de servicio"), alerta("error", "No se pudieron cargar los reportes."));
    return;
  }

  const nombreCliente = (idCliente) => clientes.find((c) => c.id === idCliente)?.nombre_razon_social || "—";

  const nuevo = boton("Nuevo reporte", () => (window.location.hash = "#/reportes-servicio/nuevo"));
  contenido.append(encabezado("Reportes de servicio técnico", [nuevo]));

  const reportes = cuerpo.reportes;
  if (reportes.length === 0) {
    const p = document.createElement("p");
    p.className = "subtitulo";
    p.textContent = "Aún no hay reportes de servicio registrados.";
    contenido.append(p);
    return;
  }

  const tarjeta = document.createElement("div");
  tarjeta.className = "tarjeta-ancha";
  const tabla = document.createElement("table");
  const thead = document.createElement("thead");
  const filaCabecera = document.createElement("tr");
  ["Equipo (N° serie)", "Cliente", "Tipo de servicio", "Fecha", ""].forEach((texto) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = texto;
    filaCabecera.append(th);
  });
  thead.append(filaCabecera);

  const tbody = document.createElement("tbody");
  reportes.forEach((r) => {
    const fila = document.createElement("tr");
    fila.append(celda(r.equipo_numero_serie));
    fila.append(celda(nombreCliente(r.cliente_id)));
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
  contenido.append(tarjeta);
}

async function vistaReporteServicioForm(id) {
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
  const volver = boton("Volver a reportes", () => (window.location.hash = "#/reportes-servicio"), true);
  contenido.append(encabezado(id ? "Editar reporte de servicio" : "Nuevo reporte de servicio", [volver]));

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
  guardar.textContent = id ? "Guardar cambios" : "Crear reporte";

  form.append(grid, guardar);
  if (!id) form.append(botonCancelar("#/reportes-servicio"));
  tarjeta.append(mensaje, form);
  contenido.append(tarjeta);

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
      const r = id
        ? await api("PUT", `/reportes-servicio-tecnico/${id}`, datos)
        : await api("POST", "/reportes-servicio-tecnico", datos);
      if (r.status === 200 || r.status === 201) {
        window.location.hash = "#/reportes-servicio";
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
}

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
  mostrarCargando();
  const [{ status, cuerpo }, proyectos, clientes] = await Promise.all([
    api("GET", "/actas-cierre-satisfaccion"),
    obtenerProyectos(),
    obtenerClientes(),
  ]);
  contenido.replaceChildren();

  if (status !== 200) {
    contenido.append(encabezado("Actas de cierre"), alerta("error", "No se pudieron cargar las actas."));
    return;
  }

  const nombreProyecto = (id) => proyectos.find((p) => p.id === id)?.nombre_proyecto || "—";
  const nombreCliente = (id) => clientes.find((c) => c.id === id)?.nombre_razon_social || "—";

  const nuevo = boton("Nueva acta", () => (window.location.hash = "#/actas-cierre/nuevo"));
  contenido.append(encabezado("Actas de cierre a satisfacción", [nuevo]));

  const actas = cuerpo.actas;
  if (actas.length === 0) {
    const p = document.createElement("p");
    p.className = "subtitulo";
    p.textContent = "Aún no hay actas de cierre registradas.";
    contenido.append(p);
    return;
  }

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
    [a.numero_acta, nombreProyecto(a.proyecto_id), nombreCliente(a.cliente_id)].forEach((valor) => {
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
  contenido.append(tarjeta);
}

async function vistaActaCierreForm(id) {
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
  const volver = boton("Volver a actas de cierre", () => (window.location.hash = "#/actas-cierre"), true);
  contenido.append(encabezado(id ? `Acta ${acta.numero_acta}` : "Nueva acta de cierre", [volver]));

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
  guardar.textContent = id ? "Guardar cambios" : "Crear acta";

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
      const r = id
        ? await api("PUT", `/actas-cierre-satisfaccion/${id}`, datos)
        : await api("POST", "/actas-cierre-satisfaccion", datos);
      if (r.status === 200 || r.status === 201) {
        window.location.hash = "#/actas-cierre";
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
}

async function obtenerActasEntrega() {
  const r = await api("GET", "/actas-entrega-equipos");
  return r.status === 200 ? r.cuerpo.actas : [];
}

async function vistaActasEntrega() {
  marcarMenu("actas-entrega");
  mostrarCargando();
  const [{ status, cuerpo }, proyectos, clientes] = await Promise.all([
    api("GET", "/actas-entrega-equipos"),
    obtenerProyectos(),
    obtenerClientes(),
  ]);
  contenido.replaceChildren();

  if (status !== 200) {
    contenido.append(encabezado("Actas de entrega de equipos"), alerta("error", "No se pudieron cargar las actas."));
    return;
  }

  const nombreProyecto = (id) => proyectos.find((p) => p.id === id)?.nombre_proyecto || "—";
  const nombreCliente = (id) => clientes.find((c) => c.id === id)?.nombre_razon_social || "—";

  const nuevo = boton("Nueva acta", () => (window.location.hash = "#/actas-entrega/nuevo"));
  contenido.append(encabezado("Actas de entrega de equipos", [nuevo]));

  const actas = cuerpo.actas;
  if (actas.length === 0) {
    const p = document.createElement("p");
    p.className = "subtitulo";
    p.textContent = "Aún no hay actas de entrega registradas.";
    contenido.append(p);
    return;
  }

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
    [a.numero_acta, nombreProyecto(a.proyecto_id), nombreCliente(a.cliente_id), a.lugar_entrega || "—"].forEach(
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
  contenido.append(tarjeta);
}

async function vistaActaEntregaForm(id) {
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
  const volver = boton("Volver a actas de entrega", () => (window.location.hash = "#/actas-entrega"), true);
  contenido.append(encabezado(id ? `Acta ${acta.numero_acta}` : "Nueva acta de entrega", [volver]));

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
  guardar.textContent = id ? "Guardar cambios" : "Crear acta";

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
      const r = id
        ? await api("PUT", `/actas-entrega-equipos/${id}`, datos)
        : await api("POST", "/actas-entrega-equipos", datos);
      if (r.status === 200 || r.status === 201) {
        window.location.hash = "#/actas-entrega";
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
}

const CARGOS = [
  "Asistente Administrativa y contable",
  "Asistente Gerencia Administrativa y Financiera",
  "Asistente Gerencial General",
  "Auxiliar Administrativo y de Facturacion",
  "Auxiliar contable",
  "Auxiliar de compras y almacen",
  "Auxiliar de ventas y logistica",
  "Contador General",
  "Coordinador Comercial",
  "Coordinador comercial de gases",
  "Coordinador de Almacén / Almacenista",
  "Coordinador de Compras",
  "Coordinador de Inventarios de gases",
  "Coordinador de Marketing y Publicidad",
  "Coordinador de Talento Humano",
  "Director Administrativo y Financiero",
  "Director de Operaciones y Producción",
  "Director Tecnico Comercial– Chile",
  "Director Tecnico de Gases QF",
  "Gerente Comercial",
  "Gerente General",
  "Gestor Comercial",
  "Gestor Comercial - Gases",
  "Gestora Comercial de Licitaciones y Contratos",
  "Ingeniero de diseño y producción",
  "Jefe de Control de Calidad",
  "Jefe de I+D+i",
  "Jefe de Produccion e Instalaciones",
  "Jefe de Proyectos",
  "Jefe de Soporte Tecnico y mantenimiento",
  "Jefe Produccion de Equipos",
  "Jefe Produccion de Gases e instalaciones",
  "Jefe Sistema Integrado De Gestion",
  "Líder de Marketing 360° y Creador de Contenido",
  "Operario de Planta",
  "Técnico Mantenimiento y Ensamble",
];

const CAMPOS_USUARIO = [
  { nombre: "nombre", etiqueta: "Nombre completo", requerido: true },
  { nombre: "correo", etiqueta: "Correo", tipo: "email", requerido: true },
  { nombre: "cedula", etiqueta: "Cédula", requerido: true },
  { nombre: "cargo", etiqueta: "Cargo", tipo: "select", requerido: true, opciones: CARGOS },
  { nombre: "rol", etiqueta: "Rol en el sistema", requerido: true },
  { nombre: "password", etiqueta: "Contraseña temporal", tipo: "password", requerido: true },
];

async function vistaUsuarios() {
  marcarMenu("usuarios");
  mostrarCargando();
  const { status, cuerpo } = await api("GET", "/usuarios");
  contenido.replaceChildren();

  if (status !== 200) {
    contenido.append(encabezado("Usuarios"), alerta("error", "No se pudieron cargar los usuarios."));
    return;
  }

  const nuevo = boton("Nuevo usuario", () => (window.location.hash = "#/usuarios/nuevo"));
  contenido.append(encabezado("Usuarios", [nuevo]));

  const usuarios = cuerpo.usuarios;
  if (usuarios.length === 0) {
    const p = document.createElement("p");
    p.className = "subtitulo";
    p.textContent = "Aún no hay usuarios registrados.";
    contenido.append(p);
    return;
  }

  const tarjeta = document.createElement("div");
  tarjeta.className = "tarjeta-ancha";
  const tabla = document.createElement("table");
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");
  tabla.append(thead, tbody);
  tarjeta.append(tabla);
  contenido.append(tarjeta);

  const COLUMNAS_ORDENABLES = [
    { texto: "Nombre", campo: "nombre" },
    { texto: "Correo", campo: "correo" },
    { texto: "Cédula", campo: "cedula" },
    { texto: "Cargo", campo: "cargo" },
    { texto: "Rol", campo: "rol" },
  ];

  let campoOrden = "nombre";
  let ascendente = true;

  function renderTabla() {
    const ordenados = [...usuarios].sort((a, b) => {
      const valorA = (a[campoOrden] || "").toString();
      const valorB = (b[campoOrden] || "").toString();
      return ascendente
        ? valorA.localeCompare(valorB, "es")
        : valorB.localeCompare(valorA, "es");
    });

    filaCabecera.replaceChildren();
    COLUMNAS_ORDENABLES.forEach((columna) => {
      const th = document.createElement("th");
      th.scope = "col";
      th.style.cursor = "pointer";
      th.setAttribute("role", "button");
      th.setAttribute("tabindex", "0");
      const indicador = columna.campo === campoOrden ? (ascendente ? " ▲" : " ▼") : "";
      th.textContent = columna.texto + indicador;
      const activar = () => {
        if (campoOrden === columna.campo) {
          ascendente = !ascendente;
        } else {
          campoOrden = columna.campo;
          ascendente = true;
        }
        renderTabla();
      };
      th.addEventListener("click", activar);
      th.addEventListener("keydown", (evento) => {
        if (evento.key === "Enter" || evento.key === " ") {
          evento.preventDefault();
          activar();
        }
      });
      filaCabecera.append(th);
    });
    const thAcciones = document.createElement("th");
    thAcciones.scope = "col";
    filaCabecera.append(thAcciones);

    tbody.replaceChildren();
    ordenados.forEach((u) => {
      const fila = document.createElement("tr");
      [u.nombre, u.correo, u.cedula || "—", u.cargo || "—", u.rol].forEach((valor) => {
        fila.append(celda(valor));
      });
      const accion = document.createElement("td");
      const editar = boton(
        "Editar",
        () => (window.location.hash = `#/usuarios/${u.id}/editar`),
        true
      );
      editar.setAttribute("aria-label", `Editar usuario ${u.nombre}`);
      accion.append(editar);
      fila.append(accion);
      tbody.append(fila);
    });
  }

  const filaCabecera = document.createElement("tr");
  thead.append(filaCabecera);
  renderTabla();
}

async function vistaUsuarioForm(id) {
  marcarMenu("usuarios");
  mostrarCargando();
  contenido.replaceChildren();

  let usuario = null;
  if (id) {
    const r = await api("GET", "/usuarios");
    if (r.status !== 200) {
      contenido.append(
        encabezado("Usuario"),
        alerta("error", "No se pudieron cargar los usuarios.")
      );
      return;
    }
    usuario = r.cuerpo.usuarios.find((u) => String(u.id) === String(id));
    if (!usuario) {
      contenido.append(encabezado("Usuario"), alerta("error", "Usuario no encontrado."));
      return;
    }
  }

  const campos = id ? CAMPOS_USUARIO.filter((c) => c.nombre !== "password") : CAMPOS_USUARIO;

  const volver = boton("Volver a usuarios", () => (window.location.hash = "#/usuarios"), true);
  contenido.append(encabezado(id ? `Editar ${usuario.nombre}` : "Nuevo usuario", [volver]));

  const tarjeta = document.createElement("div");
  tarjeta.className = "tarjeta-ancha";
  const mensaje = document.createElement("div");
  const form = document.createElement("form");
  form.noValidate = true;
  const grid = document.createElement("div");
  grid.className = "formulario-grid";

  campos.forEach((config) => {
    grid.append(construirCampo(config, usuario ? usuario[config.nombre] ?? "" : ""));
  });

  const guardar = document.createElement("button");
  guardar.type = "submit";
  guardar.className = "boton boton-pequeno";
  guardar.textContent = id ? "Guardar cambios" : "Crear usuario";

  form.append(grid, guardar);
  if (!id) form.append(botonCancelar("#/usuarios"));
  tarjeta.append(mensaje, form);
  contenido.append(tarjeta);

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    mensaje.replaceChildren();
    const datos = {};
    campos.forEach((config) => {
      const valor = form.elements[config.nombre].value.trim();
      if (valor !== "") datos[config.nombre] = valor;
    });
    const faltantes = campos.filter((c) => c.requerido && !datos[c.nombre]);
    if (faltantes.length > 0) {
      mensaje.append(alerta("error", "Completa los campos obligatorios marcados con *."));
      return;
    }
    if (!id && !confirmarCreacion("este usuario")) return;

    guardar.disabled = true;
    try {
      const r = id
        ? await api("PUT", `/usuarios/${id}`, datos)
        : await api("POST", "/usuarios", datos);
      if (r.status === 200 || r.status === 201) {
        window.location.hash = "#/usuarios";
        return;
      }
      if (r.status === 409) {
        mensaje.append(alerta("error", r.cuerpo?.error || "Ese correo o cédula ya está registrado."));
      } else if (r.status === 403) {
        mensaje.append(alerta("error", "No tienes permisos para esta acción."));
      } else if (r.status === 400 && Array.isArray(r.cuerpo?.detalles)) {
        const mensajes = mostrarErroresValidacion(form, campos, r.cuerpo.detalles);
        mensaje.append(alerta("error", mensajes.join(" · ")));
      } else {
        mensaje.append(alerta("error", r.cuerpo?.error || "No se pudo guardar el usuario."));
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

function enrutar() {
  const ruta = window.location.hash || "#/tablero";

  // Definida en tableros.js (se carga antes que este archivo).
  if (/^#\/tablero$/.test(ruta)) return window.vistaTableroGerencial();

  if (/^#\/clientes\/nuevo$/.test(ruta)) return vistaClienteForm(null);
  const editarCliente = ruta.match(/^#\/clientes\/(\d+)$/);
  if (editarCliente) return vistaClienteForm(editarCliente[1]);
  if (/^#\/clientes$/.test(ruta)) return vistaClientes();

  if (/^#\/proyectos\/nuevo$/.test(ruta)) return vistaProyectoForm(null);
  const editarProyecto = ruta.match(/^#\/proyectos\/(\d+)$/);
  if (editarProyecto) return vistaProyectoForm(editarProyecto[1]);
  if (/^#\/proyectos$/.test(ruta)) return vistaProyectos();

  if (/^#\/cotizaciones\/nuevo$/.test(ruta)) return vistaCotizacionForm(null);
  const editarCotizacion = ruta.match(/^#\/cotizaciones\/(\d+)$/);
  if (editarCotizacion) return vistaCotizacionForm(editarCotizacion[1]);
  if (/^#\/cotizaciones$/.test(ruta)) return vistaCotizaciones();

  if (/^#\/proveedores\/nuevo$/.test(ruta)) return vistaProveedorForm(null);
  const editarProveedor = ruta.match(/^#\/proveedores\/(\d+)$/);
  if (editarProveedor) return vistaProveedorForm(editarProveedor[1]);
  if (/^#\/proveedores$/.test(ruta)) return vistaProveedores();

  if (/^#\/requisiciones\/nuevo$/.test(ruta)) return vistaRequisicionForm(null);
  const editarRequisicion = ruta.match(/^#\/requisiciones\/(\d+)$/);
  if (editarRequisicion) return vistaRequisicionForm(editarRequisicion[1]);
  if (/^#\/requisiciones$/.test(ruta)) return vistaRequisiciones();

  if (/^#\/ordenes-compra\/nuevo$/.test(ruta)) return vistaOrdenCompraForm(null);
  const editarOC = ruta.match(/^#\/ordenes-compra\/(\d+)$/);
  if (editarOC) return vistaOrdenCompraForm(editarOC[1]);
  if (/^#\/ordenes-compra$/.test(ruta)) return vistaOrdenesCompra();

  if (/^#\/expedientes-diseno\/nuevo$/.test(ruta)) return vistaExpedienteForm(null);
  const editarExpediente = ruta.match(/^#\/expedientes-diseno\/(\d+)$/);
  if (editarExpediente) return vistaExpedienteForm(editarExpediente[1]);
  if (/^#\/expedientes-diseno$/.test(ruta)) return vistaExpedientes();

  if (/^#\/reportes-servicio\/nuevo$/.test(ruta)) return vistaReporteServicioForm(null);
  const editarReporte = ruta.match(/^#\/reportes-servicio\/(\d+)$/);
  if (editarReporte) return vistaReporteServicioForm(editarReporte[1]);
  if (/^#\/reportes-servicio$/.test(ruta)) return vistaReportesServicio();

  if (/^#\/actas-cierre\/nuevo$/.test(ruta)) return vistaActaCierreForm(null);
  const editarActa = ruta.match(/^#\/actas-cierre\/(\d+)$/);
  if (editarActa) return vistaActaCierreForm(editarActa[1]);
  if (/^#\/actas-cierre$/.test(ruta)) return vistaActasCierre();

  if (/^#\/actas-entrega\/nuevo$/.test(ruta)) return vistaActaEntregaForm(null);
  const editarActaEntrega = ruta.match(/^#\/actas-entrega\/(\d+)$/);
  if (editarActaEntrega) return vistaActaEntregaForm(editarActaEntrega[1]);
  if (/^#\/actas-entrega$/.test(ruta)) return vistaActasEntrega();

  if (/^#\/usuarios\/nuevo$/.test(ruta)) return vistaUsuarioForm();
  const editarUsuario = ruta.match(/^#\/usuarios\/(\d+)\/editar$/);
  if (editarUsuario) return vistaUsuarioForm(editarUsuario[1]);
  if (/^#\/usuarios$/.test(ruta)) return vistaUsuarios();

  return window.vistaTableroGerencial();
}

document.getElementById("cerrar-sesion").addEventListener("click", cerrarSesion);

(function inicializarMenuColapsable() {
  const app = document.querySelector(".app");
  const btn = document.getElementById("btn-colapsar-menu");
  let colapsado = false;
  try {
    colapsado = window.localStorage.getItem("menu-colapsado") === "1";
  } catch {
    colapsado = false;
  }
  const aplicar = () => {
    app.classList.toggle("menu-colapsado", colapsado);
    btn.setAttribute("aria-expanded", String(!colapsado));
    btn.setAttribute("aria-label", colapsado ? "Expandir menú" : "Contraer menú");
  };
  aplicar();
  btn.addEventListener("click", () => {
    colapsado = !colapsado;
    aplicar();
    try {
      window.localStorage.setItem("menu-colapsado", colapsado ? "1" : "0");
    } catch {
      // almacenamiento no disponible; la preferencia solo dura esta sesión
    }
  });
})();

let formularioSucio = false;
let rutaActual = window.location.hash || "#/";
let revirtiendoHash = false;

const observadorFormularios = new MutationObserver(() => {
  contenido.querySelectorAll("form").forEach((form) => {
    if (form.dataset.sucioVigilado) return;
    form.dataset.sucioVigilado = "1";
    form.addEventListener("input", () => {
      formularioSucio = true;
    });
    form.addEventListener("change", () => {
      formularioSucio = true;
    });
    form.addEventListener("submit", () => {
      formularioSucio = false;
    });
  });
});
observadorFormularios.observe(contenido, { childList: true, subtree: true });

window.addEventListener("beforeunload", (evento) => {
  if (formularioSucio) {
    evento.preventDefault();
    evento.returnValue = "";
  }
});

function manejarCambioHash() {
  if (revirtiendoHash) {
    revirtiendoHash = false;
    return;
  }
  const nuevaRuta = window.location.hash;
  if (formularioSucio && nuevaRuta !== rutaActual) {
    const continuar = window.confirm(
      "Tienes cambios sin guardar en este formulario. Si continúas, se perderán. ¿Deseas continuar?"
    );
    if (!continuar) {
      revirtiendoHash = true;
      window.location.hash = rutaActual;
      return;
    }
  }
  formularioSucio = false;
  rutaActual = nuevaRuta;
  enrutar();
}

window.addEventListener("hashchange", manejarCambioHash);
enrutar();
