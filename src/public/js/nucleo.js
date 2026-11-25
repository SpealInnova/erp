/* global formatoFechaHora, normalizarOpciones */
/* exported
   alerta, aplicarPermisosMenu, botonCancelar, cargarPerfil, celda, confirmarCreacion,
   encabezado, estadoPill, marcarMenu, mostrarCargando, mostrarErroresValidacion,
   notaSinPermisoEstado, opcionesSegunPermiso, puedeAprobarDocumento */
// Núcleo de la aplicación: sesión y api(), perfil y permisos, piezas de interfaz (alerta, pill,
// boton…), menú y pestañas de módulo, barra superior y notificaciones.

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

/* Perfil del usuario (cargo y permisos, de GET /auth/perfil). Solo decide qué
   acciones se muestran: el servidor valida cada una de todas formas. Sin
   perfil, no se muestra ninguna acción restringida. */
let PERFIL = { id: null, rol: null, cargo: null, permisos: [], superusuario: false };

async function cargarPerfil() {
  try {
    const r = await api("GET", "/auth/perfil");
    if (r.status === 200 && r.cuerpo?.usuario) {
      PERFIL = { ...PERFIL, ...r.cuerpo.usuario, permisos: r.cuerpo.usuario.permisos || [] };
    }
  } catch {
    // sin perfil: las acciones restringidas quedan ocultas
  }
}

function puede(permiso) {
  return PERFIL.permisos.includes(permiso);
}

// Muestra los enlaces del menú marcados con data-permiso solo a quien lo tiene.
function aplicarPermisosMenu() {
  document.querySelectorAll(".menu [data-permiso]").forEach((el) => {
    el.hidden = !puede(el.dataset.permiso);
  });
}

// Aprobar exige el permiso y, salvo admin o Gerente General, no haber creado
// el documento (separación de funciones, igual que en el servidor).
function puedeAprobarDocumento(permiso, creadoPor) {
  return puede(permiso) && (PERFIL.superusuario || !creadoPor || creadoPor !== PERFIL.id);
}

// Opciones de un selector de estado que el usuario puede elegir; la actual
// siempre se incluye.
function opcionesSegunPermiso(opciones, actual, permitido) {
  return opciones.filter((o) => o.valor === actual || permitido(o.valor));
}

function notaSinPermisoEstado(texto) {
  const p = document.createElement("p");
  p.className = "subtitulo";
  p.textContent = texto;
  return p;
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
    { seccion: "resumen-comercial", texto: "Resumen", ruta: "#/comercial" },
    { seccion: "cotizaciones", texto: "Cotizaciones", ruta: "#/cotizaciones" },
    { seccion: "clientes", texto: "Clientes", ruta: "#/clientes" },
  ],
  compras: [
    { seccion: "resumen-compras", texto: "Resumen", ruta: "#/compras" },
    { seccion: "requisiciones", texto: "Requisiciones", ruta: "#/requisiciones" },
    { seccion: "ordenes-compra", texto: "Órdenes de compra", ruta: "#/ordenes-compra" },
    { seccion: "proveedores", texto: "Proveedores", ruta: "#/proveedores" },
  ],
  diseno: [
    { seccion: "resumen-diseno", texto: "Resumen", ruta: "#/diseno" },
    { seccion: "expedientes-diseno", texto: "Expedientes", ruta: "#/expedientes-diseno" },
  ],
  soporte: [
    { seccion: "resumen-soporte", texto: "Resumen", ruta: "#/soporte" },
    { seccion: "reportes-servicio", texto: "Reportes de servicio", ruta: "#/reportes-servicio" },
    { seccion: "equipos", texto: "Equipos", ruta: "#/equipos" },
  ],
  entregas: [
    { seccion: "resumen-entregas", texto: "Resumen", ruta: "#/entregas" },
    { seccion: "actas-entrega", texto: "Actas de entrega", ruta: "#/actas-entrega" },
    { seccion: "actas-cierre", texto: "Actas de cierre", ruta: "#/actas-cierre" },
  ],
  // "permiso": la pestaña solo aparece a quien lo tiene (el servidor también
  // lo exige)
  usuarios: [
    { seccion: "usuarios", texto: "Usuarios", ruta: "#/usuarios" },
    { seccion: "auditoria", texto: "Auditoría", ruta: "#/auditoria", permiso: "ver_auditoria" },
  ],
};

const MODULO_DE_SECCION = {};
Object.entries(SECCIONES_POR_MODULO).forEach(([modulo, secciones]) => {
  secciones.forEach((s) => (MODULO_DE_SECCION[s.seccion] = modulo));
});

function pintarPestanasModulo(modulo, seccionActual) {
  const nav = document.getElementById("subtabs");
  if (!nav) return;
  const secciones = (SECCIONES_POR_MODULO[modulo] || []).filter(
    (s) => !s.permiso || puede(s.permiso)
  );
  // con una sola pestaña visible no hace falta la barra
  if (secciones.length < 2) {
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
    // contains(): el clic suele caer en el ícono (svg) dentro del botón
    if (!panel.classList.contains("oculto") && !panel.contains(evento.target) && !boton.contains(evento.target)) {
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
// Arranca cuando ya cargaron todos los scripts de la aplicación: lo que pinta
// usa piezas de otros archivos (p. ej. formatoFechaHora, en documentos.js).
document.addEventListener("DOMContentLoaded", inicializarNotificaciones);
