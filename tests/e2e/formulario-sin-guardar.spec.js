const { test, expect } = require("@playwright/test");
const { PASSWORD, USUARIO_PRINCIPAL } = require("./fixtures");
const { iniciarSesionComo } = require("./helpers");

test.describe("Aviso de cambios sin guardar", () => {
  test("avisa y permite cancelar la navegación al salir de un formulario con cambios", async ({
    page,
  }) => {
    await iniciarSesionComo(page, USUARIO_PRINCIPAL, PASSWORD);

    await page.goto("/inicio#/clientes/nuevo");
    await page.fill("#nombre_razon_social", "Cliente sin guardar todavía");

    page.once("dialog", (dialog) => dialog.dismiss());
    await page.click('a[data-modulo="proyectos"]');
    await expect(page).toHaveURL(/#\/clientes\/nuevo$/);
    await expect(page.locator("#nombre_razon_social")).toHaveValue("Cliente sin guardar todavía");

    page.once("dialog", (dialog) => dialog.accept());
    await page.click('a[data-modulo="proyectos"]');
    await expect(page).toHaveURL(/#\/proyectos$/);
  });

  test("no avisa al salir de un formulario sin cambios", async ({ page }) => {
    await iniciarSesionComo(page, USUARIO_PRINCIPAL, PASSWORD);

    await page.goto("/inicio#/clientes/nuevo");

    let aparecioDialogo = false;
    page.once("dialog", (dialog) => {
      aparecioDialogo = true;
      dialog.dismiss();
    });
    await page.click('a[data-modulo="proyectos"]');
    await expect(page).toHaveURL(/#\/proyectos$/);
    expect(aparecioDialogo).toBe(false);
  });
});
