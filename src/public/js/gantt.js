/* global api, alerta, boton, pill, contenidoEvidencias */
/* ------------------------------------------------------------------
   Diagrama de Gantt de las actividades de una fase del proyecto.

   - Ocupa todo el ancho de la sección: cada día es una columna de la misma
     fracción del ancho. Al sumar semanas, las columnas se estrechan en vez
     de desbordar; solo por debajo de ANCHO_MIN_COLUMNA aparece el
     desplazamiento horizontal.
   - Encabezado en tres filas: mes (una sola línea), semanas del mes y días.
     Cada texto se centra en su propio tramo de columnas, así que no se
     pisan. Con columnas estrechas los días se escriben en vertical.
   - Clic en una barra: tarjeta con el resumen de la actividad y un
     engranaje que abre la ventana de gestión (datos, responsable, estado,
     fechas, evidencias y quitar la actividad).
   - Arrastrar una barra mueve sus fechas; arrastrar un borde las estira.

   El rango nunca empieza antes de hoy (decisión previa del proyecto); una
   actividad que empezó antes se dibuja recortada desde hoy.

   Usa api(), alerta(), boton(), pill() y contenidoEvidencias() de
   inicio.js (se llaman al montar, cuando ya están cargadas).
   ------------------------------------------------------------------ */
