const form = document.getElementById("form-restablecer");
const boton = document.getElementById("boton-restablecer");
const alerta = document.getElementById("alerta");

function mostrarAlerta(tipo, mensaje) {
  alerta.className = `alerta ${tipo}`;
  alerta.textContent = mensaje;
}

const token = new URLSearchParams(window.location.search).get("token");

if (!token) {
  mostrarAlerta("error", "El enlace no es válido. Solicita uno nuevo desde el inicio de sesión.");
  boton.disabled = true;
}

form.addEventListener("submit", async (evento) => {
  evento.preventDefault();

  const nueva = document.getElementById("nueva-password").value;
  const confirmar = document.getElementById("confirmar-password").value;

  if (nueva.length < 8) {
    mostrarAlerta("error", "La contraseña debe tener al menos 8 caracteres.");
    return;
  }
  if (nueva !== confirmar) {
    mostrarAlerta("error", "Las contraseñas no coinciden.");
    return;
  }

  boton.disabled = true;
  try {
    const respuesta = await fetch("/auth/restablecer-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, nuevaPassword: nueva }),
    });
    const cuerpo = await respuesta.json().catch(() => ({}));

    if (respuesta.status === 200) {
      form.classList.add("oculto");
      mostrarAlerta("ok", "Contraseña actualizada. Ya puedes iniciar sesión.");
      return;
    }
    if (respuesta.status === 400) {
      mostrarAlerta("error", "El enlace venció o ya fue usado. Solicita uno nuevo.");
    } else {
      mostrarAlerta("error", cuerpo.error || "No se pudo guardar la contraseña.");
    }
    boton.disabled = false;
  } catch {
    mostrarAlerta("error", "No hay conexión con el servidor. Intenta de nuevo.");
    boton.disabled = false;
  }
});
