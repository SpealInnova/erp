/* global
   alerta, api, boton, celda, pill, puede, textoEstadoCotizacion, textoEstadoExpediente,
   textoEstadoOrdenCompra, textoEstadoProyecto, textoEstadoRequisicion, textoProcedencia,
   textoTipoEntrega, textoTipoServicio, tipoPillCotizacion, tipoPillExpediente,
   tipoPillOrdenCompra, tipoPillRequisicion, tipoPillTipoEntrega, tipoPillTipoServicio */
/* exported
   bloqueModoVersion, bloqueoEliminacionProyecto, describirEventoLineaTiempo, guardarDocumento,
   renderPanelVersiones, selectorVista */
// Documentos del proyecto, versiones de documentos, textos de la línea de tiempo, bloqueo de
// eliminación y selector Tarjetas/Tabla.

/* ------------------------------------------------------------------
   Documentos del proyecto: todo lo que los demás módulos tienen
   enlazado a este proyecto, en el orden del flujo, en una sola franja.
   ------------------------------------------------------------------ */
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function fechaCortaTexto(iso) {
  if (!iso) return "sin fecha";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MESES_CORTOS[m - 1]} ${y}`;
}

function formatearCop(valor) {
  return `$${Math.round(Number(valor) || 0).toLocaleString("es-CO")}`;
}

// Cada columna: título, ruta para abrir cada documento y cómo describirlo.
function columnasDocumentosProyecto(docs) {
  const pillDe = (texto, tipo) => ({ texto, tipo });
  return [
    {
      titulo: "Cotización",
      items: docs.cotizacion ? [docs.cotizacion] : [],
      vacio: "Sin cotización de origen",
      enlace: (c) => `#/cotizaciones/${c.id}`,
      codigo: (c) => c.numero_cotizacion,
      pill: (c) => pillDe(textoEstadoCotizacion(c.estado), tipoPillCotizacion(c.estado)),
      lineas: (c) => [formatearCop(c.valor)],
    },
    {
      titulo: "Expedientes de diseño",
      items: docs.expedientes,
      vacio: "Sin expedientes",
      crear: "#/expedientes-diseno/nuevo",
      enlace: (e) => `#/expedientes-diseno/${e.id}`,
      codigo: (e) => e.codigo_expediente,
      pill: (e) => pillDe(textoEstadoExpediente(e.estado_liberacion), tipoPillExpediente(e.estado_liberacion)),
      lineas: (e) => [e.producto_nombre, e.numero_serie ? `Serie ${e.numero_serie}` : "Sin número de serie"],
    },
    {
      titulo: "Requisiciones",
      items: docs.requisiciones,
      vacio: "Sin requisiciones",
      crear: "#/requisiciones/nuevo",
      enlace: (r) => `#/requisiciones/${r.id}`,
      codigo: (r) => r.numero_requisicion,
      pill: (r) => pillDe(textoEstadoRequisicion(r.estado), tipoPillRequisicion(r.estado)),
      lineas: (r) => [`${textoProcedencia(r.procedencia)} · ${r.items} ítem${r.items === 1 ? "" : "s"}`, fechaCortaTexto(r.creada)],
    },
    {
      titulo: "Órdenes de compra",
      items: docs.ordenes_compra,
      vacio: "Sin órdenes de compra",
      enlace: (o) => `#/ordenes-compra/${o.id}`,
      codigo: (o) => o.numero_oc,
      pill: (o) => pillDe(textoEstadoOrdenCompra(o.estado), tipoPillOrdenCompra(o.estado)),
      lineas: (o) => [o.proveedor, `${formatearCop(o.valor)} · ${o.numero_requisicion}`],
    },
    {
      titulo: "Actas de entrega",
      items: docs.actas_entrega,
      vacio: "Sin actas de entrega",
      crear: "#/actas-entrega/nuevo",
      enlace: (a) => `#/actas-entrega/${a.id}`,
      codigo: (a) => a.numero_acta,
      pill: null,
      lineas: (a) => [`${a.equipos} equipo${a.equipos === 1 ? "" : "s"} · recibe ${a.receptor_nombre}`, fechaCortaTexto(a.fecha_elaboracion)],
    },
    {
      titulo: "Actas de cierre",
      items: docs.actas_cierre,
      vacio: "Sin actas de cierre",
      crear: "#/actas-cierre/nuevo",
      enlace: (a) => `#/actas-cierre/${a.id}`,
      codigo: (a) => a.numero_acta,
      pill: (a) => pillDe(textoTipoEntrega(a.tipo_entrega), tipoPillTipoEntrega(a.tipo_entrega)),
      lineas: (a) => [
        a.acta_entrega_numero ? `Cierra ${a.acta_entrega_numero}` : "Sin acta de entrega enlazada",
        fechaCortaTexto(a.fecha_elaboracion),
      ],
    },
    {
      titulo: "Reportes de servicio",
      items: docs.reportes_servicio,
      vacio: "Sin reportes de servicio",
      crear: "#/reportes-servicio/nuevo",
      enlace: (r) => `#/reportes-servicio/${r.id}`,
      codigo: (r) => r.numero_reporte,
      pill: (r) => pillDe(textoTipoServicio(r.tipo_servicio), tipoPillTipoServicio(r.tipo_servicio)),
      lineas: (r) => [
        `Equipo ${r.equipo_numero_serie}${r.en_garantia ? " · en garantía" : ""}`,
        `${fechaCortaTexto(r.fecha_servicio || r.creado)} · ${r.tecnico || "—"}`,
        // mantenimiento de un equipo de este proyecto registrado en otro del cliente
        ...(r.nota ? [r.nota] : []),
      ],
    },
  ];
}

