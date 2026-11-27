const { test, expect } = require("@playwright/test");
const { PASSWORD, USUARIO_PRINCIPAL, USUARIO_COLEGA } = require("./fixtures");
const { iniciarSesionComo } = require("./helpers");

test.describe("Usuarios y auditoría", () => {
  test("el Gerente General revisa la auditoría y la actividad de una persona", async ({ page }) => {
    const errores = [];
    page.on("pageerror", (error) => errores.push(String(error)));
    await iniciarSesionComo(page, USUARIO_PRINCIPAL, PASSWORD);

    // deja rastro propio: crea y edita un cliente
    const token = await page.evaluate(() => sessionStorage.getItem("erp_token"));
    const encabezados = { Authorization: `Bearer ${token}` };
    const sufijo = Date.now().toString().slice(-8);
    const creado = await page.request.post("/clientes", {
      headers: encabezados,
      data: {
        nombre_razon_social: `E2E Auditoría ${sufijo}`,
        tipo_identificacion: "NIT",
        numero_identificacion: `E2E-AUD-${sufijo}`,
        ciudad: "Bogotá",
      },
    });
    expect(creado.status()).toBe(201);
    const { cliente } = await creado.json();
    const editado = await page.request.put(`/clientes/${cliente.id}`, {
      headers: encabezados,
      data: { ciudad: "Cali" },
    });
    expect(editado.status()).toBe(200);

    await page.locator('.menu a[data-modulo="usuarios"]').click();
    await expect(page).toHaveURL(/#\/usuarios$/);
    const pestanas = page.locator("#subtabs");
    await expect(pestanas.getByRole("link")).toHaveCount(2);
    await pestanas.getByRole("link", { name: "Auditoría" }).click();
    await expect(page).toHaveURL(/#\/auditoria$/);
    await expect(page.getByRole("heading", { name: "Auditoría", level: 2 })).toBeVisible();
    const filas = page.locator(".tabla-auditoria tbody tr");
    await expect(filas.first()).toBeVisible();
    await expect(page.locator(".resumen-listado")).toContainText("registro");

    // solo cambios: cada fila dice "Cambió"
    await page.getByLabel("Acción").selectOption("actualizar");
    await expect(filas.first()).toContainText("Cambió");
    const acciones = await page
      .locator(".tabla-auditoria tbody tr td:nth-child(3)")
      .allTextContents();
    expect(acciones.every((t) => t.includes("Cambió"))).toBe(true);
    await page.screenshot({ path: "test-results/auditoria.png", fullPage: true });

    // desde Usuarios, "Ver actividad" abre la auditoría de esa persona
    await pestanas.getByRole("link", { name: "Usuarios" }).click();
    await page
      .getByRole("button", { name: `Ver la actividad de ${USUARIO_PRINCIPAL.nombre}` })
      .click();
    await expect(page).toHaveURL(/#\/auditoria\?usuario=\d+$/);
    await expect(page.getByLabel("Persona")).not.toHaveValue("");
    await expect(page.locator(".tabla-auditoria tbody tr").first()).toContainText(
      USUARIO_PRINCIPAL.nombre
    );
    expect(errores).toEqual([]);
  });

  test("'Qué cambió' muestra estados, fechas y horas legibles", async ({ page }) => {
    await iniciarSesionComo(page, USUARIO_PRINCIPAL, PASSWORD);
    const token = await page.evaluate(() => sessionStorage.getItem("erp_token"));
    const encabezados = { Authorization: `Bearer ${token}` };
    const creada = await page.request.post("/tareas", {
      headers: encabezados,
      data: { titulo: `E2E auditoría legible ${Date.now()}`, fecha_fin: "2026-12-15" },
    });
    expect(creada.status()).toBe(201);
    const { tarea } = await creada.json();
    // pasa a "en curso" (llena iniciada_en, fecha y hora) y cambia su fecha final
    const editada = await page.request.put(`/tareas/${tarea.id}`, {
      headers: encabezados,
      data: { estado: "en_curso", fecha_fin: "2026-12-20" },
    });
    expect(editada.status()).toBe(200);

    await page.goto("/inicio#/auditoria");
    await page.getByRole("combobox", { name: "Módulo", exact: true }).selectOption("tareas");
    await page.getByLabel("Acción").selectOption("actualizar");
    const cambios = page
      .locator(".tabla-auditoria tbody tr", { hasText: tarea.titulo })
      .locator(".aud-cambios");
    await expect(cambios).toContainText("Estado: Pendiente → En curso");
    await expect(cambios).toContainText("Fecha fin: 15/12/2026 → 20/12/2026");
    await expect(cambios).toContainText("Iniciada en: vacío →");
    const texto = await cambios.textContent();
    expect(texto).not.toContain("en_curso");
    expect(texto).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  test("otros cargos no ven la auditoría", async ({ page }) => {
    await iniciarSesionComo(page, USUARIO_COLEGA, PASSWORD);
    await page.goto("/inicio#/usuarios");
    await expect(page.locator("#subtabs")).toBeHidden();
    await expect(page.getByRole("button", { name: /Ver la actividad de/ })).toHaveCount(0);
    await page.goto("/inicio#/auditoria");
    await expect(
      page.getByText("La auditoría la ven el administrador y el Gerente General.")
    ).toBeVisible();
  });
});
