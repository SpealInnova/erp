const { test, expect } = require("@playwright/test");
const { PASSWORD, USUARIO_PRINCIPAL, USUARIO_COLEGA } = require("./fixtures");
const { iniciarSesionComo } = require("./helpers");

test.describe("Flujo crítico: proyecto, fase, actividades y equipo", () => {
  test("crea un proyecto, avanza de fase, completa una actividad y agrega equipo", async ({
    page,
  }) => {
    const sufijo = Date.now().toString().slice(-8);
    const nombreCliente = `E2E Cliente ${sufijo}`;
    const nombreProyecto = `E2E Proyecto ${sufijo}`;

    await iniciarSesionComo(page, USUARIO_PRINCIPAL, PASSWORD);

    // Crear cliente
    await page.goto("/inicio#/clientes/nuevo");
    await page.fill("#nombre_razon_social", nombreCliente);
    await page.selectOption("#tipo_identificacion", "NIT");
    await page.fill("#numero_identificacion", `E2E-${sufijo}`);
    page.once("dialog", (dialog) => dialog.accept());
    await page.click('button:has-text("Crear cliente")');
    await page.waitForURL("**/inicio#/clientes");

    // Crear proyecto para ese cliente
    await page.goto("/inicio#/proyectos/nuevo");
    await page.selectOption("#cliente_id", { label: nombreCliente });
    await page.selectOption("#responsable_id", { label: USUARIO_PRINCIPAL.nombre });
    await page.fill("#nombre_proyecto", nombreProyecto);
    page.once("dialog", (dialog) => dialog.accept());
    await page.click('button:has-text("Crear proyecto")');
    await page.waitForURL("**/inicio#/proyectos");

    // Abrir el proyecto recién creado
    const fila = page.locator("tr", { hasText: nombreProyecto });
    await fila.getByRole("button", { name: /Ver proyecto/ }).click();
    await expect(page.locator("#nueva_fase")).toBeVisible();

    // Avanzar de fase
    await page.selectOption("#nueva_fase", "planeacion");
    await page.fill("#observacion_fase", "Aprobado por QA automatizado");
    await page.click('button:has-text("Actualizar fase")');

    // Actividades generadas para la fase
    const seccionActividades = page
      .locator(".tarjeta-ancha", { hasText: "Actividades por fase" })
      .last();
    await expect(seccionActividades).toBeVisible();
    const barras = seccionActividades.locator("details[open] .gantt-barra");
    await expect(barras.first()).toBeVisible();
    const totalActividades = await barras.count();
    expect(totalActividades).toBeGreaterThan(0);

    // Completar la primera actividad desde el engranaje de su barra
    const idPrimera = await barras.first().getAttribute("data-actividad-id");
    await barras.first().click();
    await page.getByRole("button", { name: "Gestionar actividad" }).click();
    const dialogo = page.locator("dialog[open]");
    await dialogo.getByLabel("Estado", { exact: true }).selectOption("completada");
    await dialogo.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(dialogo).toHaveCount(0);
    await expect(
      seccionActividades.locator(`.gantt-barra[data-actividad-id="${idPrimera}"]`)
    ).toHaveClass(/gantt-barra--completada/);

    // Agregar un integrante al equipo
    const seccionEquipo = page.locator(".tarjeta-ancha", { hasText: "Equipo del proyecto" }).last();
    await seccionEquipo.locator("#equipo_usuario_id").selectOption({ label: USUARIO_COLEGA.nombre });
    await seccionEquipo.locator("#equipo_rol").fill("técnico");
    await seccionEquipo.getByRole("button", { name: "Agregar al equipo" }).click();

    const filaEquipo = seccionEquipo.locator("tr", { hasText: USUARIO_COLEGA.nombre });
    await expect(filaEquipo).toBeVisible();
    await expect(filaEquipo).toContainText("técnico");

    // La línea de tiempo se recarga junto con el resto de la página; refrescamos
    // para ver el evento de alta de equipo que la sección de equipo no empuja sola.
    await page.reload();
    const lineaTiempo = page.locator(".tarjeta-ancha", { hasText: "Línea de tiempo" }).last();
    await expect(lineaTiempo).toContainText("Cambio de fase");
    await expect(lineaTiempo).toContainText(`${USUARIO_COLEGA.nombre} se unió al equipo`);
  });
});
