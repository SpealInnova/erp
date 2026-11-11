const { test, expect } = require("@playwright/test");
const { PASSWORD, USUARIO_PRINCIPAL } = require("./fixtures");
const { iniciarSesionComo } = require("./helpers");

test.describe("Gantt de actividades", () => {
  test("usa el color de marca, grilla visible y no muestra días pasados", async ({ page }) => {
    const sufijo = Date.now().toString().slice(-8);
    const nombreCliente = `E2E Gantt Cliente ${sufijo}`;
    const nombreProyecto = `E2E Gantt Proyecto ${sufijo}`;

    await iniciarSesionComo(page, USUARIO_PRINCIPAL, PASSWORD);

    await page.goto("/inicio#/clientes/nuevo");
    await page.fill("#nombre_razon_social", nombreCliente);
    await page.selectOption("#tipo_identificacion", "NIT");
    await page.fill("#numero_identificacion", `E2E-GANTT-${sufijo}`);
    page.once("dialog", (dialog) => dialog.accept());
    await page.click('button:has-text("Crear cliente")');
    await page.waitForURL("**/inicio#/clientes");

    await page.goto("/inicio#/proyectos/nuevo");
    await page.selectOption("#cliente_id", { label: nombreCliente });
    await page.selectOption("#responsable_id", { label: USUARIO_PRINCIPAL.nombre });
    await page.fill("#nombre_proyecto", nombreProyecto);
    page.once("dialog", (dialog) => dialog.accept());
    await page.click('button:has-text("Crear proyecto")');
    await page.waitForURL("**/inicio#/proyectos");

    const fila = page.locator("tr", { hasText: nombreProyecto });
    await fila.getByRole("button", { name: /Ver proyecto/ }).click();

    await page.selectOption("#nueva_fase", "planeacion");
    await page.fill("#observacion_fase", "Aprobado por QA automatizado");
    await page.click('button:has-text("Actualizar fase")');

    const svgGantt = page.locator("svg.gantt").first();
    await expect(svgGantt).toBeVisible();

    const colorBarra = await svgGantt
      .locator(".bar")
      .first()
      .evaluate((el) => getComputedStyle(el).fill);
    expect(colorBarra).toBe("rgb(201, 147, 10)"); // #c9930a

    const anchoTick = await svgGantt
      .locator(".tick")
      .first()
      .evaluate((el) => getComputedStyle(el).strokeWidth);
    expect(parseFloat(anchoTick)).toBeGreaterThanOrEqual(1);

    const botonAtras = page.getByRole("button", { name: "+ Días atrás" });
    const botonAdelante = page.getByRole("button", { name: "+ Días adelante" });
    await expect(botonAtras).toBeVisible();
    await expect(botonAdelante).toBeVisible();

    const ticksAntes = await svgGantt.locator(".tick").count();
    await botonAdelante.click();
    const ticksDespues = await svgGantt.locator(".tick").count();
    expect(ticksDespues).toBeGreaterThan(ticksAntes);

    // Botón "+ Días atrás" no debe revelar fechas previas a hoy: el número
    // de columnas no debería crecer más allá de lo que ya exista hasta hoy.
    const ticksAntesDeRetroceder = await svgGantt.locator(".tick").count();
    await botonAtras.click();
    const ticksDespuesDeRetroceder = await svgGantt.locator(".tick").count();
    expect(ticksDespuesDeRetroceder).toBe(ticksAntesDeRetroceder);

    await page.screenshot({ path: "test-results/gantt-vista.png", fullPage: true });
  });
});
