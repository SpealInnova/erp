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

function mostrarCargando() {
  contenido.replaceChildren();
  const p = document.createElement("p");
  p.className = "subtitulo";
  p.textContent = "Cargando…";
  contenido.append(p);
}

function marcarMenu(modulo) {
  document.querySelectorAll(".menu a[data-modulo]").forEach((a) => {
    if (a.dataset.modulo === modulo) {
      a.setAttribute("aria-current", "page");
    } else {
      a.removeAttribute("aria-current");
    }
  });
}

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
        const td = document.createElement("td");
        td.textContent = valor;
        fila.append(td);
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

let _clientesCache = null;
async function obtenerClientes() {
  if (!_clientesCache) {
    const r = await api("GET", "/clientes");
    _clientesCache = r.status === 200 ? r.cuerpo.clientes : [];
  }
  return _clientesCache;
}

let _usuariosCache = null;
async function obtenerUsuarios() {
  if (!_usuariosCache) {
    const r = await api("GET", "/usuarios");
    _usuariosCache = r.status === 200 ? r.cuerpo.usuarios : [];
  }
  return _usuariosCache;
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
      textoEstadoProyecto(p.estado),
      nombreUsuario(p.responsable_id),
    ].forEach((valor) => {
      const td = document.createElement("td");
      td.textContent = valor;
      fila.append(td);
    });
    const accion = document.createElement("td");
    const editar = boton(
      "Ver / Editar",
      () => (window.location.hash = `#/proyectos/${p.id}`),
      true
    );
    editar.setAttribute("aria-label", `Ver proyecto ${p.codigo_pry}`);
    accion.append(editar);
    fila.append(accion);
    tbody.append(fila);
  });

  tabla.append(thead, tbody);
  tarjeta.append(tabla);
  contenido.append(tarjeta);
}

async function vistaProyectoForm(id) {
  marcarMenu("proyectos");
  mostrarCargando();

  const [clientes, usuarios] = await Promise.all([obtenerClientes(), obtenerUsuarios()]);
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
        {
          nombre: "responsable_id",
          etiqueta: "Responsable",
          tipo: "select",
          requerido: true,
          opciones: opcionesUsuarios,
        },
        { nombre: "nombre_proyecto", etiqueta: "Nombre del proyecto", requerido: true },
        { nombre: "linea_negocio", etiqueta: "Línea de negocio" },
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
      ];

  camposProyecto.forEach((config) => {
    let valor = "";
    if (proyecto) {
      if (config.nombre === "cliente") valor = nombreClienteDe(clientes, proyecto.cliente_id);
      else if (config.nombre === "responsable_id") valor = String(proyecto.responsable_id);
      else valor = proyecto[config.nombre];
    }
    grid.append(construirCampo(config, valor));
  });

  const guardar = document.createElement("button");
  guardar.type = "submit";
  guardar.className = "boton boton-pequeno";
  guardar.textContent = id ? "Guardar cambios" : "Crear proyecto";

  form.append(grid, guardar);
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
      mensaje.append(alerta("error", r.cuerpo?.error || "No se pudo guardar el proyecto."));
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
    subtitulo.textContent = `Fase actual: ${textoEstadoProyecto(proyecto.estado)}`;
    bloqueFase.append(subtitulo);

    const mensajeFase = document.createElement("div");
    const filaFase = document.createElement("div");
    filaFase.className = "formulario-grid";
    filaFase.append(
      construirCampo(
        { nombre: "nueva_fase", etiqueta: "Cambiar a la fase", tipo: "select", opciones: ESTADOS_PROYECTO },
        proyecto.estado
      )
    );
    const botonFase = boton("Actualizar fase", async () => {
      mensajeFase.replaceChildren();
      const nuevaFase = document.getElementById("nueva_fase").value;
      const r = await api("PATCH", `/proyectos/${id}/estado`, { estado: nuevaFase });
      if (r.status === 200) {
        vistaProyectoForm(id);
        return;
      }
      mensajeFase.append(alerta("error", r.cuerpo?.error || "No se pudo cambiar la fase."));
    });

    bloqueFase.append(filaFase, botonFase, mensajeFase);
    tarjeta.append(bloqueFase);
  }
}

function nombreClienteDe(clientes, id) {
  return clientes.find((c) => c.id === id)?.nombre_razon_social || "—";
}

function enrutar() {
  const ruta = window.location.hash || "#/clientes";

  if (/^#\/clientes\/nuevo$/.test(ruta)) return vistaClienteForm(null);
  const editarCliente = ruta.match(/^#\/clientes\/(\d+)$/);
  if (editarCliente) return vistaClienteForm(editarCliente[1]);
  if (/^#\/clientes$/.test(ruta)) return vistaClientes();

  if (/^#\/proyectos\/nuevo$/.test(ruta)) return vistaProyectoForm(null);
  const editarProyecto = ruta.match(/^#\/proyectos\/(\d+)$/);
  if (editarProyecto) return vistaProyectoForm(editarProyecto[1]);
  if (/^#\/proyectos$/.test(ruta)) return vistaProyectos();

  return vistaClientes();
}

document.getElementById("cerrar-sesion").addEventListener("click", cerrarSesion);
window.addEventListener("hashchange", enrutar);
enrutar();
