/* global
   alerta, api, boton, botonCancelar, celda, confirmarCreacion, construirCampo, contenido,
   encabezado, estadoPill, marcarMenu, montarListado, mostrarCargando,
   mostrarErroresValidacion, normalizarOpciones, notaSinPermisoEstado, obtenerProyectos,
   obtenerUsuarios, opcionesSegunPermiso, pill, puede */
/* exported renderSeccionSubrecurso, subrecursosExpediente, vistaExpedienteForm, vistaExpedientes */
// Expedientes de diseño: lista, formulario y sus secciones (requisitos, salidas, verificaciones…
// con renderSeccionSubrecurso).

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
  const nuevo = boton("Nuevo expediente", () => (window.location.hash = "#/expedientes-diseno/nuevo"));
  contenido.replaceChildren(encabezado("Expedientes de diseño", [nuevo]));
  await montarListado({
    clave: "expedientes-diseno",
    api: "/expedientes-diseno",
    campo: "expedientes",
    titulo: "expedientes de diseño",
    buscar: "Buscar por código, producto, serial o proyecto",
    estados: ESTADOS_EXPEDIENTE,
    vacio: "Aún no hay expedientes de diseño registrados.",
    pintar: tablaExpedientes,
  });
}

function tablaExpedientes(expedientes) {
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
      e.proyecto_codigo || "—",
      e.responsable_nombre || "—",
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
  return tarjeta;
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

    // Liberar o rechazar el expediente es una decisión de diseño.
    const opcionesEstado = opcionesSegunPermiso(ESTADOS_EXPEDIENTE, expediente.estado_liberacion, () =>
      puede("aprobar_diseno")
    );
    if (opcionesEstado.length > 1) {
      const mensajeEstado = document.createElement("div");
      const filaEstado = document.createElement("div");
      filaEstado.className = "formulario-grid";
      filaEstado.append(
        construirCampo(
          { nombre: "nuevo_estado", etiqueta: "Cambiar a", tipo: "select", opciones: opcionesEstado },
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
    } else if (expediente.estado_liberacion === "pendiente") {
      bloqueEstado.append(
        notaSinPermisoEstado("Lo liberan el Jefe de I+D+i, el Director de Operaciones o el Gerente General.")
      );
    }

    // Secciones por pasos, con lo que falta para liberar y la liberación
    // (bloqueEstado) como último paso.
    contenido.append(
      await window.montarExpedienteGuiado({
        id,
        expediente,
        editable,
        opcionesUsuarios,
        proyecto: proyectos.find((p) => p.id === expediente.proyecto_id) || null,
        bloqueEstado,
      })
    );
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

// Catálogos del expediente: listas desplegables donde antes había texto libre.
// Las columnas siguen siendo texto: un valor anterior que no esté en la lista
// se conserva y se muestra tal cual.
const SIN_DATO = { valor: "", texto: "— Sin dato —" };
const CATALOGO_EXPEDIENTE = {
  fuente: [
    SIN_DATO,
    { valor: "cliente", texto: "Cliente" },
    { valor: "norma", texto: "Norma técnica" },
    { valor: "legal", texto: "Requisito legal" },
    { valor: "interno", texto: "Requisito interno" },
    { valor: "otro", texto: "Otro" },
  ],
  estadoSalida: [
    { valor: "en_elaboracion", texto: "En elaboración" },
    { valor: "en_revision", texto: "En revisión" },
    { valor: "aprobada", texto: "Aprobada" },
  ],
  metodoVerificacion: [
    SIN_DATO,
    { valor: "ensayo", texto: "Ensayo" },
    { valor: "inspeccion", texto: "Inspección" },
    { valor: "analisis", texto: "Análisis o cálculo" },
    { valor: "demostracion", texto: "Demostración" },
  ],
  metodoValidacion: [
    SIN_DATO,
    { valor: "fat", texto: "Prueba en fábrica (FAT)" },
    { valor: "prueba_sitio", texto: "Prueba en sitio" },
    { valor: "simulacion", texto: "Simulación" },
    { valor: "revision_cliente", texto: "Revisión con el cliente" },
  ],
  resultado: [
    { valor: "pendiente", texto: "Pendiente" },
    { valor: "conforme", texto: "Conforme" },
    { valor: "no_conforme", texto: "No conforme" },
  ],
  severidad: [
    SIN_DATO,
    { valor: "1", texto: "1 · Leve" },
    { valor: "2", texto: "2 · Menor" },
    { valor: "3", texto: "3 · Moderada" },
    { valor: "4", texto: "4 · Grave" },
    { valor: "5", texto: "5 · Catastrófica" },
  ],
  probabilidad: [
    SIN_DATO,
    { valor: "1", texto: "1 · Rara" },
    { valor: "2", texto: "2 · Improbable" },
    { valor: "3", texto: "3 · Posible" },
    { valor: "4", texto: "4 · Probable" },
    { valor: "5", texto: "5 · Casi segura" },
  ],
  area: [
    SIN_DATO,
    ...["Producción", "Compras", "Calidad", "Almacén", "Logística", "Instalación", "Soporte técnico", "Comercial"].map(
      (a) => ({ valor: a, texto: a })
    ),
  ],
};
const TONOS_RESULTADO = { conforme: "good", no_conforme: "crit", pendiente: "warn" };

// Severidad × probabilidad (1 a 5 cada una): bajo, medio o alto.
function nivelRiesgo(registro) {
  const s = parseInt(registro.severidad, 10);
  const p = parseInt(registro.probabilidad, 10);
  if (!s || !p) return null;
  const n = s * p;
  if (n <= 4) return { texto: `${n} · Bajo`, tipo: "good" };
  if (n <= 9) return { texto: `${n} · Medio`, tipo: "warn" };
  return { texto: `${n} · Alto`, tipo: "crit" };
}

// contexto.requisitos: requisitos de entrada ya registrados (la verificación
// los ofrece en una lista y trae su criterio de aceptación).
function subrecursosExpediente(opcionesUsuarios, contexto = {}) {
  const requisitos = contexto.requisitos || [];
  const opcionesRequisitos = requisitos.length
    ? requisitos.map((r) => ({ valor: r.requisito, texto: r.requisito }))
    : [{ valor: "", texto: "— Registra primero los requisitos de entrada —" }];
  return [
    {
      ruta: "requisitos-entrada",
      clave: "requisitos",
      titulo: "Requisitos de entrada",
      nombreSingular: "requisito",
      ayuda:
        "Qué debe cumplir el diseño: lo pide el cliente, una norma o la ley. Cada requisito tendrá después su verificación.",
      campos: [
        { nombre: "requisito", etiqueta: "Requisito", requerido: true },
        { nombre: "valor", etiqueta: "Valor" },
        { nombre: "fuente", etiqueta: "Fuente", tipo: "select", opciones: CATALOGO_EXPEDIENTE.fuente },
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
      ayuda:
        "Lo que produce el diseño: planos, listas de materiales, especificaciones. Deben quedar aprobadas antes de liberar.",
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
        {
          nombre: "estado",
          etiqueta: "Estado",
          tipo: "select",
          opciones: CATALOGO_EXPEDIENTE.estadoSalida,
          tonos: { aprobada: "good", en_revision: "info", en_elaboracion: "mute" },
        },
      ],
    },
    {
      ruta: "verificaciones",
      clave: "verificaciones",
      titulo: "Verificaciones",
      nombreSingular: "verificación",
      ayuda:
        "Comprueba que cada salida cumple su requisito de entrada. Elige el requisito de la lista: su criterio de aceptación se trae solo.",
      // el criterio viene del requisito elegido
      autocompletar: {
        desde: "requisito_verificado",
        hacia: "criterio",
        valores: Object.fromEntries(requisitos.map((r) => [r.requisito, r.criterio_aceptacion || ""])),
      },
      campos: [
        {
          nombre: "requisito_verificado",
          etiqueta: "Requisito verificado",
          requerido: true,
          tipo: "select",
          opciones: opcionesRequisitos,
        },
        { nombre: "metodo", etiqueta: "Método", tipo: "select", opciones: CATALOGO_EXPEDIENTE.metodoVerificacion },
        { nombre: "criterio", etiqueta: "Criterio" },
        {
          nombre: "resultado",
          etiqueta: "Resultado",
          tipo: "select",
          opciones: CATALOGO_EXPEDIENTE.resultado,
          tonos: TONOS_RESULTADO,
        },
        { nombre: "evidencia", etiqueta: "Evidencia" },
      ],
    },
    {
      ruta: "validaciones",
      clave: "validaciones",
      titulo: "Validaciones",
      nombreSingular: "validación",
      ayuda:
        "Comprueba que el equipo sirve para el uso que le dará el cliente: prueba en fábrica (FAT), en sitio o revisión con el cliente.",
      campos: [
        { nombre: "aspecto_validado", etiqueta: "Aspecto validado", requerido: true },
        { nombre: "metodo", etiqueta: "Método", tipo: "select", opciones: CATALOGO_EXPEDIENTE.metodoValidacion },
        { nombre: "condicion_prueba", etiqueta: "Condición de prueba" },
        {
          nombre: "resultado",
          etiqueta: "Resultado",
          tipo: "select",
          opciones: CATALOGO_EXPEDIENTE.resultado,
          tonos: TONOS_RESULTADO,
        },
      ],
    },
    {
      ruta: "revisiones-diseno",
      clave: "revisiones",
      titulo: "Revisiones de diseño",
      nombreSingular: "revisión",
      ayuda:
        "Reuniones de revisión del diseño: hallazgos, acciones y responsable. Ciérrala cuando las acciones estén hechas.",
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
      ayuda:
        "Peligros del equipo y cómo se controlan. Severidad × probabilidad (de 1 a 5) da el nivel de riesgo.",
      calculadas: [{ etiqueta: "Nivel", valor: nivelRiesgo }],
      campos: [
        { nombre: "peligro", etiqueta: "Peligro", requerido: true },
        { nombre: "situacion_peligrosa", etiqueta: "Situación peligrosa" },
        { nombre: "dano_potencial", etiqueta: "Daño potencial" },
        { nombre: "severidad", etiqueta: "Severidad", tipo: "select", opciones: CATALOGO_EXPEDIENTE.severidad },
        {
          nombre: "probabilidad",
          etiqueta: "Probabilidad",
          tipo: "select",
          opciones: CATALOGO_EXPEDIENTE.probabilidad,
        },
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
      ayuda:
        "Cambios al diseño ya aprobado. Los decide la Dirección de Operaciones o el Jefe de I+D+i; quien propone un cambio no lo aprueba.",
      campos: [
        { nombre: "fecha", etiqueta: "Fecha", tipo: "date" },
        { nombre: "descripcion", etiqueta: "Descripción" },
        { nombre: "motivo", etiqueta: "Motivo" },
        // Aprobar o rechazar un cambio es una decisión de diseño (el servidor
        // además exige que no la tome quien creó el cambio).
        {
          nombre: "estado",
          etiqueta: "Estado",
          tipo: "select",
          opciones: OPCIONES_ESTADO_CAMBIO_DISENO.filter(
            (o) => o.valor === "pendiente" || puede("aprobar_diseno")
          ),
        },
      ],
    },
    {
      ruta: "transferencias",
      clave: "transferencias",
      titulo: "Transferencias",
      nombreSingular: "transferencia",
      ayuda:
        "Qué se entrega a otras áreas (producción, compras, calidad) para fabricar el equipo, y si se recibió conforme.",
      campos: [
        { nombre: "elemento_transferido", etiqueta: "Elemento transferido", requerido: true },
        { nombre: "area_receptora", etiqueta: "Área receptora", tipo: "select", opciones: CATALOGO_EXPEDIENTE.area },
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
  if (config.tonos) return config.tonos[valor] || null;
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
    const enCatalogo = normalizarOpciones(config.opciones).some((op) => String(op.valor) === String(valor));
    if (valor !== null && valor !== undefined && valor !== "" && !enCatalogo) {
      const anterior = document.createElement("option");
      anterior.value = String(valor);
      anterior.textContent = `${valor} (valor anterior)`;
      input.append(anterior);
    }
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

// alCargar(lista): se llama cada vez que se recarga la sección (el
// expediente guiado recalcula con eso lo que falta para liberar).
// config.rutaBase: recurso padre de la API (por defecto el expediente);
// config.accionVacia(recargar): elemento que se muestra solo cuando la lista
// está vacía (p. ej. cargar los parámetros del formato en un reporte).
async function renderSeccionSubrecurso(expedienteId, config, editable, alCargar) {
  const base = `${config.rutaBase || `/expedientes-diseno/${expedienteId}`}/${config.ruta}`;
  const tarjeta = document.createElement("div");
  tarjeta.className = "tarjeta-ancha";
  tarjeta.style.marginTop = "24px";

  const h3 = document.createElement("h3");
  h3.style.margin = "0 0 16px";
  h3.style.fontSize = "1.125rem";
  h3.textContent = config.titulo;

  const mensaje = document.createElement("div");
  const ayuda = document.createElement("p");
  ayuda.className = "subtitulo ayuda-seccion";
  ayuda.textContent = config.ayuda || "";
  const calculadas = config.calculadas || [];

  const tabla = document.createElement("table");
  tabla.className = "tabla-items";
  const thead = document.createElement("thead");
  const filaCabecera = document.createElement("tr");
  [...config.campos, ...calculadas].forEach((c) => {
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
  if (config.autocompletar) {
    const { desde, hacia, valores } = config.autocompletar;
    const origen = gridAgregar.querySelector(`#${config.ruta}__${desde}`);
    const destino = gridAgregar.querySelector(`#${config.ruta}__${hacia}`);
    let automatico = "";
    const completar = () => {
      // solo si el usuario no escribió otro criterio
      if (destino.value && destino.value !== automatico) return;
      automatico = valores[origen.value] || "";
      destino.value = automatico;
    };
    origen.addEventListener("change", completar);
    // al limpiar el formulario después de agregar, se vuelve a traer
    formAgregar.addEventListener("reset", () =>
      setTimeout(() => {
        automatico = "";
        completar();
      }, 0)
    );
    completar();
  }

  // se crea antes de la primera carga, que decide si se muestra
  const accionVacia = editable && config.accionVacia ? config.accionVacia(() => cargar()) : null;

  async function cargar() {
    mensaje.replaceChildren();
    const r = await api("GET", base);
    tbody.replaceChildren();
    if (r.status !== 200) {
      mensaje.append(alerta("error", `No se pudo cargar: ${config.titulo.toLowerCase()}.`));
      return;
    }
    const lista = r.cuerpo[config.clave] || [];
    if (alCargar) alCargar(lista);
    if (accionVacia) accionVacia.hidden = lista.length > 0;
    if (lista.length === 0) {
      const fila = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = config.campos.length + calculadas.length + (editable ? 1 : 0);
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
      calculadas.forEach((c) => {
        const td = document.createElement("td");
        const valor = c.valor(registro);
        if (valor) td.append(pill(valor.texto, valor.tipo));
        else td.textContent = "—";
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
            `${base}/${registro.id}`
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
          `${base}/${registro.id}`,
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
        const r = await api("POST", base, datos);
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

  tarjeta.append(h3);
  if (config.ayuda) tarjeta.append(ayuda);
  tarjeta.append(mensaje, tabla);
  if (accionVacia) tarjeta.append(accionVacia);
  if (editable) tarjeta.append(formAgregar);
  await cargar();
  return tarjeta;
}
