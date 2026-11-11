const { test, expect } = require("@playwright/test");
const { PASSWORD, USUARIO_PRINCIPAL, USUARIO_COLEGA } = require("./fixtures");
const { iniciarSesionComo } = require("./helpers");

test.describe("Orden de la tabla de Usuarios", () => {
  test("permite ordenar por nombre haciendo clic en el encabezado", async ({ page }) => {
    await iniciarSesionComo(page, USUARIO_PRINCIPAL, PASSWORD);
    await page.goto("/inicio#/usuarios");

    const primeraCelda = page.locator("tbody tr td:first-child");
    await expect(primeraCelda.first()).toBeVisible();

    const nombresAscendente = await primeraCelda.allTextContents();
    const indiceColega = nombresAscendente.indexOf(USUARIO_COLEGA.nombre);
    const indicePrincipal = nombresAscendente.indexOf(USUARIO_PRINCIPAL.nombre);
    expect(indiceColega).toBeGreaterThanOrEqual(0);
    expect(indicePrincipal).toBeGreaterThanOrEqual(0);
    expect(indiceColega).toBeLessThan(indicePrincipal);

    await page.locator("th", { hasText: "Nombre" }).click();

    const nombresDescendente = await primeraCelda.allTextContents();
    const nuevoIndiceColega = nombresDescendente.indexOf(USUARIO_COLEGA.nombre);
    const nuevoIndicePrincipal = nombresDescendente.indexOf(USUARIO_PRINCIPAL.nombre);
    expect(nuevoIndicePrincipal).toBeLessThan(nuevoIndiceColega);
  });
});
