async function iniciarSesionComo(page, usuario, password) {
  await page.goto("/login");
  await page.fill("#correo", usuario.correo);
  await page.fill("#password", password);
  await page.click("#boton-login");
  await page.waitForURL("**/inicio");
  // El nombre también puede aparecer en el tablero de inicio (p. ej. en la
  // carga por responsable): se espera en la barra superior para no ser ambiguo.
  await page.locator("#topbar-nombre", { hasText: usuario.nombre }).waitFor();
}

// Responde el próximo diálogo (confirm/alert) y devuelve una promesa que se
// cumple cuando la respuesta ya llegó al navegador. Con un manejador "suelto"
// (page.once("dialog", d => d.accept())) la prueba puede terminar antes de que
// accept() resuelva y falla con "dialog.accept: Test ended" de forma
// intermitente en CI.
function responderProximoDialogo(page, aceptar) {
  return new Promise((resolve, reject) => {
    page.once("dialog", (dialog) =>
      (aceptar ? dialog.accept() : dialog.dismiss()).then(resolve, reject)
    );
  });
}

module.exports = { iniciarSesionComo, responderProximoDialogo };
