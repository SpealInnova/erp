/* global api, boton, alerta, renderSeccionSubrecurso, subrecursosExpediente,
          textoEstadoProyecto */
/* ------------------------------------------------------------------
   Expediente de diseño guiado.

   Las 8 secciones del expediente se recorren como pasos, en el orden del
   control de diseño, y la liberación es el último. A la izquierda, los pasos
   con su estado; al centro, el paso elegido (con ayuda y listas
   desplegables); a la derecha, la relación con otros módulos, qué falta para
   liberar y qué implica liberar. Arriba, el siguiente paso.

   "Qué falta para liberar" es una guía: no bloquea la liberación (la decide
   Dirección de Operaciones o Jefe de I+D+i), pero la avisa.

   Usa funciones de inicio.js (se llaman al montar, cuando ya existen).
   ------------------------------------------------------------------ */
(function () {
  const ORDEN = [
    "requisitos",
    "salidas",
    "revisiones",
    "riesgos",
    "verificaciones",
    "validaciones",
    "cambios",
    "transferencias",
  ];
  const CORTO = {
    requisitos: "Qué debe cumplir el diseño",
    salidas: "Planos, listas de materiales",
    revisiones: "Hallazgos y acciones",
    riesgos: "Severidad × probabilidad",
    verificaciones: "¿La salida cumple el requisito?",
    validaciones: "Prueba para el uso del cliente",
    cambios: "Requieren aprobación",
    transferencias: "Entrega a otras áreas",
    liberacion: "Decisión final",
  };

  function crear(etiqueta, clase, texto) {
    const el = document.createElement(etiqueta);
    if (clase) el.className = clase;
    if (texto !== undefined) el.textContent = texto;
    return el;
  }

  function normal(texto) {
    return String(texto || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
  }

  const esConforme = (v) => ["conforme", "si", "ok", "cumple"].includes(normal(v));
  const esAprobada = (v) => ["aprobada", "aprobado"].includes(normal(v));

  // Qué se cumple y qué falta para liberar, por paso.
  function evaluar(listas, expediente) {
    const l = (clave) => listas[clave] || [];
    const req = l("requisitos");
    const sal = l("salidas");
    const rev = l("revisiones");
    const ver = l("verificaciones");
    const val = l("validaciones");
    const pendientes = l("cambios").filter((c) => c.estado === "pendiente");
    const salAprobadas = sal.filter((s) => esAprobada(s.estado)).length;
    const revCerradas = rev.filter((r) => r.cierre === "si").length;
    const verificados = req.filter((r) =>
      ver.some(
        (v) => normal(v.requisito_verificado) === normal(r.requisito) && esConforme(v.resultado)
      )
    ).length;
    return {
      requisitos: {
        ok: req.length > 0,
        texto: req.length
          ? `Requisitos de entrada (${req.length})`
          : "Registrar los requisitos de entrada",
      },
      salidas: {
        ok: sal.length > 0 && salAprobadas === sal.length,
        texto: sal.length
          ? `${salAprobadas} de ${sal.length} salidas aprobadas`
          : "Registrar las salidas de diseño",
      },
      revisiones: {
        ok: rev.length > 0 && revCerradas === rev.length,
        texto: rev.length
          ? `${revCerradas} de ${rev.length} revisiones cerradas`
          : "Hacer una revisión de diseño",
      },
      riesgos: {
        ok: l("riesgos").length > 0,
        texto: l("riesgos").length
          ? `Riesgos evaluados (${l("riesgos").length})`
          : "Evaluar los riesgos",
      },
      verificaciones: {
        ok: req.length > 0 && verificados === req.length,
        texto: req.length
          ? `${verificados} de ${req.length} requisitos verificados conformes`
          : "Verificar cada requisito",
      },
      validaciones: {
        ok: val.some((v) => esConforme(v.resultado)),
        texto: val.some((v) => esConforme(v.resultado))
          ? "Validación conforme"
          : "Validar el diseño con una prueba conforme",
      },
      cambios: {
        ok: pendientes.length === 0,
        texto: pendientes.length
          ? `${pendientes.length} ${pendientes.length === 1 ? "cambio de diseño sin decidir" : "cambios de diseño sin decidir"}`
          : "Sin cambios de diseño pendientes",
      },
      transferencias: {
        ok: l("transferencias").length > 0,
        texto: l("transferencias").length
          ? `Transferencias registradas (${l("transferencias").length})`
          : "Registrar la transferencia a producción",
      },
      serial: {
        ok: Boolean(expediente.numero_serie),
        texto: expediente.numero_serie
          ? `Número de serie ${expediente.numero_serie}`
          : "Asignar el número de serie del equipo (en los datos del expediente)",
      },
    };
  }

  async function montarExpedienteGuiado({
    id,
    expediente,
    editable,
    opcionesUsuarios,
    proyecto,
    bloqueEstado,
  }) {
    const pendiente = expediente.estado_liberacion === "pendiente";
    const listas = {};
    // carga inicial de todas las secciones: con eso se ven los pasos y lo que falta
    const configs = subrecursosExpediente(opcionesUsuarios);
    const respuestas = await Promise.all(
      configs.map((c) => api("GET", `/expedientes-diseno/${id}/${c.ruta}`))
    );
    configs.forEach((c, i) => {
      listas[c.clave] = respuestas[i].status === 200 ? respuestas[i].cuerpo[c.clave] || [] : [];
    });

    // Requisiciones del proyecto: se consultan una vez al abrir el expediente.
    let requisicionesProyecto = null;
    if (proyecto) {
      const r = await api("GET", `/proyectos/${proyecto.id}/documentos`);
      if (r.status === 200) requisicionesProyecto = r.cuerpo.documentos.requisiciones.length;
    }

    const raiz = crear("div", "exp-guiado-raiz");
    const siguiente = crear("section", "siguiente-paso");
    siguiente.setAttribute("aria-label", "Siguiente paso del expediente");
    const cuerpo = crear("div", "exp-guiado");
    const nav = crear("nav", "exp-pasos tarjeta-ancha");
    nav.setAttribute("aria-label", "Pasos del expediente");
    const listaPasos = crear("ol");
    nav.append(listaPasos);
    const centro = crear("div", "exp-centro");
    const lateral = crear("div", "exp-lateral");
    cuerpo.append(nav, centro, lateral);
    raiz.append(siguiente, cuerpo);

    const pasos = [
      ...ORDEN.map((clave) => ({ clave, config: configs.find((c) => c.clave === clave) })),
      { clave: "liberacion", config: { titulo: "Liberación" } },
    ];
    let actual = 0;

    function estadoPaso(clave, eval_) {
      if (clave === "liberacion") return pendiente ? "pendiente" : "ok";
      const item = eval_[clave];
      if (item.ok) return "ok";
      return (listas[clave] || []).length ? "en_curso" : "pendiente";
    }

    function pintarPasos(eval_) {
      listaPasos.replaceChildren();
      pasos.forEach((p, i) => {
        const li = crear("li", `exp-paso exp-paso--${estadoPaso(p.clave, eval_)}`);
        const b = crear("button");
        b.type = "button";
        if (i === actual) b.setAttribute("aria-current", "step");
        const estado = estadoPaso(p.clave, eval_);
        const bola = crear("span", "exp-bola", estado === "ok" ? "✓" : String(i + 1));
        bola.setAttribute("aria-hidden", "true");
        const textos = crear("span", "exp-paso-textos");
        textos.append(
          crear("span", "exp-paso-nom", p.config.titulo),
          crear("span", "exp-paso-ayuda", CORTO[p.clave])
        );
        const cantidad = p.clave === "liberacion" ? "" : String((listas[p.clave] || []).length);
        b.append(bola, textos, crear("span", "exp-paso-n", cantidad));
        b.setAttribute(
          "aria-label",
          `Paso ${i + 1}: ${p.config.titulo}. ${estado === "ok" ? "Completo" : estado === "en_curso" ? "En curso" : "Pendiente"}`
        );
        b.addEventListener("click", () => mostrarPaso(i));
        li.append(b);
        listaPasos.append(li);
      });
    }

    function pintarSiguiente(eval_) {
      siguiente.replaceChildren();
      const ico = crear("div", "sp-ico", "→");
      ico.setAttribute("aria-hidden", "true");
      const textos = crear("div", "sp-textos");
      const acciones = crear("div", "sp-acciones");
      if (!pendiente) {
        textos.append(
          crear("h3", "", "Expediente cerrado: quedó de solo lectura"),
          crear(
            "p",
            "",
            "Los ajustes al diseño se registran como Cambio de diseño, que debe aprobarse."
          )
        );
      } else {
        const faltante = ORDEN.find((clave) => !eval_[clave].ok);
        if (faltante) {
          const i = pasos.findIndex((p) => p.clave === faltante);
          textos.append(
            crear("h3", "", `Siguiente paso: ${eval_[faltante].texto}`),
            crear("p", "", pasos[i].config.ayuda || "")
          );
          acciones.append(boton(`Ir a ${pasos[i].config.titulo}`, () => mostrarPaso(i)));
        } else if (!eval_.serial.ok) {
          textos.append(
            crear("h3", "", "Siguiente paso: asignar el número de serie del equipo"),
            crear(
              "p",
              "",
              "Con el serial, al liberar el equipo pasa al registro y podrá tener reportes de servicio."
            )
          );
          acciones.append(
            boton("Ir al número de serie", () => {
              const campo = document.getElementById("numero_serie");
              if (campo) {
                campo.scrollIntoView({ block: "center" });
                campo.focus();
              }
            })
          );
        } else {
          const p = crear("p");
          p.append(
            document.createTextNode("Lo deciden "),
            crear("b", "", "Dirección de Operaciones o Jefe de I+D+i"),
            document.createTextNode(". Todo lo del control de diseño está completo.")
          );
          textos.append(crear("h3", "", "Siguiente paso: liberar el diseño"), p);
          acciones.append(boton("Ir a Liberación", () => mostrarPaso(pasos.length - 1)));
        }
      }
      siguiente.append(ico, textos, acciones);
    }

    function pintarLateral(eval_) {
      lateral.replaceChildren();

      const rel = crear("div", "tarjeta-ancha");
      rel.append(crear("h3", "", "Relación con otros módulos"));
      const fila = (sigla, tono, titulo, detalle, enlace) => {
        const d = crear("div", "rel-fila");
        d.append(crear("span", `rel-sigla rel-sigla--${tono}`, sigla));
        const textos = crear("div");
        const t = crear(enlace ? "a" : "b", "", titulo);
        if (enlace) t.href = enlace;
        textos.append(t, crear("div", "muted", detalle));
        d.append(textos);
        rel.append(d);
      };
      if (proyecto) {
        fila(
          "PRY",
          "pry",
          proyecto.codigo_pry,
          `${proyecto.nombre_proyecto} · fase ${textoEstadoProyecto(proyecto.estado)}`,
          `#/proyectos/${proyecto.id}`
        );
      }
      fila(
        "EQ",
        "eq",
        expediente.numero_serie
          ? `Equipo ${expediente.numero_serie}`
          : "Equipo sin número de serie",
        pendiente
          ? "Al liberar, el equipo pasa al registro y podrá tener reportes de servicio."
          : "En el registro de equipos.",
        !pendiente && expediente.numero_serie ? "#/equipos" : null
      );
      const pendientes = (listas.cambios || []).filter((c) => c.estado === "pendiente").length;
      fila(
        "CD",
        "cd",
        pendientes
          ? `${pendientes} ${pendientes === 1 ? "cambio por decidir" : "cambios por decidir"}`
          : "Cambios de diseño al día",
        "Los decide Dirección de Operaciones o Jefe de I+D+i."
      );
      if (proyecto && requisicionesProyecto !== null) {
        const n = requisicionesProyecto;
        fila(
          "REQ",
          "req",
          n
            ? `${n} ${n === 1 ? "requisición" : "requisiciones"} del proyecto`
            : "Sin requisiciones aún",
          "Las requisiciones de materiales salen de las salidas aprobadas.",
          `#/proyectos/${proyecto.id}`
        );
      }

      const falta = crear("div", "tarjeta-ancha");
      falta.append(crear("h3", "", "Qué falta para liberar"));
      const lista = crear("ul", "check");
      [...ORDEN, "serial"].forEach((clave) => {
        const li = crear("li", eval_[clave].ok ? "" : "no", eval_[clave].texto);
        lista.append(li);
      });
      falta.append(lista);

      const consecuencias = crear("div", "consecuencias");
      consecuencias.append(
        crear("b", "", pendiente ? "Al liberar el diseño:" : "Al liberarse el diseño:")
      );
      const ul = crear("ul");
      [
        "El expediente queda de solo lectura: los ajustes van como Cambio de diseño.",
        "El equipo pasa al registro con su número de serie y podrá tener reportes de servicio.",
        "El proyecto puede continuar hacia Compras.",
        "Lo libera Dirección de Operaciones o Jefe de I+D+i.",
      ].forEach((texto) => ul.append(crear("li", "", texto)));
      consecuencias.append(ul);

      lateral.append(rel, falta, consecuencias);
    }

    function refrescar() {
      const eval_ = evaluar(listas, expediente);
      pintarPasos(eval_);
      pintarSiguiente(eval_);
      pintarLateral(eval_);
      return eval_;
    }

    async function mostrarPaso(i) {
      actual = i;
      const p = pasos[i];
      const eval_ = refrescar();
      const cab = crear("div", "exp-centro-cab");
      cab.append(crear("span", "muted", `Paso ${i + 1} de ${pasos.length}`));
      if (p.clave === "liberacion") {
        const tarjeta = crear("div", "tarjeta-ancha");
        tarjeta.append(cab, crear("h3", "exp-centro-tit", "Liberación del diseño"));
        const faltan = [...ORDEN, "serial"].filter((clave) => !eval_[clave].ok);
        if (pendiente && faltan.length) {
          tarjeta.append(
            alerta(
              "aviso",
              `Faltan ${faltan.length} ${faltan.length === 1 ? "punto" : "puntos"} del control de diseño (ver "Qué falta para liberar"). Se puede liberar igual, pero conviene completarlos.`
            )
          );
        }
        tarjeta.append(bloqueEstado);
        centro.replaceChildren(tarjeta);
        return;
      }
      // Se vuelve a pintar al entrar: la verificación ofrece los requisitos
      // registrados hasta ese momento.
      const config = subrecursosExpediente(opcionesUsuarios, {
        requisitos: listas.requisitos,
      }).find((c) => c.clave === p.clave);
      const seccion = await renderSeccionSubrecurso(id, config, editable, (lista) => {
        listas[p.clave] = lista;
        refrescar();
      });
      seccion.style.marginTop = "0";
      seccion.prepend(cab);
      centro.replaceChildren(seccion);
    }

    const primeroIncompleto = ORDEN.findIndex((clave) => !evaluar(listas, expediente)[clave].ok);
    await mostrarPaso(
      pendiente && primeroIncompleto >= 0 ? primeroIncompleto : pendiente ? 0 : pasos.length - 1
    );
    return raiz;
  }

  window.montarExpedienteGuiado = montarExpedienteGuiado;
})();
