/* global api, contenido, marcarMenu, alerta, pill, boton, formatoFechaHora */
/* ------------------------------------------------------------------
   Panel de copias de seguridad (#/copias), para admin y Gerente General.

   Muestra si la copia diaria está activa y si Drive está configurado, el
   registro de las últimas copias (fecha, resultado, tamaño y archivo en
   Drive) y el botón "Hacer copia ahora". Las copias las hace el servidor
   (servicios/copiasSeguridad.js); restaurar se hace fuera del ERP.
   ------------------------------------------------------------------ */
(function () {
  const TEXTO_RESULTADO = { exitosa: "Exitosa", fallida: "Fallida", en_curso: "En curso" };
  const TIPO_RESULTADO = { exitosa: "good", fallida: "crit", en_curso: "info" };

  function crear(etiqueta, clase, texto) {
    const el = document.createElement(etiqueta);
    if (clase) el.className = clase;
    if (texto !== undefined) el.textContent = texto;
    return el;
  }

  function tamano(bytes) {
    if (bytes === null || bytes === undefined) return "—";
    const n = Number(bytes);
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024)
      return `${(n / 1024).toLocaleString("es-CO", { maximumFractionDigits: 1 })} KB`;
    return `${(n / (1024 * 1024)).toLocaleString("es-CO", { maximumFractionDigits: 1 })} MB`;
  }

  function estadoConfiguracion(configuracion) {
    const caja = crear("div", "tarjeta-ancha copias-estado");
    const lista = crear("ul", "lista-simple");
    const item = (ok, textoOk, textoNo) => {
      const li = crear("li");
      li.append(pill(ok ? "Listo" : "Pendiente", ok ? "good" : "warn"));
      li.append(crear("div", "", ok ? textoOk : textoNo));
      lista.append(li);
    };
    item(
      configuracion.drive_configurado,
      "Google Drive configurado: las copias se suben a la carpeta de copias.",
      "Falta el token de Google con permiso de Drive (drive.file) o la carpeta de copias. Mientras tanto, las copias fallan."
    );
    item(
      configuracion.diarias,
      `Copia automática diaria activa, a las ${configuracion.hora}:00 (hora de Colombia).`,
      "La copia automática diaria no está activa en este ambiente (COPIAS_DIARIAS=1 en producción)."
    );
    caja.append(crear("h3", "", "Estado"), lista);
    return caja;
  }

  function tablaCopias(copias) {
    const caja = crear("div", "tarjeta-ancha");
    caja.append(crear("h3", "", "Últimas copias"));
    if (copias.length === 0) {
      caja.append(crear("p", "subtitulo", "Aún no hay copias registradas."));
      return caja;
    }
    const tabla = crear("table");
    const cab = crear("tr");
    ["Fecha", "Origen", "Resultado", "Tamaño", "Contenido", "Archivo"].forEach((t) => {
      const th = crear("th", "", t);
      th.scope = "col";
      cab.append(th);
    });
    const thead = crear("thead");
    thead.append(cab);
    const tbody = crear("tbody");
    copias.forEach((c) => {
      const fila = crear("tr");
      fila.append(crear("td", "", formatoFechaHora(c.iniciada_en)));
      fila.append(
        crear(
          "td",
          "",
          c.origen === "manual" ? `Manual · ${c.solicitada_por_nombre || "—"}` : "Automática"
        )
      );
      const resultado = crear("td");
      resultado.append(
        pill(TEXTO_RESULTADO[c.resultado] || c.resultado, TIPO_RESULTADO[c.resultado] || "mute")
      );
      if (c.error) resultado.append(crear("div", "muted copias-error", c.error));
      fila.append(resultado);
      fila.append(crear("td", "", tamano(c.tamano_bytes)));
      fila.append(
        crear(
          "td",
          "",
          c.tablas
            ? `${c.tablas} tablas · ${Number(c.registros).toLocaleString("es-CO")} registros`
            : "—"
        )
      );
      const archivo = crear("td");
      if (c.drive_enlace) {
        const enlace = crear("a", "", c.archivo_nombre || "Abrir en Drive");
        enlace.href = c.drive_enlace;
        enlace.target = "_blank";
        enlace.rel = "noopener";
        archivo.append(enlace);
      } else {
        archivo.textContent = c.archivo_nombre || "—";
      }
      fila.append(archivo);
      tbody.append(fila);
    });
    tabla.append(thead, tbody);
    caja.append(tabla);
    return caja;
  }

  async function vistaCopias() {
    marcarMenu("copias");
    const ruta = window.location.hash;
    contenido.replaceChildren(crear("p", "subtitulo", "Cargando…"));
    const r = await api("GET", "/copias");
    if (window.location.hash !== ruta) return;
    if (r.status === 403) {
      contenido.replaceChildren(
        alerta(
          "aviso",
          "Las copias de seguridad las gestionan el administrador y el Gerente General."
        )
      );
      return;
    }
    if (r.status !== 200) {
      contenido.replaceChildren(alerta("error", "No se pudo cargar el registro de copias."));
      return;
    }

    const raiz = crear("div", "vista-copias");
    const cab = crear("div", "encabezado");
    const textos = crear("div");
    textos.append(
      crear("h2", "", "Copias de seguridad"),
      crear(
        "p",
        "subtitulo",
        "Estado completo del ERP (toda la base de datos, comprimida) en Google Drive. Las evidencias ya están en Drive."
      )
    );
    const mensaje = crear("div");
    const hacer = boton("Hacer copia ahora", async () => {
      if (!window.confirm("¿Hacer ahora una copia completa de la base de datos y subirla a Drive?"))
        return;
      hacer.disabled = true;
      hacer.textContent = "Haciendo la copia…";
      const respuesta = await api("POST", "/copias");
      if (respuesta.status === 201 && respuesta.cuerpo.copia.resultado === "exitosa") {
        await vistaCopias();
        contenido.prepend(alerta("ok", `Copia lista: ${respuesta.cuerpo.copia.archivo_nombre}`));
        return;
      }
      if (respuesta.status === 201) {
        await vistaCopias();
        contenido.prepend(alerta("error", `La copia falló: ${respuesta.cuerpo.copia.error}`));
        return;
      }
      hacer.disabled = false;
      hacer.textContent = "Hacer copia ahora";
      mensaje.replaceChildren(
        alerta("error", respuesta.cuerpo?.error || "No se pudo hacer la copia.")
      );
    });
    cab.append(textos, hacer);

    const nota = crear(
      "p",
      "subtitulo",
      "Para restaurar: descargar el archivo .sql.gz de Drive, descomprimirlo e importarlo en una base vacía (phpMyAdmin → Importar). Solo con el respaldo de quien administra el servidor."
    );
    raiz.append(
      cab,
      mensaje,
      estadoConfiguracion(r.cuerpo.configuracion),
      tablaCopias(r.cuerpo.copias),
      nota
    );
    contenido.replaceChildren(raiz);
  }

  window.vistaCopias = vistaCopias;
})();
