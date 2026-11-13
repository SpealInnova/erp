/* global api, pill, enrutar */
/* ------------------------------------------------------------------
   Ventana "Actividades pendientes" (botón junto a la campana).

   Muestra las actividades pendientes del usuario que están vencidas o por
   vencer, con un botón que lleva directo a cada una en el Gantt de su
   proyecto (#/proyectos/<id>/actividades/<id>). Se abre sola una vez por
   sesión si hay algo vencido o por vencer; después, desde el botón.

   Los avisos en la campana los crea el servidor (servicios/avisosActividades.js).
   Se carga después de inicio.js: usa api(), pill() y enrutar().
   ------------------------------------------------------------------ */
(function () {
  const UN_DIA_MS = 24 * 60 * 60 * 1000;
  const CLAVE_SESION = "actividades-pendientes-mostradas";
  // Preferencia de este navegador: "0" = no abrirla sola al iniciar sesión.
  const CLAVE_AUTOMATICA = "actividades-pendientes-auto";
  const INTERVALO_MS = 5 * 60 * 1000;
  const MAXIMO_POR_GRUPO = 5;

  const boton = document.getElementById("btn-mis-actividades");
  const contador = document.getElementById("actividades-contador");
  const ventana = document.getElementById("ventana-actividades");
  if (!boton || !ventana) return;

  let grupos = { vencidas: [], porVencer: [], otras: 0, diasAviso: 3 };

  function crear(etiqueta, clase, texto) {
    const el = document.createElement(etiqueta);
    if (clase) el.className = clase;
    if (texto !== undefined) el.textContent = texto;
    return el;
  }

  function abrirSolaActivo() {
    try {
      return localStorage.getItem(CLAVE_AUTOMATICA) !== "0";
    } catch {
      return true;
    }
  }

  function opcionAbrirSola() {
    const label = crear("label", "ventana-actividades-opcion");
    const casilla = document.createElement("input");
    casilla.type = "checkbox";
    casilla.checked = abrirSolaActivo();
    casilla.addEventListener("change", () => {
      try {
        localStorage.setItem(CLAVE_AUTOMATICA, casilla.checked ? "1" : "0");
      } catch {
        // sin almacenamiento: la preferencia no se guarda
      }
    });
    label.append(casilla, document.createTextNode(" Abrir sola al iniciar sesión"));
    return label;
  }

  function hoyLocal() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // Fecha de la BD tal cual (AAAA-MM-DD), sin correrla por zona horaria.
  function deISO(valor) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor ? String(valor) : "");
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  }

  function clasificar(actividades, diasAviso) {
    const hoy = hoyLocal();
    const resultado = { vencidas: [], porVencer: [], otras: 0, diasAviso };
    actividades.forEach((actividad) => {
      const fin = deISO(actividad.fecha_fin);
      if (!fin) {
        resultado.otras += 1;
        return;
      }
      const dias = Math.round((fin - hoy) / UN_DIA_MS);
      if (dias < 0) resultado.vencidas.push({ actividad, dias });
      else if (dias <= diasAviso) resultado.porVencer.push({ actividad, dias });
      else resultado.otras += 1;
    });
    return resultado;
  }

  function textoPlazo(dias) {
    if (dias < -1) return `Venció hace ${-dias} días`;
    if (dias === -1) return "Venció ayer";
    if (dias === 0) return "Vence hoy";
    if (dias === 1) return "Vence mañana";
    return `Vence en ${dias} días`;
  }

  function pintarContador() {
    const urgentes = grupos.vencidas.length + grupos.porVencer.length;
    contador.hidden = urgentes === 0;
    contador.textContent = urgentes > 99 ? "99+" : String(urgentes);
    contador.classList.toggle("campana-contador--aviso", grupos.vencidas.length === 0);
    boton.setAttribute(
      "aria-label",
      urgentes > 0
        ? `Actividades pendientes: ${grupos.vencidas.length} vencidas, ${grupos.porVencer.length} por vencer`
        : "Actividades pendientes"
    );
  }

  function irA(actividad) {
    const destino = `#/proyectos/${actividad.proyecto_id}/actividades/${actividad.id}`;
    abrir(false);
    if (window.location.hash === destino) enrutar();
    else window.location.hash = destino;
  }

  function itemActividad({ actividad, dias }) {
    const li = crear("li", "item-actividad");
    const textos = crear("div", "item-actividad-textos");
    textos.append(
      crear("b", "", actividad.descripcion),
      crear("span", "subtitulo", `${actividad.codigo_pry} · ${actividad.nombre_proyecto}`)
    );
    const etiquetas = crear("div", "item-actividad-etiquetas");
    etiquetas.append(pill(textoPlazo(dias), dias < 0 ? "crit" : "warn"));
    if (!actividad.responsable_id) etiquetas.append(pill("Sin responsable", "mute"));
    textos.append(etiquetas);

    const ir = crear("button", "boton boton-pequeno boton-secundario", "Ir a la actividad");
    ir.type = "button";
    ir.setAttribute("aria-label", `Ir a la actividad ${actividad.descripcion}`);
    ir.addEventListener("click", () => irA(actividad));
    li.append(textos, ir);
    return li;
  }

  function grupo(titulo, clase, lista) {
    const seccion = crear("section", `grupo-actividades ${clase}`);
    seccion.append(crear("h3", "", `${titulo} (${lista.length})`));
    const ul = crear("ul");
    lista.slice(0, MAXIMO_POR_GRUPO).forEach((item) => ul.append(itemActividad(item)));
    seccion.append(ul);
    if (lista.length > MAXIMO_POR_GRUPO) {
      seccion.append(crear("p", "subtitulo", `y ${lista.length - MAXIMO_POR_GRUPO} más.`));
    }
    return seccion;
  }

  function render() {
    const { vencidas, porVencer, otras, diasAviso } = grupos;
    const cabecera = crear("header", "ventana-actividades-cabecera");
    const titulos = crear("div");
    const h2 = crear("h2", "", "Actividades pendientes");
    h2.id = "titulo-ventana-actividades";
    titulos.append(
      h2,
      crear(
        "p",
        "subtitulo",
        vencidas.length + porVencer.length > 0
          ? `${vencidas.length} ${vencidas.length === 1 ? "vencida" : "vencidas"} · ${porVencer.length} por vencer (próximos ${diasAviso} días)`
          : "Nada vencido ni por vencer."
      )
    );
    const cerrar = crear("button", "boton-icono", "×");
    cerrar.type = "button";
    cerrar.setAttribute("aria-label", "Cerrar actividades pendientes");
    cerrar.addEventListener("click", () => abrir(false, true));
    cabecera.append(titulos, cerrar);

    const cuerpo = crear("div", "ventana-actividades-cuerpo");
    if (vencidas.length > 0) cuerpo.append(grupo("Vencidas", "grupo-vencidas", vencidas));
    if (porVencer.length > 0) cuerpo.append(grupo("Por vencer", "grupo-por-vencer", porVencer));
    if (otras > 0) {
      cuerpo.append(
        crear(
          "p",
          "subtitulo ventana-actividades-pie",
          `Además tienes ${otras} ${otras === 1 ? "actividad pendiente" : "actividades pendientes"} con más plazo o sin fechas.`
        )
      );
    } else if (vencidas.length + porVencer.length === 0) {
      cuerpo.append(
        crear("p", "subtitulo ventana-actividades-pie", "No tienes actividades pendientes.")
      );
    }
    cuerpo.append(opcionAbrirSola());
    ventana.replaceChildren(cabecera, cuerpo);
  }

  async function cargar() {
    try {
      const r = await api("GET", "/actividades/pendientes");
      if (r.status !== 200) return false;
      grupos = clasificar(r.cuerpo.actividades, r.cuerpo.dias_aviso);
      pintarContador();
      if (!ventana.hidden) render();
      return true;
    } catch {
      return false; // sin conexión: se reintenta en la próxima revisión
    }
  }

  function abrir(abierta, devolverFoco = false) {
    ventana.hidden = !abierta;
    boton.setAttribute("aria-expanded", String(abierta));
    if (abierta) render();
    else if (devolverFoco) boton.focus();
  }

  boton.addEventListener("click", async () => {
    if (!ventana.hidden) {
      abrir(false);
      return;
    }
    await cargar();
    abrir(true);
    ventana.querySelector(".boton-icono").focus();
  });

  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape" && !ventana.hidden && ventana.contains(document.activeElement)) {
      abrir(false, true);
    }
  });

  // El Gantt la llama al guardar, mover o quitar una actividad.
  window.actualizarMisActividades = cargar;

  (async function iniciar() {
    if (!(await cargar()) || !abrirSolaActivo()) return;
    if (grupos.vencidas.length + grupos.porVencer.length === 0) return;
    // Se abre sola una vez por sesión, sin quitarle el foco a la página.
    try {
      if (sessionStorage.getItem(CLAVE_SESION) === "1") return;
      sessionStorage.setItem(CLAVE_SESION, "1");
    } catch {
      // sin almacenamiento de sesión: se muestra en cada carga
    }
    abrir(true);
  })();
  setInterval(cargar, INTERVALO_MS);
})();
