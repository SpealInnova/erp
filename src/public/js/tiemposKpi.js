/* global api, contenido, marcarMenu, alerta, pill, textoEstadoProyecto */
/* ------------------------------------------------------------------
   Tiempos y KPI (#/tiempos), solo para los cargos directivos.

   Cuánto tarda cada fase de los proyectos, cada tipo de actividad y las
   tareas frente al estándar (las fechas planeadas). Sale de las
   transiciones de estado: no mide el tiempo conectado a la plataforma.
   Los cálculos y sus definiciones están en servicios/tiemposProcesos.js.
   ------------------------------------------------------------------ */
(function () {
  const PERIODOS = [
    { clave: "trimestre", texto: "Últimos 3 meses" },
    { clave: "anio", texto: "Últimos 12 meses" },
    { clave: "todo", texto: "Todo" },
  ];
  // Más de este porcentaje sobre el plan se marca como desvío.
  const UMBRAL_DESVIO_PCT = 10;
  let periodo = "trimestre";

  function crear(etiqueta, clase, texto) {
    const el = document.createElement(etiqueta);
    if (clase) el.className = clase;
    if (texto !== undefined) el.textContent = texto;
    return el;
  }

  function numero(valor, sufijo = "") {
    if (valor === null || valor === undefined) return "—";
    return `${Number(valor).toLocaleString("es-CO", { maximumFractionDigits: 1 })}${sufijo}`;
  }

  function textoDesvio(pct) {
    if (pct === null || pct === undefined) return "—";
    if (pct === 0) return "igual al plan";
    return pct > 0 ? `+${pct}% sobre el plan` : `${pct}% bajo el plan`;
  }

  function pillDesvio(pct) {
    if (pct === null || pct === undefined) return pill("Sin plan", "mute");
    if (pct > UMBRAL_DESVIO_PCT) return pill(`+${pct}%`, "crit");
    if (pct > 0) return pill(`+${pct}%`, "warn");
    return pill(`${pct}%`, "good");
  }

  function kpi(titulo, valor, detalle, tono) {
    const caja = crear("div", `kpi-general${tono ? ` kpi-general--${tono}` : ""}`);
    caja.append(
      crear("div", "kg-t", titulo),
      crear("div", "kg-v", valor),
      crear("div", "kg-d", detalle)
    );
    return caja;
  }

  function tarjeta(titulo, explicacion) {
    const caja = crear("section", "tarjeta-ancha tg-tarjeta");
    caja.append(crear("h3", "", titulo));
    if (explicacion) caja.append(crear("p", "muted tk-explicacion", explicacion));
    return caja;
  }

  // Barras pareadas por fase: plan (claro) y real (sólido; rojo si se pasa
  // del umbral). Todas en la misma escala de días.
  function graficaFases(fases) {
    const conDatos = fases.filter((f) => f.cerrados || f.en_fase_ahora);
    if (conDatos.length === 0) {
      return crear("p", "subtitulo", "Aún no hay fases con cambios registrados en este periodo.");
    }
    const maximo = Math.max(
      1,
      ...conDatos.flatMap((f) => [
        f.real_promedio_dias || 0,
        f.plan_promedio_dias || 0,
        f.mas_tiempo_ahora?.dias || 0,
      ])
    );
    const lista = crear("div", "tk-fases");
    const leyenda = crear("div", "tg-leyenda");
    leyenda.append(
      crear("span", "tk-leyenda-plan", "Plan (promedio)"),
      crear("span", "tk-leyenda-real", "Real (promedio de las que ya salieron)")
    );
    lista.append(leyenda);
    conDatos.forEach((f) => {
      const fila = crear("div", "tk-fase");
      const nombre = crear("div", "tk-fase-nombre");
      nombre.append(
        crear("b", "", textoEstadoProyecto(f.fase)),
        crear(
          "span",
          "muted",
          f.cerrados
            ? `${f.cerrados} ${f.cerrados === 1 ? "proyecto" : "proyectos"}`
            : "ninguno salió aún"
        )
      );
      const barras = crear("div", "tk-barras");
      const barra = (valor, clase, etiqueta) => {
        const linea = crear("div", "tk-linea");
        const marca = crear("i", clase);
        marca.style.width = `${((valor || 0) / maximo) * 100}%`;
        linea.append(
          marca,
          crear("span", "", valor ? `${etiqueta} ${numero(valor, " d")}` : `${etiqueta} —`)
        );
        return linea;
      };
      const excede = f.desviacion_pct !== null && f.desviacion_pct > UMBRAL_DESVIO_PCT;
      barras.append(
        barra(f.plan_promedio_dias, "tk-plan", "Plan"),
        barra(f.real_promedio_dias, `tk-real${excede ? " tk-real--excede" : ""}`, "Real")
      );
      const lado = crear("div", "tk-fase-lado");
      lado.append(pillDesvio(f.desviacion_pct));
      if (f.mas_tiempo_ahora) {
        const enlace = crear(
          "a",
          "muted",
          `Ahora: ${f.en_fase_ahora} · ${f.mas_tiempo_ahora.codigo_pry} lleva ${f.mas_tiempo_ahora.dias} d${
            f.mas_tiempo_ahora.plan_dias ? ` (plan ${f.mas_tiempo_ahora.plan_dias})` : ""
          }`
        );
        enlace.href = `#/proyectos/${f.mas_tiempo_ahora.proyecto_id}`;
        lado.append(enlace);
      }
      fila.append(nombre, barras, lado);
      lista.append(fila);
    });
    return lista;
  }

  function tablaCategorias(categorias) {
    if (categorias.length === 0) {
      return crear("p", "subtitulo", "Aún no hay actividades finalizadas en este periodo.");
    }
    const tabla = crear("table", "tk-tabla");
    const cabecera = crear("tr");
    [
      ["Tipo de actividad", ""],
      ["Finalizadas", "num"],
      ["A tiempo", "num"],
      ["Plan (días)", "num"],
      ["Real (días)", "num"],
      ["Frente al plan", ""],
      ["Retraso al iniciar (días)", "num"],
      ["En curso (h)", "num"],
      ["En espera (días)", "num"],
      ["Abiertas", "num"],
    ].forEach(([texto, clase]) => {
      const th = crear("th", clase, texto);
      th.scope = "col";
      cabecera.append(th);
    });
    const thead = crear("thead");
    thead.append(cabecera);
    const tbody = crear("tbody");
    categorias.forEach((c) => {
      const fila = crear("tr");
      const celda = (texto, clase = "num") => fila.append(crear("td", clase, texto));
      celda(c.categoria, "");
      celda(numero(c.finalizadas));
      celda(numero(c.a_tiempo_pct, "%"));
      celda(numero(c.plan_promedio_dias));
      celda(numero(c.real_promedio_dias));
      const desvio = crear("td");
      desvio.append(pillDesvio(c.desviacion_pct));
      fila.append(desvio);
      celda(numero(c.retraso_inicio_promedio_dias));
      celda(c.con_horometro ? numero(c.horas_en_curso_promedio) : "—");
      celda(c.con_horometro ? numero(c.espera_promedio_dias) : "—");
      celda(c.vencidas ? `${c.abiertas} (${c.vencidas} vencidas)` : numero(c.abiertas));
      tbody.append(fila);
    });
    tabla.append(thead, tbody);
    const marco = crear("div", "tk-tabla-marco");
    marco.append(tabla);
    return marco;
  }

  function listaLentas(lentas) {
    if (lentas.length === 0) {
      return crear("p", "subtitulo", "Ninguna actividad se ha pasado de su plan en este periodo.");
    }
    const ul = crear("ul", "lista-simple");
    lentas.forEach((l) => {
      const li = crear("li");
      li.append(pill(`+${l.exceso_dias} d`, "crit"));
      const textos = crear("div");
      const enlace = crear("a", "", l.descripcion);
      enlace.href = l.enlace;
      textos.append(
        enlace,
        crear(
          "div",
          "muted",
          `${l.codigo_pry} · ${textoEstadoProyecto(l.fase)} · ${l.categoria} · plan ${l.plan_dias} d, ${
            l.finalizada ? "tardó" : "lleva"
          } ${l.real_dias} d`
        )
      );
      li.append(textos);
      if (!l.finalizada) li.append(pill("Abierta", "warn"));
      ul.append(li);
    });
    return ul;
  }

  function pintar(raiz, t, alCambiarPeriodo) {
    const cab = crear("div", "tg-cab");
    const textos = crear("div");
    textos.append(
      crear("h2", "", "Tiempos y KPI"),
      crear(
        "p",
        "subtitulo",
        "Cuánto tarda cada fase, actividad y tarea frente a su plan. Sale de los cambios de estado, no del tiempo conectado."
      )
    );
    const chips = crear("div", "chips");
    chips.setAttribute("role", "group");
    chips.setAttribute("aria-label", "Periodo");
    PERIODOS.forEach((p) => {
      const b = crear("button", "chip", p.texto);
      b.type = "button";
      b.setAttribute("aria-pressed", String(p.clave === periodo));
      b.addEventListener("click", () => {
        if (p.clave === periodo) return;
        periodo = p.clave;
        alCambiarPeriodo();
      });
      chips.append(b);
    });
    cab.append(textos, chips);

    const { resumen } = t;
    const fila = crear("div", "tg-kpis");
    const lenta = resumen.fase_mas_lenta;
    fila.append(
      kpi(
        "Actividades finalizadas",
        numero(resumen.actividades_finalizadas),
        resumen.abiertas_vencidas
          ? `${resumen.abiertas_vencidas} ${
              resumen.abiertas_vencidas === 1 ? "abierta vencida" : "abiertas vencidas"
            }`
          : "Ninguna abierta vencida",
        resumen.abiertas_vencidas ? "crit" : null
      ),
      kpi(
        "A tiempo",
        numero(resumen.a_tiempo_pct, "%"),
        "Finalizadas a más tardar en su fecha de fin"
      ),
      kpi(
        "Duración frente al plan",
        resumen.desviacion_pct === null
          ? "—"
          : `${resumen.desviacion_pct > 0 ? "+" : ""}${resumen.desviacion_pct}%`,
        resumen.desviacion_pct === null
          ? "Sin actividades finalizadas con fechas aún"
          : textoDesvio(resumen.desviacion_pct),
        resumen.desviacion_pct > UMBRAL_DESVIO_PCT ? "warn" : null
      ),
      kpi(
        "Fase más demorada",
        lenta ? textoEstadoProyecto(lenta.fase) : "—",
        lenta ? textoDesvio(lenta.desviacion_pct) : "Sin fases comparables aún",
        lenta && lenta.desviacion_pct > UMBRAL_DESVIO_PCT ? "crit" : null
      )
    );

    const fases = tarjeta(
      "Tiempo por fase",
      "Real: días desde que el proyecto entró a la fase hasta que salió. Plan: de la primera fecha de inicio a la última de fin de sus actividades."
    );
    fases.append(graficaFases(t.fases));

    const categorias = tarjeta(
      "Por tipo de actividad",
      "Real: desde que se inició (▶) o su fecha de inicio, hasta que se finalizó. En curso: horas con el horómetro andando. En espera: días abierta sin trabajarse (solo las que usaron ▶)."
    );
    categorias.append(tablaCategorias(t.categorias));

    const lentas = tarjeta("Las más demoradas frente a su plan");
    lentas.append(listaLentas(t.lentas));

    const tareas = tarjeta("Tareas fuera de proyectos");
    const tt = t.tareas;
    const datos = crear("dl", "prov-datos");
    [
      ["Finalizadas", numero(tt.finalizadas)],
      ["A tiempo", numero(tt.a_tiempo_pct, "%")],
      ["Real promedio", numero(tt.real_promedio_dias, " días")],
      ["Frente al plan", textoDesvio(tt.desviacion_pct)],
      ["En curso promedio", tt.con_horometro ? numero(tt.horas_en_curso_promedio, " h") : "—"],
    ].forEach(([dt, dd]) => datos.append(crear("dt", "", dt), crear("dd", "", dd)));
    tareas.append(datos);

    const grilla = crear("div", "tg-grilla");
    grilla.append(lentas, tareas);
    raiz.append(cab, fila, fases, categorias, grilla);
  }

  async function vistaTiempos() {
    marcarMenu("tiempos");
    const ruta = window.location.hash;
    contenido.replaceChildren(crear("p", "subtitulo", "Cargando…"));
    const r = await api("GET", `/tableros/tiempos?periodo=${periodo}`);
    if (window.location.hash !== ruta) return;
    if (r.status === 403) {
      contenido.replaceChildren(
        alerta(
          "aviso",
          "Tu cargo no tiene acceso a este tablero. Lo tuyo está en Inicio y en Mis tareas."
        )
      );
      return;
    }
    if (r.status !== 200) {
      contenido.replaceChildren(alerta("error", "No se pudieron cargar los tiempos."));
      return;
    }
    const raiz = crear("div", "tiempos-kpi");
    contenido.replaceChildren(raiz);
    pintar(raiz, r.cuerpo.tablero, vistaTiempos);
  }

  window.vistaTiempos = vistaTiempos;
})();
