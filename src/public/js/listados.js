/* global api, alerta, boton */
/* ------------------------------------------------------------------
   Listas con búsqueda, filtro por estado y paginador.

   montarListado() pinta la barra (buscador + estado + total), pide la página
   al API (?pagina&tamanoPagina&q&estado) y redibuja solo la tabla al buscar
   o cambiar de página. El estado de cada lista (texto, filtro y página) vive
   en memoria: se conserva al volver de una ficha o después de eliminar, y
   se reinicia al recargar la página. Usa api(), alerta() y boton() de
   inicio.js (se llaman al montar, cuando ya están cargadas).

   La barra no va dentro de un <form>: así escribir en el buscador no activa
   el aviso de "cambios sin guardar" que vigila los formularios.
   ------------------------------------------------------------------ */
(function () {
  const TAMANO_PAGINA = 20;
  const ESPERA_BUSQUEDA_MS = 300;
  const estadoListados = {};

  function crear(etiqueta, propiedades = {}) {
    return Object.assign(document.createElement(etiqueta), propiedades);
  }

  /**
   * opciones:
   *  - clave: nombre de la lista (guarda su estado), p. ej. "proyectos".
   *  - api: ruta del API, p. ej. "/proyectos"; campo: clave del arreglo en la respuesta.
   *  - titulo: para los textos accesibles ("Buscar proyectos").
   *  - buscar: texto de ayuda del buscador.
   *  - estados: [{ valor, texto }] para el filtro (opcional).
   *  - vacio: mensaje cuando aún no hay registros.
   *  - pintar(filas, recargar): devuelve el nodo con la tabla.
   *  - contenedor: dónde se monta (por defecto #contenido).
   */
  async function montarListado(opciones) {
    const contenedor = opciones.contenedor || document.getElementById("contenido");
    const estado = estadoListados[opciones.clave] || { q: "", estado: "", pagina: 1 };
    estadoListados[opciones.clave] = estado;

    const barra = crear("div", { className: "controles-listado" });
    const buscador = crear("input", {
      type: "search",
      value: estado.q,
      placeholder: opciones.buscar || "Buscar",
    });
    buscador.setAttribute("aria-label", `Buscar ${opciones.titulo || ""}`.trim());
    barra.append(buscador);

    let selectorEstado = null;
    if (opciones.estados) {
      selectorEstado = crear("select");
      selectorEstado.setAttribute("aria-label", "Filtrar por estado");
      selectorEstado.append(crear("option", { value: "", textContent: "Todos los estados" }));
      opciones.estados.forEach((e) =>
        selectorEstado.append(crear("option", { value: e.valor, textContent: e.texto }))
      );
      selectorEstado.value = estado.estado;
      barra.append(selectorEstado);
    }
    const resumen = crear("span", { className: "resumen-listado" });
    resumen.setAttribute("aria-live", "polite");
    barra.append(resumen);

    const resultados = crear("div", { className: "resultados-listado" });
    const paginador = crear("nav", { className: "paginador" });
    paginador.setAttribute("aria-label", `Páginas de ${opciones.titulo || "la lista"}`);
    contenedor.append(barra, resultados, paginador);

    // Solo se pinta la respuesta de la última búsqueda (las anteriores
    // pueden llegar después si el usuario escribe rápido).
    let ultimaSolicitud = 0;

    async function cargar() {
      const solicitud = ++ultimaSolicitud;
      const parametros = new URLSearchParams({
        pagina: String(estado.pagina),
        tamanoPagina: String(TAMANO_PAGINA),
      });
      if (estado.q) parametros.set("q", estado.q);
      if (estado.estado) parametros.set("estado", estado.estado);
      resultados.setAttribute("aria-busy", "true");

      let respuesta;
      try {
        respuesta = await api("GET", `${opciones.api}?${parametros}`);
      } catch (error) {
        if (error.message === "sesion-expirada") return;
        respuesta = { status: 0 };
      }
      if (solicitud !== ultimaSolicitud) return;
      resultados.removeAttribute("aria-busy");

      if (respuesta.status !== 200) {
        resultados.replaceChildren(alerta("error", "No se pudo cargar la lista."));
        paginador.replaceChildren();
        resumen.textContent = "";
        return;
      }
      const filas = respuesta.cuerpo[opciones.campo] || [];
      const total = respuesta.cuerpo.total ?? filas.length;
      const paginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA));
      // p. ej. al eliminar el último registro de la última página
      if (estado.pagina > paginas) {
        estado.pagina = paginas;
        cargar();
        return;
      }

      const filtrando = Boolean(estado.q || estado.estado);
      resumen.textContent = `${total} ${total === 1 ? "registro" : "registros"}${filtrando ? " encontrados" : ""}`;
      if (filas.length === 0) {
        resultados.replaceChildren(
          crear("p", {
            className: "subtitulo",
            textContent: filtrando
              ? "Ningún registro coincide con la búsqueda."
              : opciones.vacio || "Aún no hay registros.",
          })
        );
      } else {
        resultados.replaceChildren(opciones.pintar(filas, cargar));
      }
      pintarPaginador(paginas);
    }

    function pintarPaginador(paginas) {
      paginador.replaceChildren();
      if (paginas <= 1) return;
      const anterior = boton("Anterior", () => irA(estado.pagina - 1), true);
      anterior.disabled = estado.pagina <= 1;
      const siguiente = boton("Siguiente", () => irA(estado.pagina + 1), true);
      siguiente.disabled = estado.pagina >= paginas;
      const texto = crear("span", { textContent: `Página ${estado.pagina} de ${paginas}` });
      paginador.append(anterior, texto, siguiente);
    }

    function irA(pagina) {
      estado.pagina = pagina;
      cargar();
      barra.scrollIntoView({ block: "nearest" });
    }

    let espera = null;
    buscador.addEventListener("input", () => {
      clearTimeout(espera);
      espera = setTimeout(() => {
        const q = buscador.value.trim();
        if (q === estado.q) return;
        estado.q = q;
        estado.pagina = 1;
        cargar();
      }, ESPERA_BUSQUEDA_MS);
    });
    if (selectorEstado) {
      selectorEstado.addEventListener("change", () => {
        estado.estado = selectorEstado.value;
        estado.pagina = 1;
        cargar();
      });
    }

    await cargar();
    return { recargar: cargar };
  }

  window.montarListado = montarListado;
})();