(function () {
  const UN_DIA_MS = 24 * 60 * 60 * 1000;
  const DIAS_SEMANA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const MESES = [
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

  const MARGEN_DIAS = 2; // días libres antes y después de las actividades
  const PASO_DIAS = 7; // "+ Días atrás" / "+ Días adelante" suman una semana
  const ANCHO_MIN_COLUMNA = 14; // px; por debajo, desplazamiento horizontal
  const ANCHO_DIA_HORIZONTAL = 46; // px; desde aquí "Vie 13" cabe en una línea
  const ANCHO_SEMANA_LARGA = 64; // px; "Semana 2" o, si no cabe, "S2"
  const ANCHO_MES_LARGO = 110; // px; "Noviembre 2026" o, si no cabe, "Nov"
  const UMBRAL_ARRASTRE_PX = 4;
  const BORDE_ESTIRAR_PX = 8;
  // Igual que el servidor (servicios/avisosActividades.js): "por vencer" es
  // vencer hoy o en los próximos 3 días.
  const DIAS_POR_VENCER = 3;

  const ICONO_ENGRANAJE =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';

  let secuenciaIds = 0;

  function crear(etiqueta, clase, texto) {
    const el = document.createElement(etiqueta);
    if (clase) el.className = clase;
    if (texto !== undefined) el.textContent = texto;
    return el;
  }

  /* ---------- Fechas (siempre a medianoche local) ---------- */

  function hoyLocal() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function sumarDias(fecha, dias) {
    const d = new Date(fecha);
    d.setDate(d.getDate() + dias);
    return d;
  }

  function diasEntre(desde, hasta) {
    return Math.round((hasta - desde) / UN_DIA_MS);
  }

  function aISO(fecha) {
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
    const dia = String(fecha.getDate()).padStart(2, "0");
    return `${fecha.getFullYear()}-${mes}-${dia}`;
  }

  // El API entrega las columnas DATE como "AAAA-MM-DD" o como ISO con hora
  // UTC ("2026-11-08T00:00:00.000Z"). Se toma la parte de la fecha tal cual:
  // pasarla por new Date() la correría un día en zonas al oeste de UTC.
  function deISO(valor) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor ? String(valor) : "");
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  }

  function semanaDelMes(fecha) {
    return Math.ceil(fecha.getDate() / 7);
  }

  function textoFecha(fecha) {
    return `${DIAS_SEMANA[fecha.getDay()]} ${fecha.getDate()} ${MESES[fecha.getMonth()]
      .slice(0, 3)
      .toLowerCase()}`;
  }

  // Plazo de una actividad pendiente con fechas: vencida o por vencer.
  function plazoDe(tarea, hoy) {
    if (tarea.actividad.estado === "completada" || tarea.provisional) return null;
    const dias = diasEntre(hoy, tarea.fin);
    if (dias < 0) {
      return { clase: "vencida", texto: "Vencida", tipo: "crit", dias };
    }
    if (dias <= DIAS_POR_VENCER) {
      return { clase: "por-vencer", texto: "Por vencer", tipo: "warn", dias };
    }
    return null;
  }

  function textoDuracion(dias) {
    return dias === 1 ? "1 día" : `${dias} días`;
  }

  /* ---------- Modelo ---------- */

  // Sin fechas guardadas, la actividad se muestra provisional (desde hoy +
  // su posición, dos días), como lo hacía el Gantt anterior.
  function prepararTareas(actividades, hoy) {
    return actividades.map((actividad, indice) => {
      let inicio = deISO(actividad.fecha_inicio);
      let fin = deISO(actividad.fecha_fin);
      const provisional = !inicio || !fin;
      if (!inicio) inicio = fin ? new Date(fin) : sumarDias(hoy, indice);
      if (!fin) fin = sumarDias(inicio, 1);
      if (fin < inicio) fin = new Date(inicio);
      return { actividad, inicio, fin, provisional };
    });
  }

  function calcularRango(tareas, hoy, ajuste) {
    const inicioMin = new Date(Math.min(...tareas.map((t) => t.inicio.getTime())));
    const finMax = new Date(Math.max(...tareas.map((t) => t.fin.getTime())));
    const finDeMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);

    let inicio = sumarDias(inicioMin, -MARGEN_DIAS - ajuste.atras);
    if (inicio < hoy) inicio = new Date(hoy);
    let fin = sumarDias(finMax, MARGEN_DIAS);
    if (fin < finDeMes) fin = finDeMes;
    fin = sumarDias(fin, ajuste.adelante);

    const total = diasEntre(inicio, fin) + 1;
    const dias = Array.from({ length: total }, (_, i) => sumarDias(inicio, i));
    return { inicio, fin, dias, total };
  }

  // Agrupa días consecutivos con la misma clave: [{ desde, hasta, fecha }]
  // (hasta es exclusivo; índices de columna desde 0).
  function tramos(dias, clave) {
    const lista = [];
    dias.forEach((fecha, i) => {
      const k = clave(fecha);
      const ultimo = lista[lista.length - 1];
      if (ultimo && ultimo.clave === k) ultimo.hasta = i + 1;
      else lista.push({ clave: k, desde: i, hasta: i + 1, fecha });
    });
    return lista;
  }

  function columnas(desde, hasta) {
    return `${desde + 1} / ${hasta + 1}`;
  }

  /* ---------- Componente ---------- */

  /**
   * opciones:
   *  - actividades: actividades de la fase (como las entrega el API).
   *  - proyectoId, textoFase.
   *  - usuarios: [{ valor, texto }] para el responsable.
   *  - ajuste: { atras, adelante } en días; el llamador lo conserva entre
   *    recargas para no perder las semanas que el usuario sumó.
   *  - alCambiar(): recarga la sección después de guardar.
   *  - mostrarError(texto).
   */
  function montarGanttActividades(opciones) {
    const { actividades, proyectoId, usuarios, ajuste, alCambiar, mostrarError } = opciones;
    const hoy = hoyLocal();
    const tareas = prepararTareas(actividades, hoy);

    const raiz = crear("div", "gantt");
    const controles = crear("div", "gantt-controles");
    const marco = crear("div", "gantt-marco");
    const lienzo = crear("div", "gantt-lienzo");
    marco.append(lienzo);
    raiz.append(controles, marco);

    let rango = null;
    let popup = null;
    let celdasSemana = [];
    let celdasMes = [];

    function nombreUsuario(id) {
      if (!id) return null;
      const u = usuarios.find((o) => String(o.valor) === String(id));
      return u ? u.texto : null;
    }

    /* --- Ancho de columna: decide días en vertical y textos cortos --- */

    function ajustarTextos() {
      const ancho = lienzo.clientWidth / rango.total;
      if (!ancho) return; // fase plegada: se ajusta al abrirla
      raiz.dataset.dias = ancho >= ANCHO_DIA_HORIZONTAL ? "horizontal" : "vertical";
      celdasSemana.forEach(({ celda, span }) =>
        celda.classList.toggle("estrecha", span * ancho < ANCHO_SEMANA_LARGA)
      );
      celdasMes.forEach(({ celda, span }) =>
        celda.classList.toggle("estrecha", span * ancho < ANCHO_MES_LARGO)
      );
    }

    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(() => rango && ajustarTextos()).observe(lienzo);
    }

    /* --- Dibujo --- */

    function celdaConTextos(clase, largo, corto, gridColumn) {
      const celda = crear("div", clase);
      celda.style.gridColumn = gridColumn;
      celda.title = largo;
      celda.append(crear("span", "texto-largo", largo), crear("span", "texto-corto", corto));
      return celda;
    }

    function clasesDia(fecha, i) {
      const clases = [];
      if (fecha.getTime() === hoy.getTime()) clases.push("es-hoy");
      if (fecha.getDay() === 0 || fecha.getDay() === 6) clases.push("fin-semana");
      if (i > 0 && fecha.getDate() === 1) clases.push("inicio-mes");
      else if (i > 0 && semanaDelMes(fecha) !== semanaDelMes(sumarDias(fecha, -1)))
        clases.push("inicio-semana");
      return clases;
    }

    function dibujarEncabezado() {
      const meses = crear("div", "gantt-fila-enc gantt-meses");
      celdasMes = tramos(rango.dias, (d) => `${d.getFullYear()}-${d.getMonth()}`).map((t) => {
        const nombre = MESES[t.fecha.getMonth()];
        const celda = celdaConTextos(
          "gantt-mes",
          `${nombre} ${t.fecha.getFullYear()}`,
          nombre.slice(0, 3),
          columnas(t.desde, t.hasta)
        );
        if (t.desde > 0) celda.classList.add("inicio-mes");
        meses.append(celda);
        return { celda, span: t.hasta - t.desde };
      });

      const semanas = crear("div", "gantt-fila-enc gantt-semanas");
      celdasSemana = tramos(
        rango.dias,
        (d) => `${d.getFullYear()}-${d.getMonth()}-${semanaDelMes(d)}`
      ).map((t) => {
        const n = semanaDelMes(t.fecha);
        const celda = celdaConTextos(
          "gantt-semana",
          `Semana ${n}`,
          `S${n}`,
          columnas(t.desde, t.hasta)
        );
        if (t.desde > 0)
          celda.classList.add(t.fecha.getDate() === 1 ? "inicio-mes" : "inicio-semana");
        semanas.append(celda);
        return { celda, span: t.hasta - t.desde };
      });

      const dias = crear("div", "gantt-fila-enc gantt-dias");
      rango.dias.forEach((fecha, i) => {
        const celda = crear("div", ["gantt-dia", ...clasesDia(fecha, i)].join(" "));
        celda.title = textoFecha(fecha);
        celda.append(crear("span", "", `${DIAS_SEMANA[fecha.getDay()]} ${fecha.getDate()}`));
        dias.append(celda);
      });

      return [meses, semanas, dias];
    }

    // Columnas de fondo: líneas de día/semana/mes, fines de semana y hoy.
    function dibujarFondo() {
      const fondo = crear("div", "gantt-fondo");
      fondo.setAttribute("aria-hidden", "true");
      rango.dias.forEach((fecha, i) => {
        fondo.append(crear("div", ["gantt-col", ...clasesDia(fecha, i)].join(" ")));
      });
      return fondo;
    }

    // Etiqueta dentro de la barra si es lo más ancho de la fila; si no, al
    // lado con más espacio. Siempre ocupa su propio tramo de columnas, así
    // que se recorta con "…" en vez de montarse sobre otra cosa.
    function ubicar(barra, etiqueta, desde, hasta) {
      barra.style.gridColumn = columnas(desde, hasta + 1);
      const izquierda = desde;
      const derecha = rango.total - 1 - hasta;
      const anchoBarra = hasta - desde + 1;
      etiqueta.classList.remove("gantt-etiqueta--izq");
      if (anchoBarra >= Math.max(izquierda, derecha)) {
        barra.classList.add("con-texto");
        etiqueta.hidden = true;
      } else {
        barra.classList.remove("con-texto");
        etiqueta.hidden = false;
        if (derecha >= izquierda) {
          etiqueta.style.gridColumn = columnas(hasta + 1, rango.total);
        } else {
          etiqueta.style.gridColumn = columnas(0, desde);
          etiqueta.classList.add("gantt-etiqueta--izq");
        }
      }
    }

    function dibujarFila(tarea) {
      const { actividad } = tarea;
      const completada = actividad.estado === "completada";
      let desde = diasEntre(rango.inicio, tarea.inicio);
      let hasta = diasEntre(rango.inicio, tarea.fin);
      const recortada = desde < 0;
      desde = Math.min(Math.max(desde, 0), rango.total - 1);
      hasta = Math.min(Math.max(hasta, desde), rango.total - 1);

      const fila = crear("div", "gantt-fila");
      const texto = `${completada ? "✓ " : ""}${actividad.descripcion}`;

      const barra = crear("button", "gantt-barra");
      barra.type = "button";
      barra.dataset.actividadId = String(actividad.id);
      if (completada) barra.classList.add("gantt-barra--completada");
      if (recortada) barra.classList.add("gantt-barra--recortada");
      const plazo = plazoDe(tarea, hoy);
      if (plazo) barra.classList.add(`gantt-barra--${plazo.clase}`);
      barra.setAttribute("aria-haspopup", "dialog");
      barra.setAttribute("aria-expanded", "false");
      barra.setAttribute(
        "aria-label",
        `${actividad.descripcion}. ${
          tarea.provisional
            ? "Sin fechas definidas"
            : `${textoFecha(tarea.inicio)} a ${textoFecha(tarea.fin)}`
        }. ${completada ? "Completada" : "Pendiente"}${plazo ? `, ${plazo.texto.toLowerCase()}` : ""}.`
      );
      barra.append(crear("span", "gantt-barra-texto", texto));

      const etiqueta = crear("span", "gantt-etiqueta", texto);
      etiqueta.setAttribute("aria-hidden", "true");
      etiqueta.title = actividad.descripcion;
      etiqueta.addEventListener("click", () => barra.click());

      ubicar(barra, etiqueta, desde, hasta);
      habilitarArrastre(barra, etiqueta, tarea, desde, hasta, recortada);
      barra.addEventListener("click", () => {
        if (barra.dataset.recienArrastrada) {
          delete barra.dataset.recienArrastrada;
          return;
        }
        if (popup && popup.barra === barra) cerrarPopup();
        else abrirPopup(tarea, barra);
      });

      fila.append(barra, etiqueta);
      return fila;
    }

    function dibujarControles() {
      const atras = boton(
        "+ Días atrás",
        () => {
          ajuste.atras += PASO_DIAS;
          dibujar();
        },
        true
      );
      // Nunca antes de hoy: si el rango ya empieza hoy, no hay hacia dónde ir.
      atras.disabled = rango.inicio.getTime() <= hoy.getTime();
      if (atras.disabled) atras.title = "El diagrama no muestra días anteriores a hoy";

      const adelante = boton(
        "+ Días adelante",
        () => {
          ajuste.adelante += PASO_DIAS;
          dibujar();
        },
        true
      );

      const resumen = crear(
        "span",
        "gantt-rango subtitulo",
        `${textoFecha(rango.inicio)} – ${textoFecha(rango.fin)} · ${textoDuracion(rango.total)}`
      );
      controles.replaceChildren(atras, resumen, adelante);
    }

    function dibujar() {
      cerrarPopup();
      rango = calcularRango(tareas, hoy, ajuste);
      raiz.style.setProperty("--dias", String(rango.total));
      lienzo.style.minWidth = `${rango.total * ANCHO_MIN_COLUMNA}px`;

      const cuerpo = crear("div", "gantt-cuerpo");
      cuerpo.append(dibujarFondo(), ...tareas.map(dibujarFila));
      lienzo.replaceChildren(...dibujarEncabezado(), cuerpo);
      dibujarControles();
      ajustarTextos();
    }

    /* --- Arrastrar para mover o estirar --- */

    function habilitarArrastre(barra, etiqueta, tarea, desde0, hasta0, recortada) {
      // Una barra recortada empieza antes de hoy: arrastrarla movería su
      // inicio real sin verlo. Sus fechas se cambian desde el engranaje.
      if (recortada) return;
      barra.addEventListener("pointerdown", (evento) => {
        if (evento.button !== 0) return;
        const caja = barra.getBoundingClientRect();
        const enBorde = caja.width > BORDE_ESTIRAR_PX * 3;
        const x = evento.clientX - caja.left;
        const modo =
          enBorde && x <= BORDE_ESTIRAR_PX
            ? "inicio"
            : enBorde && x >= caja.width - BORDE_ESTIRAR_PX
              ? "fin"
              : "mover";
        const anchoColumna = barra.parentElement.getBoundingClientRect().width / rango.total;
        const xInicial = evento.clientX;
        let arrastrando = false;
        let desde = desde0;
        let hasta = hasta0;
        barra.setPointerCapture(evento.pointerId);

        function mover(e) {
          const dx = e.clientX - xInicial;
          if (!arrastrando && Math.abs(dx) < UMBRAL_ARRASTRE_PX) return;
          if (!arrastrando) {
            arrastrando = true;
            cerrarPopup();
            barra.classList.add("arrastrando");
          }
          const delta = Math.round(dx / anchoColumna);
          if (modo === "mover") {
            const largo = hasta0 - desde0;
            desde = Math.min(Math.max(desde0 + delta, 0), rango.total - 1 - largo);
            hasta = desde + largo;
          } else if (modo === "inicio") {
            desde = Math.min(Math.max(desde0 + delta, 0), hasta0);
          } else {
            hasta = Math.max(Math.min(hasta0 + delta, rango.total - 1), desde0);
          }
          ubicar(barra, etiqueta, desde, hasta);
          barra.title = `${textoFecha(rango.dias[desde])} – ${textoFecha(rango.dias[hasta])}`;
        }

        async function soltar() {
          barra.removeEventListener("pointermove", mover);
          barra.removeEventListener("pointerup", soltar);
          barra.removeEventListener("pointercancel", soltar);
          if (!arrastrando) return;
          barra.classList.remove("arrastrando");
          barra.removeAttribute("title");
          // El click que llega justo después de soltar no abre la tarjeta.
          barra.dataset.recienArrastrada = "1";
          setTimeout(() => delete barra.dataset.recienArrastrada, 0);
          if (desde === desde0 && hasta === hasta0) return;
          const r = await api("PUT", `/proyectos/${proyectoId}/actividades/${tarea.actividad.id}`, {
            fecha_inicio: aISO(rango.dias[desde]),
            fecha_fin: aISO(rango.dias[hasta]),
          });
          if (r.status !== 200) {
            mostrarError(r.cuerpo?.error || "No se pudieron guardar las nuevas fechas.");
            ubicar(barra, etiqueta, desde0, hasta0);
            return;
          }
          await alCambiar();
        }

        barra.addEventListener("pointermove", mover);
        barra.addEventListener("pointerup", soltar);
        barra.addEventListener("pointercancel", soltar);
      });
    }

    /* --- Tarjeta de resumen al hacer clic --- */

    function cerrarPopup(devolverFoco = false) {
      if (!popup) return;
      const { caja, barra, quitarEscuchas } = popup;
      popup = null;
      quitarEscuchas();
      caja.remove();
      barra.setAttribute("aria-expanded", "false");
      if (devolverFoco) barra.focus();
    }

    function posicionarPopup() {
      if (!popup) return;
      const { caja, barra } = popup;
      const r = barra.getBoundingClientRect();
      const ancho = caja.offsetWidth;
      const alto = caja.offsetHeight;
      const izquierda = Math.min(Math.max(r.left, 8), window.innerWidth - ancho - 8);
      let arriba = r.bottom + 8;
      if (arriba + alto > window.innerHeight - 8) arriba = Math.max(8, r.top - alto - 8);
      caja.style.left = `${izquierda}px`;
      caja.style.top = `${arriba}px`;
    }

    function abrirPopup(tarea, barra) {
      cerrarPopup();
      const { actividad } = tarea;
      const completada = actividad.estado === "completada";
      const idTitulo = `gantt-popup-${++secuenciaIds}`;

      const caja = crear("div", "gantt-popup");
      caja.setAttribute("role", "dialog");
      caja.setAttribute("aria-labelledby", idTitulo);

      const cabecera = crear("div", "gantt-popup-cabecera");
      const etiquetas = crear("div", "gantt-popup-etiquetas");
      etiquetas.append(pill(completada ? "Completada" : "Pendiente", completada ? "good" : "info"));
      const plazo = plazoDe(tarea, hoy);
      if (plazo) etiquetas.append(pill(plazo.texto, plazo.tipo));
      etiquetas.append(pill(actividad.categoria || "General", "mute"));
      const engranaje = crear("button", "boton-icono gantt-engranaje");
      engranaje.type = "button";
      engranaje.innerHTML = ICONO_ENGRANAJE;
      engranaje.setAttribute("aria-label", "Gestionar actividad");
      engranaje.title = "Gestionar actividad: datos, responsable, evidencias";
      engranaje.addEventListener("click", () => {
        cerrarPopup();
        abrirGestion(tarea, barra);
      });
      const cerrar = crear("button", "boton-icono", "×");
      cerrar.type = "button";
      cerrar.setAttribute("aria-label", "Cerrar");
      cerrar.addEventListener("click", () => cerrarPopup(true));
      cabecera.append(etiquetas, engranaje, cerrar);

      const titulo = crear("h4", "gantt-popup-titulo", actividad.descripcion);
      titulo.id = idTitulo;

      const datos = crear("dl", "gantt-popup-datos");
      function dato(nombre, valor) {
        datos.append(crear("dt", "", nombre), crear("dd", "", valor));
      }
      dato(
        "Fechas",
        tarea.provisional
          ? "Sin definir"
          : `${textoFecha(tarea.inicio)} → ${textoFecha(tarea.fin)} · ${textoDuracion(
              diasEntre(tarea.inicio, tarea.fin) + 1
            )}`
      );
      dato("Responsable", nombreUsuario(actividad.responsable_id) || "Sin asignar");

      caja.append(cabecera, titulo, datos);
      if (tarea.provisional) {
        caja.append(
          crear(
            "p",
            "gantt-popup-nota",
            "La barra está en una posición provisional. Arrástrala o usa el engranaje para fijar sus fechas."
          )
        );
      } else if (barra.classList.contains("gantt-barra--recortada")) {
        const inicioTexto =
          plazo && plazo.clase === "vencida"
            ? `Venció el ${textoFecha(tarea.fin)}`
            : "Empezó antes de hoy";
        caja.append(
          crear(
            "p",
            "gantt-popup-nota",
            `${inicioTexto}; el diagrama solo muestra desde hoy. Sus fechas se cambian con el engranaje.`
          )
        );
      }

      function alPresionarFuera(e) {
        if (!caja.contains(e.target) && !barra.contains(e.target)) cerrarPopup();
      }
      function alTeclear(e) {
        if (e.key === "Escape") cerrarPopup(true);
      }
      document.addEventListener("pointerdown", alPresionarFuera, true);
      document.addEventListener("keydown", alTeclear);
      window.addEventListener("scroll", posicionarPopup, true);
      window.addEventListener("resize", posicionarPopup);
      const quitarEscuchas = () => {
        document.removeEventListener("pointerdown", alPresionarFuera, true);
        document.removeEventListener("keydown", alTeclear);
        window.removeEventListener("scroll", posicionarPopup, true);
        window.removeEventListener("resize", posicionarPopup);
      };

      raiz.append(caja);
      popup = { caja, barra, quitarEscuchas };
      barra.setAttribute("aria-expanded", "true");
      posicionarPopup();
      engranaje.focus({ preventScroll: true });
    }

    /* --- Ventana de gestión (engranaje) --- */

    function campo(etiqueta, control) {
      const div = crear("div", "campo");
      const id = `gantt-campo-${++secuenciaIds}`;
      const label = crear("label", "", etiqueta);
      label.htmlFor = id;
      control.id = id;
      div.append(label, control);
      return div;
    }

    function entrada(tipo, valor, requerido) {
      const input = document.createElement("input");
      input.type = tipo;
      input.value = valor || "";
      input.required = Boolean(requerido);
      return input;
    }

    function selector(opcionesSelect, valor) {
      const select = document.createElement("select");
      opcionesSelect.forEach(({ valor: v, texto }) => {
        const o = crear("option", "", texto);
        o.value = v;
        select.append(o);
      });
      select.value = valor;
      return select;
    }

    function abrirGestion(tarea, barra) {
      const { actividad } = tarea;
      const idTitulo = `gantt-dialogo-${++secuenciaIds}`;
      const dialogo = crear("dialog", "dialogo-actividad");
      dialogo.setAttribute("aria-labelledby", idTitulo);

      const cabecera = crear("header", "dialogo-cabecera");
      const titulos = crear("div");
      titulos.append(
        crear("p", "subtitulo", `${opciones.textoFase} · Actividad`),
        Object.assign(crear("h3", "", actividad.descripcion), { id: idTitulo })
      );
      const cerrarX = crear("button", "boton-icono", "×");
      cerrarX.type = "button";
      cerrarX.setAttribute("aria-label", "Cerrar");
      cerrarX.addEventListener("click", () => cerrarDialogo());
      cabecera.append(titulos, cerrarX);

      const mensaje = crear("div");

      // Datos de la actividad
      const form = crear("form", "dialogo-seccion");
      form.noValidate = true;
      const tieneFechas = Boolean(deISO(actividad.fecha_inicio) && deISO(actividad.fecha_fin));
      const descripcion = entrada("text", actividad.descripcion, true);
      const categoria = entrada("text", actividad.categoria, true);
      const responsable = selector(
        [{ valor: "", texto: "— Sin asignar —" }, ...usuarios],
        actividad.responsable_id ? String(actividad.responsable_id) : ""
      );
      const estado = selector(
        [
          { valor: "pendiente", texto: "Pendiente" },
          { valor: "completada", texto: "Completada" },
        ],
        actividad.estado === "completada" ? "completada" : "pendiente"
      );
      const fechaInicio = entrada(
        "date",
        tieneFechas ? aISO(deISO(actividad.fecha_inicio)) : "",
        tieneFechas
      );
      const fechaFin = entrada(
        "date",
        tieneFechas ? aISO(deISO(actividad.fecha_fin)) : "",
        tieneFechas
      );

      const rejilla = crear("div", "formulario-grid");
      rejilla.append(
        campo("Actividad *", descripcion),
        campo("Categoría *", categoria),
        campo("Responsable", responsable),
        campo("Estado", estado),
        campo(tieneFechas ? "Fecha de inicio *" : "Fecha de inicio", fechaInicio),
        campo(tieneFechas ? "Fecha de fin *" : "Fecha de fin", fechaFin)
      );
      const guardar = crear("button", "boton boton-pequeno", "Guardar cambios");
      guardar.type = "submit";
      const acciones = crear("div", "dialogo-acciones");
      acciones.append(
        guardar,
        boton("Cancelar", () => cerrarDialogo(), true)
      );
      form.append(rejilla, acciones);

      let modificado = false;
      form.addEventListener("input", () => (modificado = true));
      form.addEventListener("change", () => (modificado = true));

      form.addEventListener("submit", async (evento) => {
        evento.preventDefault();
        mensaje.replaceChildren();
        const datos = {};
        const desc = descripcion.value.trim();
        const cat = categoria.value.trim();
        if (!desc || !cat) {
          mensaje.append(alerta("error", "La actividad y la categoría son obligatorias."));
          return;
        }
        if (desc !== actividad.descripcion) datos.descripcion = desc;
        if (cat !== actividad.categoria) datos.categoria = cat;
        const resp = responsable.value ? Number(responsable.value) : null;
        if (resp !== (actividad.responsable_id || null)) datos.responsable_id = resp;
        if (estado.value !== actividad.estado) datos.estado = estado.value;

        const fi = fechaInicio.value;
        const ff = fechaFin.value;
        if (Boolean(fi) !== Boolean(ff)) {
          mensaje.append(alerta("error", "Indica la fecha de inicio y la de fin, o ninguna."));
          return;
        }
        if (tieneFechas && !fi) {
          mensaje.append(
            alerta("error", "La actividad ya tiene fechas: no se pueden dejar vacías.")
          );
          return;
        }
        if (fi && ff < fi) {
          mensaje.append(alerta("error", "La fecha de fin no puede ser anterior a la de inicio."));
          return;
        }
        if (fi && (!tieneFechas || fi !== aISO(tarea.inicio) || ff !== aISO(tarea.fin))) {
          datos.fecha_inicio = fi;
          datos.fecha_fin = ff;
        }

        if (Object.keys(datos).length === 0) {
          cerrarDialogo(true);
          return;
        }
        guardar.disabled = true;
        const r = await api("PUT", `/proyectos/${proyectoId}/actividades/${actividad.id}`, datos);
        guardar.disabled = false;
        if (r.status !== 200) {
          mensaje.append(alerta("error", r.cuerpo?.error || "No se pudo guardar la actividad."));
          return;
        }
        cerrarDialogo(true);
        await alCambiar();
      });

      // Evidencias (documentos de la actividad)
      const evidencias = crear("section", "dialogo-seccion");
      evidencias.append(
        crear("h4", "", "Evidencias"),
        contenidoEvidencias("proyecto_actividades", actividad.id)
      );

      // Quitar la actividad
      const zonaQuitar = crear("section", "dialogo-seccion dialogo-quitar");
      const quitar = boton(
        "Quitar actividad",
        async () => {
          if (
            !window.confirm(
              `¿Quitar la actividad "${actividad.descripcion}"? Deja de verse en el diagrama y en el avance de la fase.`
            )
          )
            return;
          const r = await api("DELETE", `/proyectos/${proyectoId}/actividades/${actividad.id}`);
          if (r.status !== 204) {
            mensaje.replaceChildren(
              alerta("error", r.cuerpo?.error || "No se pudo quitar la actividad.")
            );
            return;
          }
          cerrarDialogo(true);
          await alCambiar();
        },
        true
      );
      quitar.classList.add("boton-peligro");
      zonaQuitar.append(
        crear("p", "subtitulo", "Quita este paso del proyecto y de su diagrama."),
        quitar
      );

      const cuerpo = crear("div", "dialogo-cuerpo");
      cuerpo.append(mensaje, form, evidencias, zonaQuitar);
      dialogo.append(cabecera, cuerpo);

      // La ventana tiene sus propios Guardar/Cancelar: sus formularios no
      // activan el aviso de "cambios sin guardar" de la página.
      dialogo.querySelectorAll("form").forEach((f) => (f.dataset.sucioVigilado = "1"));

      function cerrarDialogo(sinPreguntar = false) {
        if (
          !sinPreguntar &&
          modificado &&
          !window.confirm("Hay cambios sin guardar en la actividad. ¿Descartarlos?")
        )
          return;
        dialogo.close();
      }
      dialogo.addEventListener("cancel", (e) => {
        e.preventDefault();
        cerrarDialogo();
      });
      dialogo.addEventListener("close", () => {
        dialogo.remove();
        if (barra.isConnected) barra.focus();
      });

      raiz.append(dialogo);
      dialogo.showModal();
      descripcion.focus();
    }

    dibujar();
    return raiz;
  }

  window.montarGanttActividades = montarGanttActividades;
})();