// opciones.conCrear: cada paso que se puede crear desde aquí ofrece
// "+ Crear", con el proyecto ya elegido en el formulario (?proyecto=ID).
async function renderSeccionDocumentosProyecto(proyectoId, opciones = {}) {
  const bloque = document.createElement("section");
  bloque.className = "docs-proyecto";
  bloque.setAttribute("aria-labelledby", "docs-proyecto-titulo");

  const cabecera = document.createElement("div");
  cabecera.className = "docs-cabecera";
  const titulo = document.createElement("h3");
  titulo.id = "docs-proyecto-titulo";
  titulo.textContent = "Documentos del proyecto";
  const resumen = document.createElement("div");
  resumen.className = "docs-resumen";
  cabecera.append(titulo, resumen);
  bloque.append(cabecera);

  const r = await api("GET", `/proyectos/${proyectoId}/documentos`);
  if (r.status !== 200) {
    bloque.append(alerta("error", "No se pudieron cargar los documentos del proyecto."));
    return bloque;
  }
  const docs = r.cuerpo.documentos;

  const cifras = [
    ["Cotizado", docs.resumen.valor_cotizado === null ? "—" : formatearCop(docs.resumen.valor_cotizado)],
    ["Comprometido en OC", formatearCop(docs.resumen.comprometido_oc)],
    ["Pagado", formatearCop(docs.resumen.pagado_oc)],
  ];
  cifras.forEach(([etiqueta, valor]) => {
    const cifra = document.createElement("span");
    const b = document.createElement("b");
    b.textContent = valor;
    cifra.append(`${etiqueta} `, b);
    resumen.append(cifra);
  });

  const columnas = columnasDocumentosProyecto(docs);
  const conAlertas = columnas.flatMap((c) => c.items).filter((d) => d.alertas?.length).length;
  if (conAlertas) {
    bloque.append(
      alerta(
        "aviso",
        `${conAlertas} documento${conAlertas === 1 ? "" : "s"} con enlaces que no corresponden a este proyecto (marcados abajo). ` +
          "Ábrelos para corregir el proyecto, el cliente o el equipo."
      )
    );
  }

  const flujo = document.createElement("div");
  flujo.className = "docs-flujo";
  columnas.forEach((col) => {
    const columna = document.createElement("div");
    columna.className = "docs-col";
    const encabezadoCol = document.createElement("div");
    encabezadoCol.className = "docs-col-titulo";
    const nombre = document.createElement("span");
    nombre.textContent = col.titulo;
    const cantidad = document.createElement("span");
    cantidad.className = "docs-cantidad";
    cantidad.textContent = String(col.items.length);
    encabezadoCol.append(nombre, cantidad);
    columna.append(encabezadoCol);

    const lista = document.createElement("div");
    lista.className = "docs-lista";
    if (col.items.length === 0) {
      const vacio = document.createElement("p");
      vacio.className = "docs-vacio";
      vacio.textContent = col.vacio;
      lista.append(vacio);
    }
    col.items.forEach((doc) => {
      const item = document.createElement("a");
      item.className = doc.alertas?.length ? "docs-item con-alerta" : "docs-item";
      item.href = col.enlace(doc);
      const fila = document.createElement("div");
      fila.className = "docs-fila";
      const codigo = document.createElement("span");
      codigo.className = "docs-codigo";
      codigo.textContent = col.codigo(doc);
      fila.append(codigo);
      if (col.pill) {
        const p = col.pill(doc);
        fila.append(pill(p.texto, p.tipo));
      }
      item.append(fila);
      col.lineas(doc).forEach((texto) => {
        const linea = document.createElement("span");
        linea.className = "docs-linea";
        linea.textContent = texto;
        linea.title = texto;
        item.append(linea);
      });
      (doc.alertas || []).forEach((texto) => {
        const aviso = document.createElement("span");
        aviso.className = "docs-alerta";
        aviso.textContent = texto;
        item.append(aviso);
      });
      lista.append(item);
    });
    columna.append(lista);
    if (opciones.conCrear && col.crear) {
      const crear = document.createElement("a");
      crear.className = "docs-crear";
      crear.href = `${col.crear}?proyecto=${proyectoId}`;
      crear.textContent = col.items.length ? "+ Otro" : "+ Crear";
      crear.setAttribute("aria-label", `Crear ${col.titulo.toLowerCase()} para este proyecto`);
      columna.append(crear);
    }
    flujo.append(columna);
  });
  bloque.append(flujo);
  return bloque;
}

