async function iniciarSesionComo(page, usuario, password) {
  await page.goto("/login");
  await page.fill("#correo", usuario.correo);
  await page.fill("#password", password);
  await page.click("#boton-login");
  await page.waitForURL("**/inicio");
  await page.getByText(usuario.nombre).waitFor();
}

module.exports = { iniciarSesionComo };
