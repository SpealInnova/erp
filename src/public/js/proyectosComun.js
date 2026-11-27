/* global alerta, api, boton, cerrarSesion, contenido, formatearMoneda, pill, token */
/* exported
   botonEvidenciasProyecto, construirStageTrack, enfocarActividad, pestanasVista,
   renderSeccionActividadesProyecto, renderSeccionEvidencias, renderSeccionPresupuestoProyecto,
   tipoPillProyecto */
// Piezas de la ficha del proyecto: fases, presupuesto, evidencias, pestañas, ventanas y
// actividades por fase (Gantt y subactividades).

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

// alCargar(cantidad), opcional: se llama cada vez que se recarga la lista
// (al abrir, subir o quitar), p. ej. para un contador.
function contenidoEvidencias(tabla, registroId, alCargar) {
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
    if (alCargar) alCargar(archivos.length);
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

// Pestañas dentro de una vista (patrón ARIA "tabs"). definiciones:
// [{ clave, texto, alActivar(panel) }]; alActivar corre cada vez que se abre.
function pestanasVista(definiciones) {
  const lista = document.createElement("div");
  lista.className = "pestanas-vista";
  lista.setAttribute("role", "tablist");
  const paneles = {};
  const botones = definiciones.map((def, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.id = `pestana-${def.clave}`;
    b.setAttribute("role", "tab");
    b.setAttribute("aria-controls", `panel-${def.clave}`);
    b.textContent = def.texto;
    const panel = document.createElement("div");
    panel.id = `panel-${def.clave}`;
    panel.className = "panel-pestana";
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", b.id);
    paneles[def.clave] = panel;
    b.addEventListener("click", () => activar(i));
    lista.append(b);
    return b;
  });

  function activar(indice, conFoco = false) {
    botones.forEach((b, j) => {
      const elegida = j === indice;
      b.setAttribute("aria-selected", String(elegida));
      b.tabIndex = elegida ? 0 : -1;
      paneles[definiciones[j].clave].hidden = !elegida;
    });
    if (conFoco) botones[indice].focus();
    const def = definiciones[indice];
    if (def.alActivar) def.alActivar(paneles[def.clave]);
  }

  lista.addEventListener("keydown", (evento) => {
    const actual = botones.indexOf(document.activeElement);
    if (actual < 0) return;
    const destinos = {
      ArrowRight: (actual + 1) % botones.length,
      ArrowLeft: (actual - 1 + botones.length) % botones.length,
      Home: 0,
      End: botones.length - 1,
    };
    if (!(evento.key in destinos)) return;
    evento.preventDefault();
    activar(destinos[evento.key], true);
  });

  activar(0);
  return { lista, paneles, activar };
}

// Ventana modal genérica. Sus formularios tienen su propio guardar, así que
// no activan el aviso de "cambios sin guardar" de la página.
function abrirDialogo({ titulo, subtitulo, cuerpo, alCerrar }) {
  const dialogo = document.createElement("dialog");
  dialogo.className = "dialogo";
  const idTitulo = `dialogo-titulo-${Date.now()}`;
  dialogo.setAttribute("aria-labelledby", idTitulo);

  const cabecera = document.createElement("header");
  cabecera.className = "dialogo-cabecera";
  const textos = document.createElement("div");
  if (subtitulo) {
    const p = document.createElement("p");
    p.className = "subtitulo";
    p.textContent = subtitulo;
    textos.append(p);
  }
  const h3 = document.createElement("h3");
  h3.id = idTitulo;
  h3.textContent = titulo;
  textos.append(h3);
  const cerrar = document.createElement("button");
  cerrar.type = "button";
  cerrar.className = "boton-icono";
  cerrar.textContent = "×";
  cerrar.setAttribute("aria-label", "Cerrar");
  cerrar.addEventListener("click", () => dialogo.close());
  cabecera.append(textos, cerrar);

  const contenedor = document.createElement("div");
  contenedor.className = "dialogo-cuerpo";
  contenedor.append(cuerpo);
  dialogo.append(cabecera, contenedor);
  dialogo.querySelectorAll("form").forEach((f) => (f.dataset.sucioVigilado = "1"));
  dialogo.addEventListener("close", () => {
    dialogo.remove();
    if (alCerrar) alCerrar();
  });
  contenido.append(dialogo);
  dialogo.showModal();
  return dialogo;
}

// Las evidencias del proyecto no se muestran en la ficha: este botón abre
// la sección (lista + carga) en una ventana, solo cuando se necesita.
function botonEvidenciasProyecto(proyectoId) {
  const b = boton(
    "Agregar evidencias",
    () =>
      abrirDialogo({
        titulo: "Evidencias del proyecto",
        subtitulo: "Documentos y soportes",
        cuerpo: contenidoEvidencias("proyectos", proyectoId),
        alCerrar: contar,
      }),
    true
  );
  b.title = "Ver o agregar evidencias del proyecto";
  async function contar() {
    const r = await api("GET", `/archivos-adjuntos?tabla=proyectos&registro_id=${proyectoId}`);
    if (r.status !== 200) return;
    const n = r.cuerpo.archivos.length;
    b.textContent = n > 0 ? `Evidencias (${n})` : "Agregar evidencias";
  }
  contar();
  return b;
}

// Enlace directo a una actividad: la lleva a la vista, la resalta y abre su
// resumen en el Gantt.
function enfocarActividad(actividadId) {
  requestAnimationFrame(() => {
    const barra = contenido.querySelector(`.gantt-barra[data-actividad-id="${actividadId}"]`);
    if (!barra) {
      const seccion = [...contenido.querySelectorAll(".tarjeta-ancha")].find((el) =>
        el.textContent.startsWith("Actividades por fase")
      );
      if (seccion) {
        seccion
          .querySelector("h3")
          .after(alerta("aviso", "Esa actividad ya no está en el proyecto: fue quitada."));
      }
      return;
    }
    barra.scrollIntoView({ block: "center" });
    barra.classList.add("gantt-barra--resaltada");
    barra.click();
  });
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

// Subactividades: actividades agregadas a mano en cualquier fase, además de
// las de plantilla (retomadas por decisión del usuario, 2026-11-24). Quedan
// al final de su fase y no impiden que la fase reciba su plantilla.
const SUBACTIVIDADES_HABILITADAS = true;

async function renderSeccionActividadesProyecto(proyectoId, opcionesUsuarios, opciones = {}) {
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

  // Se conservan entre recargas de la sección (después de guardar o mover
  // una barra): qué fases están abiertas y cuántos días sumó el usuario.
  const fasesAbiertas = new Set();
  const ajustesRango = new Map();
  let primeraCarga = true;

  const mostrarError = (texto) => mensaje.replaceChildren(alerta("error", texto));

  // "+ Agregar subactividad": un formulario corto (Enter agrega) que crea la
  // actividad en esa fase; luego se le ponen fechas y responsable con el
  // engranaje de su barra, como a las demás.
  function filaAgregarSubactividad(fase) {
    const filaAgregar = document.createElement("div");
    filaAgregar.className = "fila-subactividad";
    const mostrarFormAgregar = () => {
      const form = document.createElement("form");
      form.className = "form-subactividad";
      form.noValidate = true;
      // tiene sus propios Agregar/Cancelar: no cuenta como cambio sin guardar
      form.dataset.sucioVigilado = "1";
      const idCampo = `subactividad-${fase}`;
      const etiqueta = document.createElement("label");
      etiqueta.htmlFor = idCampo;
      etiqueta.textContent = `Nueva subactividad en ${textoEstadoProyecto(fase)}`;
      const input = document.createElement("input");
      input.type = "text";
      input.id = idCampo;
      input.maxLength = 255;
      input.placeholder = "Qué hay que hacer";
      const confirmar = document.createElement("button");
      confirmar.type = "submit";
      confirmar.className = "boton boton-pequeno";
      confirmar.textContent = "Agregar";
      const cancelar = boton("Cancelar", () => filaAgregar.replaceChildren(botonMas), true);
      form.addEventListener("submit", async (evento) => {
        evento.preventDefault();
        const nombre = input.value.trim();
        if (!nombre) {
          input.focus();
          return;
        }
        confirmar.disabled = true;
        const r2 = await api("POST", `/proyectos/${proyectoId}/actividades`, {
          categoria: "General",
          descripcion: nombre,
          fase,
        });
        confirmar.disabled = false;
        if (r2.status !== 201) {
          mostrarError(r2.cuerpo?.error || "No se pudo agregar la subactividad.");
          return;
        }
        fasesAbiertas.add(fase);
        cargar();
      });
      form.append(etiqueta, input, confirmar, cancelar);
      filaAgregar.replaceChildren(form);
      input.focus();
    };
    const botonMas = boton("+ Agregar subactividad", mostrarFormAgregar, true);
    filaAgregar.append(botonMas);
    return filaAgregar;
  }

  // Responsables de la etapa (pueden ser varios): sus nombres, con × para
  // quitarlos, y un selector para asignar a otra persona.
  function filaResponsablesEtapa(fase, asignados) {
    const textoFase = textoEstadoProyecto(fase);
    const fila = document.createElement("div");
    fila.className = "responsables-etapa";
    const titulo = document.createElement("span");
    titulo.className = "responsables-etapa__titulo";
    titulo.textContent = "Responsables de la etapa:";
    fila.append(titulo);
    if (asignados.length === 0) {
      const nadie = document.createElement("span");
      nadie.className = "subtitulo";
      nadie.textContent = "sin asignar";
      fila.append(nadie);
    }
    asignados.forEach((responsable) => {
      const chip = document.createElement("span");
      chip.className = "chip-responsable";
      chip.append(document.createTextNode(responsable.usuario_nombre));
      const quitar = document.createElement("button");
      quitar.type = "button";
      quitar.className = "chip-responsable__quitar";
      quitar.textContent = "×";
      quitar.setAttribute(
        "aria-label",
        `Quitar a ${responsable.usuario_nombre} como responsable de ${textoFase}`
      );
      quitar.addEventListener("click", async () => {
        quitar.disabled = true;
        const r2 = await api(
          "DELETE",
          `/proyectos/${proyectoId}/fase-responsables/${responsable.id}`
        );
        if (r2.status !== 204) {
          quitar.disabled = false;
          mostrarError(r2.cuerpo?.error || "No se pudo quitar al responsable.");
          return;
        }
        fasesAbiertas.add(fase);
        cargar();
      });
      chip.append(quitar);
      fila.append(chip);
    });

    const disponibles = opcionesUsuarios.filter(
      (o) => !asignados.some((r) => String(r.usuario_id) === o.valor)
    );
    if (disponibles.length > 0) {
      const form = document.createElement("form");
      form.className = "form-responsable-etapa";
      form.noValidate = true;
      // tiene su propio botón Asignar: no cuenta como cambio sin guardar
      form.dataset.sucioVigilado = "1";
      const select = document.createElement("select");
      select.setAttribute("aria-label", `Asignar responsable de ${textoFase}`);
      select.append(
        new Option("Asignar a…", ""),
        ...disponibles.map((o) => new Option(o.texto, o.valor))
      );
      const asignar = document.createElement("button");
      asignar.type = "submit";
      asignar.className = "boton boton-pequeno";
      asignar.textContent = "Asignar";
      form.addEventListener("submit", async (evento) => {
        evento.preventDefault();
        if (!select.value) {
          select.focus();
          return;
        }
        asignar.disabled = true;
        const r2 = await api("POST", `/proyectos/${proyectoId}/fase-responsables`, {
          fase,
          usuario_id: Number(select.value),
        });
        asignar.disabled = false;
        if (r2.status !== 201) {
          mostrarError(r2.cuerpo?.error || "No se pudo asignar al responsable.");
          return;
        }
        fasesAbiertas.add(fase);
        cargar();
      });
      form.append(select, asignar);
      fila.append(form);
    }
    return fila;
  }

  async function cargar() {
    const [r, rResponsables] = await Promise.all([
      api("GET", `/proyectos/${proyectoId}/actividades`),
      api("GET", `/proyectos/${proyectoId}/fase-responsables`),
    ]);
    if (r.status !== 200) {
      mostrarError("No se pudieron cargar las actividades.");
      return;
    }
    mensaje.replaceChildren();
    const actividades = r.cuerpo.actividades;
    if (opciones.alCargar) opciones.alCargar(actividades);
    const responsablesPorFase = new Map();
    (rResponsables.status === 200 ? rResponsables.cuerpo.responsables : []).forEach((resp) => {
      if (!responsablesPorFase.has(resp.fase)) responsablesPorFase.set(resp.fase, []);
      responsablesPorFase.get(resp.fase).push(resp);
    });

    const porFase = new Map();
    actividades.forEach((actividad) => {
      if (!porFase.has(actividad.fase)) porFase.set(actividad.fase, []);
      porFase.get(actividad.fase).push(actividad);
    });

    const eraPrimeraCarga = primeraCarga;
    if (primeraCarga) {
      const fasesConActividades = ETAPAS_PROYECTO_LINEAL.map((e) => e.valor).filter(
        (fase) => (porFase.get(fase) || []).length > 0
      );
      const ultimaFase = fasesConActividades[fasesConActividades.length - 1];
      if (ultimaFase) fasesAbiertas.add(ultimaFase);
      // Enlace directo a una actividad: su fase se abre aunque no sea la última.
      const enlazada = actividades.find((a) => String(a.id) === String(opciones.actividadId));
      if (enlazada) fasesAbiertas.add(enlazada.fase);
      primeraCarga = false;
    }

    // Se arma todo antes de reemplazar: la sección no parpadea ni salta.
    const grupos = ETAPAS_PROYECTO_LINEAL.map((etapa) => {
      const fase = etapa.valor;
      const lista = porFase.get(fase) || [];
      const completadas = lista.filter((actividad) => actividad.estado === "completada").length;

      const detalles = document.createElement("details");
      detalles.className = "fase-actividades";
      detalles.open = fasesAbiertas.has(fase);
      detalles.addEventListener("toggle", () => {
        if (detalles.open) fasesAbiertas.add(fase);
        else fasesAbiertas.delete(fase);
      });

      const resumen = document.createElement("summary");
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
      const asignados = responsablesPorFase.get(fase) || [];
      if (asignados.length > 0) {
        const nombres = document.createElement("span");
        nombres.className = "subtitulo resumen-responsables";
        nombres.textContent = `· ${asignados.map((x) => x.usuario_nombre).join(", ")}`;
        resumen.append(nombres);
      }
      detalles.append(resumen);

      const contenidoFase = document.createElement("div");
      contenidoFase.style.padding = "8px 0 0";
      contenidoFase.append(filaResponsablesEtapa(fase, asignados));

      if (lista.length > 0) {
        if (!ajustesRango.has(fase)) ajustesRango.set(fase, { atras: 0, adelante: 0 });
        contenidoFase.append(
          window.montarGanttActividades({
            actividades: lista,
            proyectoId,
            textoFase: textoEstadoProyecto(fase),
            usuarios: opcionesUsuarios,
            ajuste: ajustesRango.get(fase),
            alCambiar: cargar,
            mostrarError,
          })
        );
      } else {
        const vacio = document.createElement("p");
        vacio.className = "subtitulo";
        vacio.style.margin = "0";
        vacio.textContent = "Esta fase no tiene actividades.";
        contenidoFase.append(vacio);
      }

      if (SUBACTIVIDADES_HABILITADAS) contenidoFase.append(filaAgregarSubactividad(fase));

      detalles.append(contenidoFase);
      return detalles;
    });
    contenedorGrupos.replaceChildren(...grupos);
    // Una actividad guardada, movida o quitada cambia la ventana de pendientes.
    if (!eraPrimeraCarga && window.actualizarMisActividades) window.actualizarMisActividades();
    // La ficha recalcula "Siguiente paso" con el nuevo estado de las actividades.
    if (!eraPrimeraCarga) {
      document.dispatchEvent(new CustomEvent("actividades-cambiaron", { detail: { proyectoId } }));
    }
  }

  await cargar();
  return tarjeta;
}