/* ------------------------------------------------------------------
   Versiones de documentos: un documento con enlaces no se elimina; se
   corrige con una nueva versión y la anterior queda, de solo lectura,
   en el historial con su vista previa.
   ------------------------------------------------------------------ */
const RECURSOS_VERSIONADOS = {
  proyectos: { tabla: "proyectos", api: "/proyectos", ruta: "#/proyectos", permiso: "versionar_proyecto" },
  cotizaciones: { tabla: "cotizaciones", api: "/cotizaciones", ruta: "#/cotizaciones", permiso: "versionar_cotizacion" },
  "ordenes-compra": { tabla: "ordenes_compra", api: "/ordenes-compra", ruta: "#/ordenes-compra", permiso: "versionar_oc" },
  "actas-entrega": { tabla: "actas_entrega_equipos", api: "/actas-entrega-equipos", ruta: "#/actas-entrega", permiso: "versionar_acta" },
  "actas-cierre": { tabla: "actas_cierre_satisfaccion", api: "/actas-cierre-satisfaccion", ruta: "#/actas-cierre", permiso: "versionar_acta" },
  "reportes-servicio": { tabla: "reportes_servicio_tecnico", api: "/reportes-servicio-tecnico", ruta: "#/reportes-servicio", permiso: "versionar_reporte" },
};

// Encabezado del modo "nueva versión": aviso + motivo obligatorio.
function bloqueModoVersion(versionActual) {
  const bloque = document.createElement("div");
  bloque.append(
    alerta(
      "aviso",
      `Estás creando la versión ${versionActual + 1}. La versión ${versionActual} quedará guardada, de solo lectura, en el historial del documento.`
    )
  );
  const campo = document.createElement("div");
  campo.className = "campo";
  const label = document.createElement("label");
  label.htmlFor = "motivo_version";
  label.textContent = "Motivo de la nueva versión *";
  const texto = document.createElement("textarea");
  texto.id = "motivo_version";
  texto.name = "motivo_version";
  texto.rows = 2;
  texto.required = true;
  texto.placeholder = "Qué se corrige y por qué";
  campo.append(label, texto);
  bloque.append(campo);
  return bloque;
}

// Guarda el documento: crear, editar o, en modo versión, nueva versión.
// Devuelve la respuesta de la API, o null si falta el motivo.
async function guardarDocumento(recurso, { id, modoVersion, datos, form, mensaje }) {
  const r = RECURSOS_VERSIONADOS[recurso];
  if (modoVersion) {
    const motivo = form.elements.motivo_version.value.trim();
    if (motivo.length < 5) {
      mensaje.append(alerta("error", "Explica el motivo de la nueva versión (qué se corrige y por qué)."));
      return null;
    }
    return api("POST", `${r.api}/${id}/versiones`, { ...datos, motivo });
  }
  return id ? api("PUT", `${r.api}/${id}`, datos) : api("POST", r.api, datos);
}

