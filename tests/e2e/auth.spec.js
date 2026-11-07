const { test, expect } = require("@playwright/test");
const { PASSWORD, USUARIO_PRINCIPAL } = require("./fixtures");
const { iniciarSesionComo } = require("./helpers");

test.describe("Autenticación", () => {
  test("inicia sesión con credenciales válidas y llega a Inicio", async ({ page }) => {
    await iniciarSesionComo(page, USUARIO_PRINCIPAL, PASSWORD);
    await expect(page.locator("#topbar-nombre")).toHaveText(USUARIO_PRINCIPAL.nombre);
  });

  test("rechaza credenciales inválidas y muestra el error", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#correo", USUARIO_PRINCIPAL.correo);
    await page.fill("#password", "contraseña-incorrecta");
    await page.click("#boton-login");

    const alerta = page.locator("#alerta-login");
    await expect(alerta).toContainText("Correo o contraseña incorrectos");
    await expect(page).toHaveURL(/login/);
  });
});
