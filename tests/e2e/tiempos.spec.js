const { test, expect } = require("@playwright/test");
const { PASSWORD, USUARIO_PRINCIPAL, USUARIO_COLEGA } = require("./fixtures");
const { iniciarSesionComo } = require("./helpers");

test.describe("Tiempos y KPI", () => {
  test("los cargos directivos lo abren desde el menú y cambian el periodo", async ({ page }) => {
    const errores = [];
    page.on("pageerror", (error) => errores.push(String(error)));
    await iniciarSesionComo(page, USUARIO_PRINCIPAL, PASSWORD);

    await page.locator('.menu a[data-modulo="tiempos"]').click();
    await expect(page).toHaveURL(/#\/tiempos$/);
    await expect(page.getByRole("heading", { name: "Tiempos y KPI" })).toBeVisible();
    await expect(page.locator(".kpi-general")).toHaveCount(4);
    for (const titulo of [
      "Tiempo por fase",
      "Por tipo de actividad",
      "Las más demoradas frente a su plan",
      "Tareas fuera de proyectos",
    ]) {
      await expect(page.getByRole("heading", { name: titulo })).toBeVisible();
    }

    const periodo = page.getByRole("group", { name: "Periodo" });
    await periodo.getByRole("button", { name: "Todo" }).click();
    await expect(periodo.getByRole("button", { name: "Todo" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await page.screenshot({ path: "test-results/tiempos-kpi.png", fullPage: true });
    expect(errores).toEqual([]);
  });

  test("un cargo sin permiso no lo ve en el menú ni lo puede abrir", async ({ page }) => {
    await iniciarSesionComo(page, USUARIO_COLEGA, PASSWORD);
    await expect(page.locator('.menu a[data-modulo="tiempos"]')).toBeHidden();
    await page.goto("/inicio#/tiempos");
    await expect(page.getByText("Tu cargo no tiene acceso a este tablero")).toBeVisible();
  });
});