const ETIQUETAS_INSTANTANEA = {
  codigo_pry: "Código", nombre_proyecto: "Nombre", linea_negocio: "Línea de negocio",
  presupuesto_estimado: "Presupuesto estimado", estado: "Estado", numero_cotizacion: "Número",
  numero_oc: "Número", numero_acta: "Número", numero_reporte: "Número", fecha_validez: "Vigencia",
  objeto: "Objeto", lugar_entrega: "Lugar de entrega", receptor_nombre: "Recibe",
  receptor_identificacion: "Identificación de quien recibe", receptor_cargo: "Cargo de quien recibe",
  receptor_cliente_nombre: "Recibe", receptor_cliente_cargo: "Cargo de quien recibe",
  numero_contrato_oc: "Contrato u orden de compra", observaciones: "Observaciones",
  fecha_elaboracion: "Fecha de elaboración", tipo_entrega: "Tipo de entrega",
  tipo_documento_referencia: "Documento de referencia", numero_documento_referencia: "Número del documento",
  equipo_numero_serie: "Equipo", tipo_servicio: "Tipo de servicio", en_garantia: "En garantía",
  motivo: "Motivo", hallazgos: "Hallazgos", recomendaciones: "Recomendaciones",
  fecha_servicio: "Fecha de servicio", hora_inicio: "Hora de inicio", hora_fin: "Hora de fin",
  descripcion: "Descripción", descripcion_equipo: "Equipo", elemento: "Elemento", cantidad: "Cantidad",
  unidad: "Unidad", valor_unitario: "Valor unitario", precio_unitario: "Precio unitario",
  descuento_porcentaje: "Descuento %", iva_porcentaje: "IVA %", cumple: "Cumple", marca: "Marca",
  modelo: "Modelo", numero_serie: "Número de serie",
};
// Campos técnicos que no aportan a la vista previa.
const OCULTOS_INSTANTANEA = /^(id|version|created_at|updated_at|deleted_at|created_by|updated_by|drive_folder_id|.*_id|aprobado_en)$/;

function valorLegible(valor) {
  if (valor === null || valor === undefined || valor === "") return "—";
  if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}(T|$)/.test(valor)) return fechaCortaTexto(valor.slice(0, 10));
  // montos y cantidades con separador de miles (p. ej. 620.000.000)
  if (/^-?\d+(\.\d+)?$/.test(String(valor)) && Math.abs(Number(valor)) >= 1000) {
    return Number(valor).toLocaleString("es-CO", { maximumFractionDigits: 2 });
  }
  return String(valor);
}

function renderInstantanea(instantanea) {
  const vista = document.createElement("div");
  vista.className = "vista-version";
  const campos = document.createElement("dl");
  Object.entries(instantanea)
    .filter(([clave, valor]) => !OCULTOS_INSTANTANEA.test(clave) && !Array.isArray(valor))
    .forEach(([clave, valor]) => {
      const dt = document.createElement("dt");
      dt.textContent = ETIQUETAS_INSTANTANEA[clave] || clave.replace(/_/g, " ");
      const dd = document.createElement("dd");
      dd.textContent = valorLegible(valor);
      campos.append(dt, dd);
    });
  vista.append(campos);

  const items = Array.isArray(instantanea.items) ? instantanea.items : [];
  if (items.length) {
    const columnas = Object.keys(items[0]).filter((c) => !OCULTOS_INSTANTANEA.test(c));
    const tabla = document.createElement("table");
    const thead = document.createElement("thead");
    const fila = document.createElement("tr");
    columnas.forEach((c) => {
      const th = document.createElement("th");
      th.textContent = ETIQUETAS_INSTANTANEA[c] || c.replace(/_/g, " ");
      fila.append(th);
    });
    thead.append(fila);
    const tbody = document.createElement("tbody");
    items.forEach((item) => {
      const tr = document.createElement("tr");
      columnas.forEach((c) => tr.append(celda(valorLegible(item[c]))));
      tbody.append(tr);
    });
    tabla.append(thead, tbody);
    vista.append(tabla);
  }
  return vista;
}

