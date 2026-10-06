const seccionLogin = document.getElementById("seccion-login");
const seccionRecuperar = document.getElementById("seccion-recuperar");
const formLogin = document.getElementById("form-login");
const formRecuperar = document.getElementById("form-recuperar");
const botonLogin = document.getElementById("boton-login");
const botonRecuperar = document.getElementById("boton-recuperar");
const alertaLogin = document.getElementById("alerta-login");
const alertaRecuperar = document.getElementById("alerta-recuperar");

function mostrarAlerta(elemento, tipo, mensaje) {
  elemento.className = `alerta ${tipo}`;
  elemento.textContent = mensaje;
}

function ocultarAlerta(elemento) {
  elemento.className = "alerta oculto";
  elemento.textContent = "";
}

async function enviar(url, datos) {
  const respuesta = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  const cuerpo = await respuesta.json().catch(() => ({}));
  return { status: respuesta.status, cuerpo };
}

formLogin.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  ocultarAlerta(alertaLogin);

  const correo = document.getElementById("correo").value.trim();
  const password = document.getElementById("password").value;
  if (!correo || !password) {
    mostrarAlerta(alertaLogin, "error", "Escribe tu correo y tu contraseña.");
    return;
  }

  botonLogin.disabled = true;
  try {
    const { status, cuerpo } = await enviar("/auth/login", { correo, password });
    if (status === 200) {
      sessionStorage.setItem("erp_token", cuerpo.token);
      sessionStorage.setItem("erp_usuario", cuerpo.usuario.nombre);
      window.location.href = "/inicio";
      return;
    }
    if (status === 423) {
      const hasta = new Date(cuerpo.bloqueadoHasta).toLocaleTimeString("es-CO", {
        hour: "2-digit",
        minute: "2-digit",
      });
      mostrarAlerta(
        alertaLogin,
        "error",
        `Cuenta bloqueada temporalmente por intentos fallidos. Intenta de nuevo a las ${hasta}.`
      );
    } else {
      mostrarAlerta(alertaLogin, "error", cuerpo.error || "No se pudo iniciar sesión.");
    }
  } catch (error) {
    mostrarAlerta(alertaLogin, "error", "No hay conexión con el servidor. Intenta de nuevo.");
  } finally {
    botonLogin.disabled = false;
  }
});

formRecuperar.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  ocultarAlerta(alertaRecuperar);

  const correo = document.getElementById("correo-recuperar").value.trim();
  if (!correo) {
    mostrarAlerta(alertaRecuperar, "error", "Escribe tu correo.");
    return;
  }

  botonRecuperar.disabled = true;
  try {
    const { cuerpo } = await enviar("/auth/solicitar-recuperacion", { correo });
    mostrarAlerta(alertaRecuperar, "ok", cuerpo.mensaje || "Revisa tu correo.");
  } catch (error) {
    mostrarAlerta(alertaRecuperar, "error", "No hay conexión con el servidor. Intenta de nuevo.");
  } finally {
    botonRecuperar.disabled = false;
  }
});

document.getElementById("ir-recuperar").addEventListener("click", () => {
  seccionLogin.classList.add("oculto");
  seccionRecuperar.classList.remove("oculto");
});

document.getElementById("volver-login").addEventListener("click", () => {
  seccionRecuperar.classList.add("oculto");
  seccionLogin.classList.remove("oculto");
});
