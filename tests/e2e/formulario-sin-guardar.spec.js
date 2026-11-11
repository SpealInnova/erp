const { test, expect } = require("@playwright/test");
const { PASSWORD, USUARIO_PRINCIPAL } = require("./fixtures");
const { iniciarSesionComo } = require("./helpers");

test.describe("Aviso de cambios sin guardar", () => {
  // La primera carga real de /proyectos/nuevo dispara 3 llamadas en paralelo
  // (clientes, usuarios, cotizaciones); en CI, con CPU compartida, puede
  // tardar más que el timeout por defecto.
  test.describe.configure({ timeout: 60000 });

  test("avisa y permite cancelar la navegación al salir de un formulario con cambios", async ({
    page,
  }) => {
    await iniciarSesionComo(page, USUARIO_PRINCIPAL, PASSWORD);

    await page.goto("/inicio#/proyectos/nuevo");
    await page.fill("#nombre_proyecto", "Proyecto sin guardar todavía");

    page.once("dialog", (dialog) => dialog.dismiss());
    await page.click('a[data-modulo="clientes"]');
    await expect(page).toHaveURL(/#\/proyectos\/nuevo$/);
    await expect(page.locator("#nombre_proyecto")).toHaveValue("Proyecto sin guardar todavía");

    page.once("dialog", (dialog) => dialog.accept());
    await page.click('a[data-modulo="clientes"]');
    await expect(page).toHaveURL(/#\/clientes$/);
  });

  test("no avisa al salir de un formulario sin cambios", async ({ page }) => {
    await iniciarSesionComo(page, USUARIO_PRINCIPAL, PASSWORD);

    await page.goto("/inicio#/proyectos/nuevo");

    let aparecioDialogo = false;
    page.once("dialog", (dialog) => {
      aparecioDialogo = true;
      dialog.dismiss();
    });
    await page.click('a[data-modulo="clientes"]');
    await expect(page).toHaveURL(/#\/clientes$/);
    expect(aparecioDialogo).toBe(false);
  });
});