// Panel de versiones de un documento: vigente, botón de nueva versión e
// historial de las reemplazadas con su vista previa.
async function renderPanelVersiones(recurso, id) {
  const { tabla, ruta, permiso } = RECURSOS_VERSIONADOS[recurso];
  const bloque = document.createElement("section");
  bloque.className = "docs-proyecto panel-versiones";
  const cabecera = document.createElement("div");
  cabecera.className = "docs-cabecera";
  const titulo = document.createElement("h3");
  titulo.textContent = "Versiones";
  cabecera.append(titulo);
  bloque.append(cabecera);

  const r = await api("GET", `/versiones/${tabla}/${id}`);
  if (r.status !== 200) {
    bloque.append(alerta("error", "No se pudo cargar el historial de versiones."));
    return bloque;
  }
  const { version_vigente: vigente, anteriores } = r.cuerpo;
  const acciones = document.createElement("div");
  acciones.className = "docs-resumen";
  const actual = document.createElement("span");
  actual.append("Versión vigente ", Object.assign(document.createElement("b"), { textContent: `v${vigente}` }));
  acciones.append(actual);
  if (puede(permiso)) {
    acciones.append(
      boton("Crear nueva versión", () => (window.location.hash = `${ruta}/${id}/nueva-version`), true)
    );
  } else {
    acciones.append(Object.assign(document.createElement("span"), {
      className: "subtitulo",
      textContent: "Tu cargo no crea versiones de este documento",
    }));
  }
  cabecera.append(acciones);

  if (anteriores.length === 0) {
    const p = document.createElement("p");
    p.className = "subtitulo";
    p.textContent =
      "Sin correcciones: es la versión original. Si hay que corregirlo y ya no se puede editar o eliminar, crea una nueva versión.";
    bloque.append(p);
    return bloque;
  }

  const lista = document.createElement("ul");
  lista.className = "lista-versiones";
  anteriores.forEach((v) => {
    const item = document.createElement("li");
    const fila = document.createElement("div");
    fila.className = "docs-fila";
    const texto = document.createElement("span");
    texto.append(
      Object.assign(document.createElement("b"), { textContent: `v${v.version} reemplazada` }),
      ` · ${formatoFechaHora(v.reemplazada_en)} · ${v.reemplazada_por || "—"} — ${v.motivo}`
    );
    const ver = boton("Ver", () => {
      const abierta = item.querySelector(".vista-version");
      if (abierta) {
        abierta.remove();
        ver.textContent = "Ver";
        return;
      }
      item.append(renderInstantanea(v.instantanea));
      ver.textContent = "Ocultar";
    }, true);
    ver.setAttribute("aria-label", `Ver la versión ${v.version}`);
    fila.append(texto, ver);
    item.append(fila);
    lista.append(item);
  });
  bloque.append(lista);
  return bloque;
}

// Documentos de otros módulos en la línea de tiempo: nombre, ruta y estados.
// Los textos de estado están en scripts que se cargan después de este: se
// llaman al usarse (una arrow), no al cargar.
const DOCUMENTOS_LINEA_TIEMPO = {
  expedientes_diseno: { nombre: "Expediente de diseño", ruta: "#/expedientes-diseno/", femenino: false, estado: (v) => textoEstadoExpediente(v) },
  requisiciones: { nombre: "Requisición", ruta: "#/requisiciones/", femenino: true, estado: (v) => textoEstadoRequisicion(v) },
  ordenes_compra: { nombre: "Orden de compra", ruta: "#/ordenes-compra/", femenino: true, estado: (v) => textoEstadoOrdenCompra(v) },
  reportes_servicio_tecnico: { nombre: "Reporte de servicio", ruta: "#/reportes-servicio/", femenino: false, estado: null },
  actas_entrega_equipos: { nombre: "Acta de entrega", ruta: "#/actas-entrega/", femenino: true, estado: null },
  actas_cierre_satisfaccion: { nombre: "Acta de cierre", ruta: "#/actas-cierre/", femenino: true, estado: null },
};

function describirEventoDocumento(evento, doc) {
  const sujeto = `${doc.nombre} ${evento.documento_codigo || ""}`.trim();
  const terminacion = doc.femenino ? "a" : "o";
  if (evento.accion === "crear") return `${sujeto} cread${terminacion}`;
  if (evento.accion === "eliminar") return `${sujeto} eliminad${terminacion}`;
  if (evento.documento_cambio_estado && doc.estado) {
    const { de, a } = evento.documento_cambio_estado;
    return `${sujeto}: ${doc.estado(de)} → ${doc.estado(a)}`;
  }
  return `${sujeto} actualizad${terminacion}`;
}

