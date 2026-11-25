/* global
   aplicarPermisosMenu, cargarPerfil, cerrarSesion, contenido, vistaActaCierreForm,
   vistaActaEntregaForm, vistaActasCierre, vistaActasEntrega, vistaClienteForm, vistaClientes,
   vistaCotizacionForm, vistaCotizaciones, vistaEquipoForm, vistaEquipos, vistaExpedienteForm,
   vistaExpedientes, vistaOrdenCompraForm, vistaOrdenesCompra, vistaProveedorForm,
   vistaProveedores, vistaProyectoForm, vistaProyectos, vistaReporteServicioForm,
   vistaReportesServicio, vistaRequisicionForm, vistaRequisiciones, vistaUsuarioForm,
   vistaUsuarios */
// Arranque de la aplicación: prellenado de formularios, enrutador, menú colapsable, aviso de
// cambios sin guardar y carga inicial. Se carga después de los demás scripts de inicio.

// "#/<módulo>/nuevo?proyecto=ID" (desde "Siguiente paso") o "?proveedor=ID"
// (desde la tarjeta del proveedor): el formulario abre con ese registro ya
// elegido.
const PREFIJOS_FORMULARIO = { proyecto: "proyecto_id", proveedor: "proveedor_id" };

function prefijarProyecto(consulta) {
  const parametros = new URLSearchParams(consulta);
  Object.entries(PREFIJOS_FORMULARIO).forEach(([parametro, campoId]) => {
    const id = parametros.get(parametro);
    const campo = document.getElementById(campoId);
    if (!id || !campo || ![...campo.options].some((o) => o.value === id)) return;
    campo.value = id;
    campo.dispatchEvent(new Event("change", { bubbles: true }));
  });
  formularioSucio = false; // venir prellenado no es un cambio del usuario
}

// Ruta que se está pintando. Evita pintar dos veces la misma a la vez (p. ej.
// la carga inicial tras leer el perfil y un cambio de hash en el mismo
// momento), que duplicaba vistas lentas como el expediente.
let rutaEnCurso = null;

function enrutar() {
  const hash = window.location.hash || "#/inicio";
  if (rutaEnCurso === hash) return undefined;
  rutaEnCurso = hash;
  const [ruta, consulta = ""] = hash.split("?");
  let resultado = enrutarRuta(ruta);
  if (consulta && /\/nuevo$/.test(ruta)) {
    resultado = Promise.resolve(resultado).then(() => prefijarProyecto(consulta));
  }
  return Promise.resolve(resultado).finally(() => {
    if (rutaEnCurso === hash) rutaEnCurso = null;
  });
}

function enrutarRuta(ruta) {

  // Tablero general (tableroGeneral.js) y gestor de tareas (tareas.js).
  if (/^#\/inicio$/.test(ruta)) return window.vistaTableroGeneral();
  if (/^#\/tareas\/nueva$/.test(ruta)) return window.vistaTareas({ nueva: true });
  const verTarea = ruta.match(/^#\/tareas\/(\d+)$/);
  if (verTarea) return window.vistaTareas({ tareaId: Number(verTarea[1]) });
  if (/^#\/tareas$/.test(ruta)) return window.vistaTareas();

  // Definidas en tableros.js (se carga antes que este archivo).
  if (/^#\/tablero$/.test(ruta)) return window.vistaTableroGerencial();
  if (/^#\/tiempos$/.test(ruta)) return window.vistaTiempos(); // tiemposKpi.js
  if (/^#\/comercial$/.test(ruta)) return window.vistaTableroComercial();
  if (/^#\/compras$/.test(ruta)) return window.vistaTableroCompras();
  // Resúmenes de Diseño, Soporte y Entregas (tablerosOperacion.js)
  if (/^#\/diseno$/.test(ruta)) return window.vistaTableroDiseno();
  if (/^#\/soporte$/.test(ruta)) return window.vistaTableroSoporte();
  if (/^#\/entregas$/.test(ruta)) return window.vistaTableroEntregas();

  // Nueva versión de un documento: #/<recurso>/<id>/nueva-version
  const nuevaVersion = ruta.match(
    /^#\/(proyectos|cotizaciones|ordenes-compra|actas-entrega|actas-cierre|reportes-servicio)\/(\d+)\/nueva-version$/
  );
  if (nuevaVersion) {
    const formularios = {
      proyectos: vistaProyectoForm,
      cotizaciones: vistaCotizacionForm,
      "ordenes-compra": vistaOrdenCompraForm,
      "actas-entrega": vistaActaEntregaForm,
      "actas-cierre": vistaActaCierreForm,
      "reportes-servicio": vistaReporteServicioForm,
    };
    return formularios[nuevaVersion[1]](nuevaVersion[2], { modoVersion: true });
  }

  if (/^#\/clientes\/nuevo$/.test(ruta)) return vistaClienteForm(null);
  const editarCliente = ruta.match(/^#\/clientes\/(\d+)$/);
  if (editarCliente) return vistaClienteForm(editarCliente[1]);
  if (/^#\/clientes$/.test(ruta)) return vistaClientes();

  if (/^#\/proyectos\/nuevo$/.test(ruta)) return vistaProyectoForm(null);
  // Enlace directo a una actividad (avisos y ventana "Actividades pendientes")
  const actividadProyecto = ruta.match(/^#\/proyectos\/(\d+)\/actividades\/(\d+)$/);
  if (actividadProyecto) {
    return vistaProyectoForm(actividadProyecto[1], { actividadId: actividadProyecto[2] });
  }
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

  if (/^#\/equipos\/nuevo$/.test(ruta)) return vistaEquipoForm(null);
  const verEquipo = ruta.match(/^#\/equipos\/(\d+)$/);
  if (verEquipo) return vistaEquipoForm(verEquipo[1]);
  if (/^#\/equipos$/.test(ruta)) return vistaEquipos();

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
  if (/^#\/copias$/.test(ruta)) return window.vistaCopias(); // copias.js
  // auditoria.js; el filtro (?usuario=ID) lo lee la vista
  if (/^#\/auditoria$/.test(ruta)) return window.vistaAuditoria();

  return window.vistaTableroGeneral();
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
// El perfil se carga antes de la primera vista: decide qué acciones se muestran.
cargarPerfil().finally(() => {
  aplicarPermisosMenu();
  enrutar();
});
