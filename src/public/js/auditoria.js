/* global api, contenido, marcarMenu, alerta, pill, boton, encabezado, formatoFechaHora,
   obtenerUsuarios, textoEstadoProyecto, textoEstadoCotizacion, textoEstadoRequisicion,
   textoEstadoOrdenCompra, textoEstadoExpediente */
/* ------------------------------------------------------------------
   Auditoría (#/auditoria): quién creó, cambió o eliminó cada registro del
   ERP, y cuándo. Solo para admin y Gerente General (permiso ver_auditoria,
   que el servidor exige). Desde Usuarios, "Ver actividad" abre esta vista
   filtrada por esa persona (#/auditoria?usuario=ID).
   ------------------------------------------------------------------ */
(function () {
  const TAMANO_PAGINA = 25;
  const CAMBIOS_VISIBLES = 3;
  const ESPERA_BUSQUEDA_MS = 300;
  const ACCIONES = {
    crear: { texto: "Creó", tipo: "good" },
    actualizar: { texto: "Cambió", tipo: "info" },
    eliminar: { texto: "Eliminó", tipo: "crit" },
  };

  function crear(etiqueta, clase, texto) {
    const el = document.createElement(etiqueta);
    if (clase) el.className = clase;
    if (texto !== undefined) el.textContent = texto;
    return el;
  }

  // "fecha_fin" → "Fecha fin"; "responsable_id" → "Responsable"
  const etiquetaCampo = (campo) =>
    campo
      .replace(/_id$/, "")
      .replace(/_/g, " ")
      .replace(/^./, (l) => l.toUpperCase());

  function opcion(valor, texto) {
    const o = crear("option", "", texto);
    o.value = valor;
    return o;
  }

  function campoFiltro(etiqueta, control) {
    const caja = crear("label", "aud-filtro");
    caja.append(crear("span", "", etiqueta), control);
    return caja;
  }

  // Estados con catálogo propio en su módulo (con tildes y textos de negocio).
  const TEXTO_ESTADO = {
    proyectos: (v) => textoEstadoProyecto(v),
    cotizaciones: (v) => textoEstadoCotizacion(v),
    requisiciones: (v) => textoEstadoRequisicion(v),
    ordenes_compra: (v) => textoEstadoOrdenCompra(v),
    expedientes_diseno: (v) => textoEstadoExpediente(v),
  };
  // Para los demás códigos (en_curso, correctivo…): sin guiones, con mayúscula
  // inicial y las tildes de las palabras que más se repiten.
  const TILDES = {
    revision: "revisión",
    cotizacion: "cotización",
    aprobacion: "aprobación",
    ingenieria: "ingeniería",
    diseno: "diseño",
    garantia: "garantía",
    produccion: "producción",
    instalacion: "instalación",
    automatica: "automática",
  };
  const humanizar = (codigo) =>
    codigo
      .split("_")
      .map((p) => TILDES[p] || p)
      .join(" ")
      .replace(/^./, (l) => l.toUpperCase());
  const ES_CODIGO = /^[a-z]+(_[a-z]+)*$/;
  const ES_FECHA = /^\d{4}-\d{2}-\d{2}/;

  // Las columnas DATE (fecha*) llegan como medianoche del servidor en UTC:
  // los 10 primeros caracteres ya son el día, sin convertir de zona.
  const soloFecha = (texto) => texto.slice(0, 10).split("-").reverse().join("/");

  // Texto legible de un valor de la auditoría: fechas en el formato de la
  // pantalla (las de hora, en la hora local de quien la ve), estados y tipos
  // con su nombre, sí/no en vez de 1/0.
  function textoLegible(tabla, campo, texto) {
    if (/estado/.test(campo) && TEXTO_ESTADO[tabla]) {
      const conCatalogo = TEXTO_ESTADO[tabla](texto);
      if (conCatalogo !== texto) return conCatalogo;
    }
    if (/^fecha/.test(campo) && ES_FECHA.test(texto)) return soloFecha(texto);
    if (/(_en|_at|_hasta|_expira)$/.test(campo) && ES_FECHA.test(texto)) {
      return formatoFechaHora(texto);
    }
    if (/^hora_/.test(campo) && /^\d{2}:\d{2}/.test(texto)) return texto.slice(0, 5);
    if (campo === "activo" || campo === "en_garantia") return Number(texto) ? "Sí" : "No";
    if (/estado|tipo|prioridad|resultado|origen/.test(campo) && ES_CODIGO.test(texto)) {
      return humanizar(texto);
    }
    return texto;
  }

  // Un valor vacío se dice con palabras (no se tacha).
  function valor(tabla, campo, texto, clase) {
    if (texto === null || texto === undefined) return crear("span", "muted", "vacío");
    return crear("span", clase, textoLegible(tabla, campo, texto));
  }

  function listaCambios(tabla, cambios) {
    const ul = crear("ul", "aud-cambios");
    cambios.forEach((c) => {
      const li = crear("li");
      li.append(
        crear("b", "", `${etiquetaCampo(c.campo)}: `),
        valor(tabla, c.campo, c.antes, "aud-antes"),
        " → ",
        valor(tabla, c.campo, c.despues, "aud-despues")
      );
      ul.append(li);
    });
    return ul;
  }

  function celdaCambios(r) {
    const td = crear("td");
    if (r.accion !== "actualizar") {
      td.append(
        crear("span", "muted", r.accion === "crear" ? "Registro nuevo" : "Registro eliminado")
      );
      return td;
    }
    if (r.cambios.length === 0) {
      td.append(crear("span", "muted", "Sin cambios en los datos"));
      return td;
    }
    td.append(listaCambios(r.tabla, r.cambios.slice(0, CAMBIOS_VISIBLES)));
    if (r.cambios.length > CAMBIOS_VISIBLES) {
      const resto = r.cambios.length - CAMBIOS_VISIBLES;
      const mas = crear("details", "aud-mas");
      mas.append(
        crear("summary", "", `${resto} ${resto === 1 ? "cambio más" : "cambios más"}`),
        listaCambios(r.tabla, r.cambios.slice(CAMBIOS_VISIBLES))
      );
      td.append(mas);
    }
    return td;
  }

  function celdaRegistro(r) {
    const td = crear("td");
    td.append(crear("div", "aud-modulo", r.modulo));
    const texto = r.documento || `Registro ${r.registro_id}`;
    if (r.enlace) {
      const a = crear("a", "aud-documento", texto);
      a.href = r.enlace;
      td.append(a);
    } else {
      td.append(crear("span", "aud-documento", texto));
    }
    return td;
  }

  function fila(r) {
    const tr = crear("tr");
    const accion = ACCIONES[r.accion] || { texto: r.accion, tipo: "mute" };
    const tdAccion = crear("td");
    tdAccion.append(pill(accion.texto, accion.tipo));
    tr.append(
      crear("td", "aud-fecha", formatoFechaHora(r.creado_en)),
      crear("td", "", r.usuario_nombre || "Sistema"),
      tdAccion,
      celdaRegistro(r),
      celdaCambios(r)
    );
    return tr;
  }

  async function vistaAuditoria() {
    marcarMenu("auditoria");
    const ruta = window.location.hash;
    const consulta = new URLSearchParams(ruta.split("?")[1] || "");
    const estado = {
      pagina: 1,
      desde: "",
      hasta: "",
      usuario_id: consulta.get("usuario") || "",
      tabla: "",
      accion: "",
      q: "",
    };
    contenido.replaceChildren(crear("p", "subtitulo", "Cargando…"));
    const usuarios = await obtenerUsuarios();
    if (window.location.hash !== ruta) return;

    const raiz = crear("div", "vista-auditoria");
    const mensaje = crear("div");

    // Filtros (fuera de un <form>: no son cambios sin guardar)
    const fDesde = Object.assign(crear("input"), { type: "date" });
    const fHasta = Object.assign(crear("input"), { type: "date" });
    const fUsuario = crear("select");
    fUsuario.append(opcion("", "Todas las personas"));
    [...usuarios]
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
      .forEach((u) => fUsuario.append(opcion(String(u.id), u.nombre)));
    fUsuario.value = estado.usuario_id;
    const fModulo = crear("select");
    fModulo.append(opcion("", "Todos los módulos"));
    const fAccion = crear("select");
    fAccion.append(
      opcion("", "Todas las acciones"),
      opcion("crear", "Creó"),
      opcion("actualizar", "Cambió"),
      opcion("eliminar", "Eliminó")
    );
    const fBuscar = Object.assign(crear("input"), {
      type: "search",
      placeholder: "Buscar código, nombre o texto…",
    });
    fBuscar.setAttribute("aria-label", "Buscar en la auditoría");
    const resumen = crear("span", "resumen-listado");
    const limpiar = boton(
      "Limpiar filtros",
      () => {
        Object.assign(estado, {
          pagina: 1,
          desde: "",
          hasta: "",
          usuario_id: "",
          tabla: "",
          accion: "",
          q: "",
        });
        [fDesde, fHasta, fUsuario, fModulo, fAccion, fBuscar].forEach((c) => (c.value = ""));
        cargar();
      },
      true
    );
    const controles = crear("div", "controles-listado aud-filtros");
    controles.append(
      campoFiltro("Desde", fDesde),
      campoFiltro("Hasta", fHasta),
      campoFiltro("Persona", fUsuario),
      campoFiltro("Módulo", fModulo),
      campoFiltro("Acción", fAccion),
      campoFiltro("Buscar", fBuscar),
      limpiar,
      resumen
    );

    const tabla = crear("table", "tabla-auditoria");
    const thead = crear("thead");
    const cabecera = crear("tr");
    ["Fecha", "Persona", "Acción", "Registro", "Qué cambió"].forEach((t) => {
      const th = crear("th", "", t);
      th.scope = "col";
      cabecera.append(th);
    });
    thead.append(cabecera);
    const tbody = crear("tbody");
    tabla.append(thead, tbody);
    const resultados = crear("div", "resultados-listado");
    resultados.append(tabla);
    const paginador = crear("div", "paginador");

    const tarjeta = crear("div", "tarjeta-ancha");
    tarjeta.append(controles, mensaje, resultados, paginador);
    raiz.append(
      encabezado("Auditoría"),
      crear(
        "p",
        "subtitulo",
        "Quién creó, cambió o eliminó cada registro del ERP, y cuándo. Solo la ven el administrador y el Gerente General."
      ),
      tarjeta
    );
    contenido.replaceChildren(raiz);

    let modulosCargados = false;
    let peticion = 0;

    async function cargar() {
      const numero = ++peticion;
      const parametros = new URLSearchParams({
        pagina: String(estado.pagina),
        tamanoPagina: String(TAMANO_PAGINA),
      });
      ["desde", "hasta", "usuario_id", "tabla", "accion", "q"].forEach((clave) => {
        if (estado[clave]) parametros.set(clave, estado[clave]);
      });
      resultados.setAttribute("aria-busy", "true");
      const r = await api("GET", `/auditoria?${parametros}`);
      // una respuesta vieja (el usuario siguió filtrando) o de otra vista no se pinta
      if (numero !== peticion || !raiz.isConnected) return;
      resultados.removeAttribute("aria-busy");
      if (r.status === 403) {
        contenido.replaceChildren(
          encabezado("Auditoría"),
          alerta("aviso", "La auditoría la ven el administrador y el Gerente General.")
        );
        return;
      }
      if (r.status !== 200) {
        mensaje.replaceChildren(
          alerta("error", r.cuerpo?.error || "No se pudo cargar la auditoría.")
        );
        return;
      }
      mensaje.replaceChildren();
      const { registros, total, modulos } = r.cuerpo;
      if (!modulosCargados) {
        modulos.forEach((m) => fModulo.append(opcion(m.tabla, m.etiqueta)));
        fModulo.value = estado.tabla;
        modulosCargados = true;
      }
      tbody.replaceChildren();
      if (registros.length === 0) {
        const tr = crear("tr");
        const td = crear("td", "subtitulo", "No hay registros con estos filtros.");
        td.colSpan = 5;
        tr.append(td);
        tbody.append(tr);
      } else {
        registros.forEach((x) => tbody.append(fila(x)));
      }
      resumen.textContent = `${total} ${total === 1 ? "registro" : "registros"}`;

      const paginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA));
      paginador.replaceChildren();
      if (paginas > 1) {
        const anterior = boton(
          "Anterior",
          () => {
            estado.pagina -= 1;
            cargar();
          },
          true
        );
        anterior.disabled = estado.pagina <= 1;
        const siguiente = boton(
          "Siguiente",
          () => {
            estado.pagina += 1;
            cargar();
          },
          true
        );
        siguiente.disabled = estado.pagina >= paginas;
        paginador.append(
          anterior,
          crear("span", "", `Página ${estado.pagina} de ${paginas}`),
          siguiente
        );
      }
    }

    const alCambiar = (clave, control) => () => {
      estado[clave] = control.value.trim();
      estado.pagina = 1;
      cargar();
    };
    fDesde.addEventListener("change", alCambiar("desde", fDesde));
    fHasta.addEventListener("change", alCambiar("hasta", fHasta));
    fUsuario.addEventListener("change", alCambiar("usuario_id", fUsuario));
    fModulo.addEventListener("change", alCambiar("tabla", fModulo));
    fAccion.addEventListener("change", alCambiar("accion", fAccion));
    let espera = null;
    fBuscar.addEventListener("input", () => {
      clearTimeout(espera);
      espera = setTimeout(alCambiar("q", fBuscar), ESPERA_BUSQUEDA_MS);
    });

    await cargar();
  }

  window.vistaAuditoria = vistaAuditoria;
})();
