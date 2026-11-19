const { test, expect } = require("@playwright/test");
const { PASSWORD, USUARIO_PRINCIPAL } = require("./fixtures");
const { iniciarSesionComo } = require("./helpers");

// Proyecto nuevo en Planeación (sus actividades vienen de la plantilla).
async function proyectoEnPlaneacion(page) {
  const sufijo = Date.now().toString().slice(-8);
  const nombreCliente = `E2E Ficha Cliente ${sufijo}`;
  const nombreProyecto = `E2E Ficha Proyecto ${sufijo}`;
  await iniciarSesionComo(page, USUARIO_PRINCIPAL, PASSWORD);
  await page.goto("/inicio#/clientes/nuevo");
  await page.fill("#nombre_razon_social", nombreCliente);
  await page.selectOption("#tipo_identificacion", "NIT");
  await page.fill("#numero_identificacion", `E2E-FICHA-${sufijo}`);
  page.once("dialog", (d) => d.accept());
  await page.click('button:has-text("Crear cliente")');
  await page.waitForURL("**/inicio#/clientes");
  await page.goto("/inicio#/proyectos/nuevo");
  await page.selectOption("#cliente_id", { label: nombreCliente });
  await page.selectOption("#responsable_id", { label: USUARIO_PRINCIPAL.nombre });
  await page.fill("#nombre_proyecto", nombreProyecto);
  page.once("dialog", (d) => d.accept());
  await page.click('button:has-text("Crear proyecto")');
  await page.waitForURL("**/inicio#/proyectos");
  return { nombreProyecto };
}

test("tarjetas, estados y prioridad desde el Gantt, siguiente paso, etapas y línea de tiempo", async ({
  page,
}) => {
  const { nombreProyecto } = await proyectoEnPlaneacion(page);

  // Lista en tarjetas: semáforo, fase y detalle desplegable
  const tarjeta = page.locator(".pcard", { hasText: nombreProyecto });
  await expect(tarjeta).toBeVisible();
  await expect(tarjeta).toContainText("Prospecto");
  await expect(page.getByRole("group", { name: "Filtrar por plazo" })).toBeVisible();
  const codigo = (await tarjeta.locator(".pcard-cod").textContent()).trim();
  await tarjeta.getByRole("button", { name: `Ver detalle de ${codigo}` }).click();
  await expect(tarjeta.locator(".pcard-det")).toContainText("Lo próximo");

  // A Planeación: se crean las actividades
  await tarjeta.getByRole("button", { name: `Ver proyecto ${codigo}` }).click();
  await page.selectOption("#nueva_fase", "planeacion");
  await page.click('button:has-text("Actualizar fase")');
  const gantt = page.locator("details[open] .gantt");
  await expect(gantt).toBeVisible();
  const proyectoId = page.url().match(/#\/proyectos\/(\d+)/)[1];

  // Siguiente paso: la primera actividad de la fase
  const siguiente = page.getByRole("region", { name: "Siguiente paso" });
  await expect(siguiente).toContainText("Siguiente paso: Avanzar:");
  await expect(siguiente).toContainText("Planeación");

  // Iniciar y luego finalizar desde el resumen de la barra
  const primera = gantt.locator(".gantt-barra").first();
  const id = await primera.getAttribute("data-actividad-id");
  const barra = () => gantt.locator(`.gantt-barra[data-actividad-id="${id}"]`);
  await primera.click();
  await page.locator(".gantt-popup").getByRole("button", { name: "▶ Iniciar" }).click();
  await expect(barra()).toHaveClass(/gantt-barra--en-curso/);
  await expect(siguiente).toContainText("Siguiente paso: Terminar:");
  await barra().click();
  await expect(page.locator(".gantt-popup")).toContainText("En curso");
  await page.locator(".gantt-popup").getByRole("button", { name: "✓ Finalizar" }).click();
  await expect(barra()).toHaveClass(/gantt-barra--completada/);

  // Prioridad Urgente desde el engranaje de otra actividad
  const otra = gantt.locator(".gantt-barra").nth(1);
  const idOtra = await otra.getAttribute("data-actividad-id");
  await otra.click();
  await page.getByRole("button", { name: "Gestionar actividad" }).click();
  const dialogo = page.locator("dialog[open]");
  await dialogo.getByLabel("Prioridad").selectOption("urgente");
  await dialogo.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(gantt.locator(`.gantt-barra[data-actividad-id="${idOtra}"]`)).toHaveClass(
    /gantt-barra--prioridad-urgente/
  );

  // Resumen por etapa: Planeación en curso con su urgente y su avance
  await page.getByRole("tab", { name: "Resumen por etapa" }).click();
  const etapa = page.locator(".etapa-tarjeta", { hasText: "Planeación" });
  await expect(etapa).toHaveAttribute("aria-pressed", "true");
  await expect(etapa).toContainText("1 urgente");
  await expect(page.locator(".etapa-detalle")).toContainText("Avisos de la etapa");
  await expect(page.locator(".etapa-detalle")).toContainText("Urgente");

  // Línea de tiempo agrupada por fase, con los pasos de la actividad
  await page.getByRole("tab", { name: "Línea de tiempo" }).click();
  const linea = page.getByRole("tabpanel", { name: "Línea de tiempo" });
  await expect(linea.locator(".vtl-fase-nom")).toHaveText(["Prospecto", "Planeación"]);
  await expect(linea).toContainText("Proyecto creado");
  await expect(linea).toContainText("Actividad iniciada");
  await expect(linea).toContainText("Actividad finalizada");
  await expect(linea).toContainText("Prioridad Urgente");
  await linea.getByRole("button", { name: "Fases" }).click();
  await expect(linea.locator(".vtl-ev:visible")).toHaveCount(2); // creación y cambio de fase

  // Un documento nuevo abre ya enlazado al proyecto
  await page.goto(`/inicio#/requisiciones/nuevo?proyecto=${proyectoId}`);
  await expect(page.locator("#proyecto_id")).toHaveValue(proyectoId);

  await page.screenshot({ path: "test-results/ficha-proyecto.png", fullPage: true });
});
