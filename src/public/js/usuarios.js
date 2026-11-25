/* global
   PERFIL, alerta, api, boton, botonCancelar, celda, confirmarCreacion, construirCampo,
   contenido, encabezado, marcarMenu, mostrarCargando, mostrarErroresValidacion, pill, puede */
/* exported vistaUsuarioForm, vistaUsuarios */
// Usuarios: lista y formulario (la auditoría está en auditoria.js).

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

  // Crear y editar usuarios es del rol admin (el servidor responde 403 a los demás).
  const esAdmin = PERFIL.rol === "admin";
  const nuevo = boton("Nuevo usuario", () => (window.location.hash = "#/usuarios/nuevo"));
  contenido.append(encabezado("Usuarios", esAdmin ? [nuevo] : []));

  const usuarios = cuerpo.usuarios;
  if (usuarios.length === 0) {
    const p = document.createElement("p");
    p.className = "subtitulo";
    p.textContent = "Aún no hay usuarios registrados.";
    contenido.append(p);
    return;
  }

  // Lista corta: se filtra en el navegador (nombre, correo, cédula o cargo).
  const barra = document.createElement("div");
  barra.className = "controles-listado";
  const buscador = document.createElement("input");
  buscador.type = "search";
  buscador.placeholder = "Buscar por nombre, correo, cédula o cargo";
  buscador.setAttribute("aria-label", "Buscar usuarios");
  const resumen = document.createElement("span");
  resumen.className = "resumen-listado";
  resumen.setAttribute("aria-live", "polite");
  barra.append(buscador, resumen);
  buscador.addEventListener("input", () => renderTabla());

  const tarjeta = document.createElement("div");
  tarjeta.className = "tarjeta-ancha";
  const tabla = document.createElement("table");
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");
  tabla.append(thead, tbody);
  tarjeta.append(tabla);
  contenido.append(barra, tarjeta);

  const sinTildes = (texto) =>
    String(texto || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();

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
    const texto = sinTildes(buscador.value.trim());
    const visibles = texto
      ? usuarios.filter((u) =>
          [u.nombre, u.correo, u.cedula, u.cargo].some((v) => sinTildes(v).includes(texto))
        )
      : usuarios;
    resumen.textContent = `${visibles.length} ${visibles.length === 1 ? "usuario" : "usuarios"}`;
    const ordenados = [...visibles].sort((a, b) => {
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
      [u.nombre, u.correo, u.cedula || "—"].forEach((valor) => fila.append(celda(valor)));
      // Los permisos dependen del cargo: uno fuera del catálogo (usuarios
      // antiguos) se marca para corregirlo editando el usuario.
      const tdCargo = celda(u.cargo || "—");
      if (!u.cargo || !CARGOS.includes(u.cargo)) {
        const aviso = pill("Fuera del catálogo", "warn");
        aviso.title = "Asigna un cargo del catálogo: de él dependen sus permisos";
        tdCargo.append(" ", aviso);
      }
      fila.append(tdCargo, celda(u.rol));
      const accion = document.createElement("td");
      const editar = boton(
        "Editar",
        () => (window.location.hash = `#/usuarios/${u.id}/editar`),
        true
      );
      editar.setAttribute("aria-label", `Editar usuario ${u.nombre}`);
      if (esAdmin) accion.append(editar);
      if (puede("ver_auditoria")) {
        const actividad = boton(
          "Ver actividad",
          () => (window.location.hash = `#/auditoria?usuario=${u.id}`),
          true
        );
        actividad.setAttribute("aria-label", `Ver la actividad de ${u.nombre}`);
        accion.append(actividad);
      }
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
