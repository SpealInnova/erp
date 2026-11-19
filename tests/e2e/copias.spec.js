const { test, expect } = require("@playwright/test");
const { PASSWORD, USUARIO_PRINCIPAL, USUARIO_COLEGA } = require("./fixtures");
const { iniciarSesionComo } = require("./helpers");

// No se pulsa "Hacer copia ahora": las pruebas no suben nada a Drive (el
// servidor lo cubre con Drive simulado en tests/integration/copiasSeguridad).
test.describe("Panel de copias de seguridad", () => {
  test("el Gerente General ve el estado y el registro de copias", async ({ page }) => {
    const errores = [];
    page.on("pageerror", (error) => errores.push(String(error)));
    await iniciarSesionComo(page, USUARIO_PRINCIPAL, PASSWORD);

    await page.locator('.menu a[data-modulo="copias"]').click();
    await expect(page).toHaveURL(/#\/copias$/);
    await expect(page.getByRole("heading", { name: "Copias de seguridad" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Estado" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Últimas copias" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Hacer copia ahora" })).toBeEnabled();
    await page.screenshot({ path: "test-results/copias.png", fullPage: true });
    expect(errores).toEqual([]);
  });

  test("otros cargos no lo ven ni lo pueden abrir", async ({ page }) => {
    await iniciarSesionComo(page, USUARIO_COLEGA, PASSWORD);
    await expect(page.locator('.menu a[data-modulo="copias"]')).toBeHidden();
    await page.goto("/inicio#/copias");
    await expect(
      page.getByText("Las copias de seguridad las gestionan el administrador y el Gerente General.")
    ).toBeVisible();
  });
});