function describirEventoLineaTiempo(evento) {
  const documento = DOCUMENTOS_LINEA_TIEMPO[evento.tabla];
  if (documento) return describirEventoDocumento(evento, documento);
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
      const { de, a } = evento.actividad_cambio_estado;
      if (a === "completada") return `Actividad finalizada: ${descripcion}`;
      if (a === "en_curso") return `Actividad iniciada: ${descripcion}`;
      return de === "en_curso"
        ? `Actividad pausada: ${descripcion}`
        : `Actividad reabierta: ${descripcion}`;
    }
    if (evento.actividad_cambio_prioridad) {
      const nombres = { normal: "Normal", alta: "Alta", urgente: "Urgente" };
      return `Prioridad ${nombres[evento.actividad_cambio_prioridad.a] || ""}: ${descripcion}`;
    }
    if (evento.actividad_cambio_fechas) {
      const { inicio, fin } = evento.actividad_cambio_fechas;
      const corta = (v) => (v ? fechaCortaTexto(String(v).slice(0, 10)) : "—");
      return `Fechas de "${descripcion}": ${corta(inicio)} → ${corta(fin)}`;
    }
    return `Actividad actualizada: ${descripcion}`;
  }
  if (evento.tabla === "archivos_adjuntos") {
    const nombre = evento.evidencia_nombre || "archivo";
    return evento.accion === "eliminar" ? `Evidencia quitada: ${nombre}` : `Evidencia subida: ${nombre}`;
  }
  return "Evento registrado";
}

function formatoFechaHora(valor) {
  return new Date(valor).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

// Si el proyecto tiene documentos de otros módulos, devuelve el aviso de
// bloqueo con la vista previa de esos documentos y el camino de corrección
// (nueva versión). Sin documentos, devuelve null y se permite eliminar.
async function bloqueoEliminacionProyecto(proyecto, alCerrar) {
  const r = await api("GET", `/proyectos/${proyecto.id}/documentos`);
  if (r.status !== 200) return null;
  const d = r.cuerpo.documentos;
  const propios = (d.reportes_servicio || []).filter((x) => x.proyecto_id === proyecto.id);
  const total =
    d.expedientes.length +
    d.requisiciones.length +
    d.ordenes_compra.length +
    propios.length +
    d.actas_entrega.length +
    d.actas_cierre.length +
    (d.equipos || []).length;
  if (total === 0) return null;

  const bloque = document.createElement("div");
  bloque.className = "bloqueo-eliminacion";
  bloque.append(
    alerta(
      "aviso",
      `${proyecto.codigo_pry} no se puede eliminar: tiene ${total} documento${total === 1 ? "" : "s"} enlazado${total === 1 ? "" : "s"} (abajo). Para corregirlo, crea una nueva versión; la actual quedará en su historial.`
    )
  );
  const acciones = document.createElement("div");
  acciones.className = "acciones-bloqueo";
  if (puede("versionar_proyecto")) {
    acciones.append(
      boton("Crear nueva versión", () => (window.location.hash = `#/proyectos/${proyecto.id}/nueva-version`))
    );
  }
  acciones.append(boton("Cerrar", alCerrar, true));
  bloque.append(acciones, await renderSeccionDocumentosProyecto(proyecto.id));
  return bloque;
}

// Vista de una lista: tarjetas (por defecto) o tabla compacta. Es una
// preferencia de este navegador.
function preferenciaVista(clave) {
  try {
    return localStorage.getItem(`vista-${clave}`) === "tabla" ? "tabla" : "tarjetas";
  } catch {
    return "tarjetas";
  }
}

function selectorVista(clave, alCambiar) {
  const grupo = document.createElement("div");
  grupo.className = "selector-vista";
  grupo.setAttribute("role", "group");
  grupo.setAttribute("aria-label", "Forma de ver la lista");
  [
    ["tarjetas", "Tarjetas"],
    ["tabla", "Tabla"],
  ].forEach(([valor, texto]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = texto;
    b.setAttribute("aria-pressed", String(preferenciaVista(clave) === valor));
    b.addEventListener("click", () => {
      try {
        localStorage.setItem(`vista-${clave}`, valor);
      } catch {
        // sin almacenamiento: la elección dura hasta recargar
      }
      alCambiar();
    });
    grupo.append(b);
  });
  return grupo;
}
