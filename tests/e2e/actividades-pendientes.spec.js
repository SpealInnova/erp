const { test, expect } = require("@playwright/test");
const { PASSWORD, USUARIO_PRINCIPAL, USUARIO_COLEGA } = require("./fixtures");
const { iniciarSesionComo } = require("./helpers");

// Esta prueba sí deja que la ventana se abra sola (la configuración general
// la apaga para que no tape botones en las demás).
test.use({ storageState: { cookies: [], origins: [] } });

function fechaLocal(page, dias) {
  return page.evaluate((n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
  }, dias);
}

test("una actividad por vencer aparece en la ventana y en la campana, y lleva a la actividad", async ({
  page,
  browser,
}) => {
  const sufijo = Date.now().toString().slice(-8);
  const nombreCliente = `E2E Pendientes Cliente ${sufijo}`;
  const nombreProyecto = `E2E Pendientes Proyecto ${sufijo}`;

  // El responsable del proyecto crea el proyecto y asigna una actividad al
  // colega con fin mañana.
  await iniciarSesionComo(page, USUARIO_PRINCIPAL, PASSWORD);
  await page.goto("/inicio#/clientes/nuevo");
  await page.fill("#nombre_razon_social", nombreCliente);
  await page.selectOption("#tipo_identificacion", "NIT");
  await page.fill("#numero_identificacion", `E2E-PEND-${sufijo}`);
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
  await page
    .locator("tr", { hasText: nombreProyecto })
    .getByRole("button", { name: /Ver proyecto/ })
    .click();
  await page.selectOption("#nueva_fase", "planeacion");
  await page.click('button:has-text("Actualizar fase")');
  await expect(page.locator("details[open] .gantt")).toBeVisible();

  const proyectoId = page.url().match(/#\/proyectos\/(\d+)/)[1];
  const token = await page.evaluate(() => sessionStorage.getItem("erp_token"));
  const headers = { Authorization: `Bearer ${token}` };
  const { usuarios } = await (await page.request.get("/usuarios", { headers })).json();
  const colega = usuarios.find((u) => u.correo === USUARIO_COLEGA.correo);
  const { actividades } = await (
    await page.request.get(`/proyectos/${proyectoId}/actividades`, { headers })
  ).json();
  const actividad = actividades.find((a) => a.fase === "planeacion");
  const guardado = await page.request.put(`/proyectos/${proyectoId}/actividades/${actividad.id}`, {
    headers,
    data: {
      responsable_id: colega.id,
      fecha_inicio: await fechaLocal(page, 0),
      fecha_fin: await fechaLocal(page, 1),
    },
  });
  expect(guardado.ok()).toBe(true);

  // El colega entra: la ventana se abre sola con la actividad por vencer.
  const contexto = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const pagina = await contexto.newPage();
  try {
    await iniciarSesionComo(pagina, USUARIO_COLEGA, PASSWORD);
    const ventana = pagina.getByRole("dialog", { name: "Actividades pendientes" });
    await expect(ventana).toBeVisible();
    const item = ventana.locator(".item-actividad", { hasText: nombreProyecto });
    await expect(item).toContainText(actividad.descripcion);
    await expect(item).toContainText("Vence mañana");
    await expect(pagina.locator("#actividades-contador")).toBeVisible();

    // Y la campana tiene el aviso.
    await pagina.locator("#btn-notificaciones").click();
    await expect(pagina.locator("#panel-notificaciones")).toContainText("vence mañana");
    await pagina.keyboard.press("Escape");

    // "Ir a la actividad" abre el proyecto con el resumen de esa barra.
    await item.getByRole("button", { name: /Ir a la actividad/ }).click();
    await expect(pagina).toHaveURL(
      new RegExp(`#/proyectos/${proyectoId}/actividades/${actividad.id}$`)
    );
    await expect(ventana).toBeHidden();
    const resumen = pagina.locator(".gantt-popup");
    await expect(resumen.getByRole("heading", { name: actividad.descripcion })).toBeVisible();
    await expect(resumen).toContainText("Por vencer");
    await expect(pagina.locator(`.gantt-barra[data-actividad-id="${actividad.id}"]`)).toHaveClass(
      /gantt-barra--por-vencer/
    );

    // Se puede apagar la apertura automática desde la propia ventana.
    await pagina.locator("#btn-mis-actividades").click();
    await ventana.getByLabel("Abrir sola al iniciar sesión").uncheck();
    expect(await pagina.evaluate(() => localStorage.getItem("actividades-pendientes-auto"))).toBe(
      "0"
    );

    await pagina.screenshot({ path: "test-results/actividades-pendientes.png" });
  } finally {
    await contexto.close();
    // Limpieza: no dejar la actividad pendiente para las próximas corridas.
    await page.request.put(`/proyectos/${proyectoId}/actividades/${actividad.id}`, {
      headers,
      data: { estado: "completada" },
    });
  }
});
