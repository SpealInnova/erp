const token = sessionStorage.getItem("erp_token");
const nombre = sessionStorage.getItem("erp_usuario");

if (!token) {
  window.location.replace("/login");
} else {
  document.getElementById("saludo").textContent = `Hola, ${nombre}.`;
}

document.getElementById("cerrar-sesion").addEventListener("click", () => {
  sessionStorage.removeItem("erp_token");
  sessionStorage.removeItem("erp_usuario");
  window.location.replace("/login");
});
