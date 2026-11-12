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

module.exports = { iniciarSesionComo };
