/* global api */
/* exported
   construirCampo, enlazarClienteConProyectos, obtenerClientes, obtenerCotizaciones,
   obtenerProveedores, obtenerProyectos, obtenerRequisiciones, obtenerUsuarios */
// Piezas comunes de los formularios: construirCampo, opciones y los obtener* que llenan los
// selectores.

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

// Los selectores piden el máximo que admite el API (100); sin esto recibían
// solo la primera página (20) y los registros más antiguos no aparecían.
const PAGINA_SELECTORES = "?tamanoPagina=100";

async function obtenerClientes() {
  const r = await api("GET", `/clientes${PAGINA_SELECTORES}`);
  return r.status === 200 ? r.cuerpo.clientes : [];
}

async function obtenerUsuarios() {
  const r = await api("GET", "/usuarios");
  return r.status === 200 ? r.cuerpo.usuarios : [];
}

async function obtenerProyectos() {
  const r = await api("GET", `/proyectos${PAGINA_SELECTORES}`);
  return r.status === 200 ? r.cuerpo.proyectos : [];
}

async function obtenerCotizaciones() {
  const r = await api("GET", `/cotizaciones${PAGINA_SELECTORES}`);
  return r.status === 200 ? r.cuerpo.cotizaciones : [];
}

async function obtenerProveedores() {
  const r = await api("GET", `/proveedores${PAGINA_SELECTORES}`);
  return r.status === 200 ? r.cuerpo.proveedores : [];
}

async function obtenerRequisiciones() {
  const r = await api("GET", `/requisiciones${PAGINA_SELECTORES}`);
  return r.status === 200 ? r.cuerpo.requisiciones : [];
}

// Proyectos de un cliente como opciones de selector ("PRY-… · nombre").
function opcionesProyectosDeCliente(proyectos, clienteId, textoVacio = "— Elige un proyecto —") {
  return [
    { valor: "", texto: textoVacio },
    ...proyectos
      .filter((p) => !clienteId || String(p.cliente_id) === String(clienteId))
      .map((p) => ({ valor: String(p.id), texto: `${p.codigo_pry} · ${p.nombre_proyecto}` })),
  ];
}

function recargarSelect(select, opciones, valor = "") {
  select.replaceChildren(
    ...normalizarOpciones(opciones).map((op) => {
      const o = document.createElement("option");
      o.value = op.valor;
      o.textContent = op.texto;
      return o;
    })
  );
  select.value = valor;
  if (select.value !== String(valor)) select.value = "";
}

// Al cambiar el cliente, el selector de proyectos muestra solo los suyos.
function enlazarClienteConProyectos(form, proyectos) {
  const selectCliente = form.elements.cliente_id;
  const selectProyecto = form.elements.proyecto_id;
  if (!selectCliente || !selectProyecto) return;
  const filtrar = () =>
    recargarSelect(
      selectProyecto,
      opcionesProyectosDeCliente(proyectos, selectCliente.value),
      selectProyecto.value
    );
  selectCliente.addEventListener("change", filtrar);
  filtrar();
}
