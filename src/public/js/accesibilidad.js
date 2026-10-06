const CLAVE_PREFERENCIAS = "erp_accesibilidad";
const raiz = document.documentElement;

function leerPreferencias() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_PREFERENCIAS)) || {};
  } catch {
    return {};
  }
}

function guardarPreferencias(preferencias) {
  try {
    localStorage.setItem(CLAVE_PREFERENCIAS, JSON.stringify(preferencias));
  } catch {
    return;
  }
}

function aplicarPreferencias(preferencias) {
  if (preferencias.contraste) {
    raiz.setAttribute("data-contraste", "alto");
  } else {
    raiz.removeAttribute("data-contraste");
  }

  if (preferencias.texto && preferencias.texto !== "normal") {
    raiz.setAttribute("data-texto", preferencias.texto);
  } else {
    raiz.removeAttribute("data-texto");
  }

  if (preferencias.movimiento) {
    raiz.setAttribute("data-movimiento", "reducido");
  } else {
    raiz.removeAttribute("data-movimiento");
  }
}

const preferencias = leerPreferencias();
if (!("movimiento" in preferencias)) {
  preferencias.movimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
aplicarPreferencias(preferencias);

document.addEventListener("DOMContentLoaded", () => {
  const boton = document.getElementById("btn-accesibilidad");
  const panel = document.getElementById("panel-accesibilidad");
  const opcionContraste = document.getElementById("opcion-contraste");
  const opcionMovimiento = document.getElementById("opcion-movimiento");
  const opcionesTexto = document.querySelectorAll('input[name="texto"]');

  if (!boton || !panel) {
    return;
  }

  opcionContraste.checked = Boolean(preferencias.contraste);
  opcionMovimiento.checked = Boolean(preferencias.movimiento);
  opcionesTexto.forEach((opcion) => {
    opcion.checked = opcion.value === (preferencias.texto || "normal");
  });

  function abrir(abierto) {
    panel.classList.toggle("oculto", !abierto);
    boton.setAttribute("aria-expanded", String(abierto));
  }

  function cambiar() {
    const texto = document.querySelector('input[name="texto"]:checked');
    preferencias.contraste = opcionContraste.checked;
    preferencias.movimiento = opcionMovimiento.checked;
    preferencias.texto = texto ? texto.value : "normal";
    aplicarPreferencias(preferencias);
    guardarPreferencias(preferencias);
  }

  boton.addEventListener("click", () => abrir(panel.classList.contains("oculto")));

  panel.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape") {
      abrir(false);
      boton.focus();
    }
  });

  opcionContraste.addEventListener("change", cambiar);
  opcionMovimiento.addEventListener("change", cambiar);
  opcionesTexto.forEach((opcion) => opcion.addEventListener("change", cambiar));
});
