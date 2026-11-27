/* global api, token, contenido, marcarMenu, alerta, boton, pill, encabezado, fechaCortaTexto,
   obtenerClientes, obtenerUsuarios, TIPOS_SERVICIO */
/* ------------------------------------------------------------------
   Listado Maestro de Servicios (FO-ST-006, #/listado-servicios): todos los
   servicios técnicos con filtros, en pantalla o descargados en CSV (Excel).
   Es una consulta sobre los reportes de servicio, no una tabla aparte.
   ------------------------------------------------------------------ */
(function () {
  const TAMANO_PAGINA = 25;
  const ESPERA_BUSQUEDA_MS = 300;
  const FILTROS = [
    "desde",
    "hasta",
    "cliente_id",
    "tipo_servicio",
    "tecnico_id",
    "en_garantia",
    "q",
  ];

  function crear(etiqueta, clase, texto) {
    const el = document.createElement(etiqueta);
    if (clase) el.className = clase;
    if (texto !== undefined) el.textContent = texto;
    return el;
  }

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

  function selectCon(primera, opciones) {
    const s = crear("select");
    s.append(opcion("", primera), ...opciones.map(([valor, texto]) => opcion(valor, texto)));
    return s;
  }

  function duracionTexto(minutos) {
    if (minutos === null || minutos === undefined) return "—";
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    if (h === 0) return `${m} min`;
    return m ? `${h} h ${m} min` : `${h} h`;
  }

  function fila(s) {
    const tr = crear("tr");
    const numero = crear("td");
    const enlace = crear("a", "enlace-documento", s.numero_reporte);
    enlace.href = `#/reportes-servicio/${s.id}`;
    numero.append(enlace);
    if (s.version > 1) numero.append(crear("span", "muted", ` · v${s.version}`));
    const equipo = crear("td");
    equipo.append(crear("div", "lm-serie", s.equipo_numero_serie));
    if (s.equipo_descripcion) equipo.append(crear("div", "muted", s.equipo_descripcion));
    const garantia = crear("td");
    garantia.append(s.en_garantia ? pill("Sí", "warn") : crear("span", "muted", "No"));
    tr.append(
      numero,
      crear("td", "", s.fecha_servicio ? fechaCortaTexto(s.fecha_servicio.slice(0, 10)) : "—"),
      crear("td", "", s.cliente_nombre),
      equipo,
      crear("td", "", `${s.proyecto_codigo} · ${s.proyecto_nombre}`),
      crear("td", "", s.tipo_servicio_texto),
      garantia,
      crear("td", "", s.tecnico_nombre || "—"),
      crear("td", "", duracionTexto(s.duracion_minutos))
    );
    return tr;
  }

  async function vistaListadoMaestro() {
    marcarMenu("listado-servicios");
    const ruta = window.location.hash;
    const estado = { pagina: 1 };
    FILTROS.forEach((f) => (estado[f] = ""));
    contenido.replaceChildren(crear("p", "subtitulo", "Cargando…"));
    const [clientes, usuarios] = await Promise.all([obtenerClientes(), obtenerUsuarios()]);
    if (window.location.hash !== ruta) return;

    const raiz = crear("div", "vista-listado-maestro");
    const mensaje = crear("div");

    // Filtros (fuera de un <form>: no son cambios sin guardar)
    const controles = {
      desde: Object.assign(crear("input"), { type: "date" }),
      hasta: Object.assign(crear("input"), { type: "date" }),
      cliente_id: selectCon(
        "Todos los clientes",
        clientes.map((c) => [String(c.id), c.nombre_razon_social])
      ),
      tipo_servicio: selectCon(
        "Todos los tipos",
        TIPOS_SERVICIO.map((t) => [t.valor, t.texto])
      ),
      tecnico_id: selectCon(
        "Todos los técnicos",
        usuarios.map((u) => [String(u.id), u.nombre])
      ),
      en_garantia: selectCon("Con y sin garantía", [
        ["si", "En garantía"],
        ["no", "Sin garantía"],
      ]),
      q: Object.assign(crear("input"), {
        type: "search",
        placeholder: "Número, serie, equipo, cliente, proyecto…",
      }),
    };
    controles.q.setAttribute("aria-label", "Buscar en el listado maestro");
    const resumen = crear("span", "resumen-listado");
    const limpiar = boton(
      "Limpiar filtros",
      () => {
        FILTROS.forEach((f) => {
          estado[f] = "";
          controles[f].value = "";
        });
        estado.pagina = 1;
        cargar();
      },
      true
    );
    const descargar = boton("Descargar CSV (Excel)", () => descargarCsv(), true);
    const barra = crear("div", "controles-listado aud-filtros");
    barra.append(
      campoFiltro("Desde", controles.desde),
      campoFiltro("Hasta", controles.hasta),
      campoFiltro("Cliente", controles.cliente_id),
      campoFiltro("Tipo de servicio", controles.tipo_servicio),
      campoFiltro("Técnico", controles.tecnico_id),
      campoFiltro("Garantía", controles.en_garantia),
      campoFiltro("Buscar", controles.q),
      limpiar,
      descargar,
      resumen
    );

    const tabla = crear("table", "tabla-listado-maestro");
    const thead = crear("thead");
    const cabecera = crear("tr");
    [
      "Número",
      "Fecha",
      "Cliente",
      "Equipo",
      "Proyecto",
      "Tipo de servicio",
      "Garantía",
      "Técnico",
      "Duración",
    ].forEach((t) => {
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
    tarjeta.append(barra, mensaje, resultados, paginador);
    raiz.append(
      encabezado("Listado maestro de servicios"),
      crear(
        "p",
        "subtitulo",
        "Todos los servicios técnicos (FO-ST-006), tomados de los reportes de servicio. Filtra y descarga en CSV para Excel."
      ),
      tarjeta
    );
    contenido.replaceChildren(raiz);

    function parametros(conPagina) {
      const p = new URLSearchParams();
      if (conPagina) {
        p.set("pagina", String(estado.pagina));
        p.set("tamanoPagina", String(TAMANO_PAGINA));
      }
      FILTROS.forEach((f) => {
        if (estado[f]) p.set(f, estado[f]);
      });
      return p;
    }

    let peticion = 0;
    async function cargar() {
      const numero = ++peticion;
      resultados.setAttribute("aria-busy", "true");
      const r = await api("GET", `/listado-maestro-servicios?${parametros(true)}`);
      // una respuesta vieja (se siguió filtrando) o de otra vista no se pinta
      if (numero !== peticion || !raiz.isConnected) return;
      resultados.removeAttribute("aria-busy");
      if (r.status !== 200) {
        mensaje.replaceChildren(
          alerta("error", r.cuerpo?.error || "No se pudo cargar el listado.")
        );
        return;
      }
      mensaje.replaceChildren();
      const { servicios, total } = r.cuerpo;
      tbody.replaceChildren();
      if (servicios.length === 0) {
        const tr = crear("tr");
        const td = crear("td", "subtitulo", "No hay servicios con estos filtros.");
        td.colSpan = 9;
        tr.append(td);
        tbody.append(tr);
      } else {
        servicios.forEach((s) => tbody.append(fila(s)));
      }
      resumen.textContent = `${total} ${total === 1 ? "servicio" : "servicios"}`;
      descargar.disabled = total === 0;

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

    // La descarga necesita la sesión (cabecera Authorization): se pide con
    // fetch y se entrega como archivo.
    async function descargarCsv() {
      descargar.disabled = true;
      try {
        const respuesta = await fetch(`/listado-maestro-servicios/csv?${parametros(false)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!respuesta.ok) {
          mensaje.replaceChildren(alerta("error", "No se pudo descargar el listado."));
          return;
        }
        const recortado = respuesta.headers.get("X-Recortado");
        const nombre =
          /filename="([^"]+)"/.exec(respuesta.headers.get("Content-Disposition") || "")?.[1] ||
          "listado-maestro-servicios.csv";
        const url = URL.createObjectURL(await respuesta.blob());
        const a = Object.assign(crear("a"), { href: url, download: nombre });
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        if (recortado) {
          mensaje.replaceChildren(
            alerta(
              "aviso",
              `El archivo trae los ${recortado} servicios más recientes. Usa los filtros para bajar el resto.`
            )
          );
        }
      } finally {
        descargar.disabled = false;
      }
    }

    const alCambiar = (clave) => () => {
      estado[clave] = controles[clave].value.trim();
      estado.pagina = 1;
      cargar();
    };
    ["desde", "hasta", "cliente_id", "tipo_servicio", "tecnico_id", "en_garantia"].forEach(
      (clave) => controles[clave].addEventListener("change", alCambiar(clave))
    );
    let espera = null;
    controles.q.addEventListener("input", () => {
      clearTimeout(espera);
      espera = setTimeout(alCambiar("q"), ESPERA_BUSQUEDA_MS);
    });

    await cargar();
  }

  window.vistaListadoMaestro = vistaListadoMaestro;
})();
