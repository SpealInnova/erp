const { test, expect } = require("@playwright/test");
const { PASSWORD, USUARIO_PRINCIPAL } = require("./fixtures");
const { iniciarSesionComo } = require("./helpers");

test.describe("Flujo crítico: proyecto, fase, actividades y línea de tiempo", () => {
  test("crea un proyecto, avanza de fase, completa una actividad y ve su evolución", async ({
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

    // El equipo del proyecto ya no se muestra en la ficha.
    await expect(page.getByText("Equipo del proyecto")).toHaveCount(0);

    // Las evidencias no se cargan en la ficha: se abren con un botón.
    await expect(page.getByText("Evidencias del proyecto")).toHaveCount(0);
    await page.getByRole("button", { name: "Agregar evidencias" }).click();
    const ventana = page.getByRole("dialog", { name: "Evidencias del proyecto" });
    await expect(ventana).toBeVisible();
    await expect(ventana).toContainText("Aún no hay evidencias cargadas.");
    await expect(ventana.getByRole("button", { name: "Subir evidencia" })).toBeVisible();
    await ventana.getByRole("button", { name: "Cerrar" }).click();
    await expect(ventana).toHaveCount(0);

    // La línea de tiempo vive en su propia pestaña y se carga al abrirla.
    await expect(page.getByRole("tab", { name: "Proyecto" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await page.getByRole("tab", { name: "Línea de tiempo" }).click();
    const lineaTiempo = page.getByRole("tabpanel", { name: "Línea de tiempo" });
    await expect(lineaTiempo).toContainText("Cambio de fase");
    await expect(lineaTiempo).toContainText("Actividad completada");
    await expect(seccionActividades).toBeHidden();
  });
});
