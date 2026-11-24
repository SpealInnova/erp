const { test, expect } = require("@playwright/test");
const { PASSWORD, USUARIO_PRINCIPAL, USUARIO_COLEGA } = require("./fixtures");
const { iniciarSesionComo } = require("./helpers");

// Fecha local del navegador (AAAA-MM-DD), como la escribe el usuario.
async function hoyEnNavegador(page) {
  return page.evaluate(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
  });
}

test.describe("Inicio, Mis tareas y proveedores en tarjetas", () => {
  test("el inicio es el tablero general de cada persona", async ({ page }) => {
    const errores = [];
    page.on("pageerror", (error) => errores.push(String(error)));
    await iniciarSesionComo(page, USUARIO_PRINCIPAL, PASSWORD);

    await expect(page.getByRole("heading", { name: "Hola, QA" })).toBeVisible();
    await expect(page.locator('.menu a[data-modulo="inicio"]')).toHaveAttribute(
      "aria-current",
      "page"
    );
    await expect(page.locator(".kpi-general")).toHaveCount(4);
    await expect(page.locator(".tg-dia")).toHaveCount(7);
    const periodo = page.getByRole("group", { name: "Periodo" });
    await periodo.getByRole("button", { name: "Este mes" }).click();
    await expect(periodo.getByRole("button", { name: "Este mes" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await page.screenshot({ path: "test-results/tablero-general.png", fullPage: true });
    expect(errores).toEqual([]);
  });

  test("una tarea asignada se inicia, se finaliza y lleva su horómetro", async ({
    page,
    browser,
  }) => {
    const errores = [];
    page.on("pageerror", (error) => errores.push(String(error)));
    const titulo = `E2E Tarea ${Date.now().toString().slice(-8)}`;
    await iniciarSesionComo(page, USUARIO_PRINCIPAL, PASSWORD);

    // El principal la crea para el colega desde "Mis tareas"
    await page.locator('.menu a[data-modulo="tareas"]').click();
    await expect(page.getByRole("heading", { name: "Mis tareas" })).toBeVisible();
    await page.getByRole("button", { name: "+ Nueva tarea" }).click();
    const ventana = page.getByRole("dialog", { name: "Nueva tarea" });
    await ventana.getByLabel("Tarea *").fill(titulo);
    await ventana.getByLabel("Responsable").selectOption({ label: USUARIO_COLEGA.nombre });
    await ventana.getByLabel("Prioridad").selectOption("urgente");
    await ventana.getByLabel("Fecha de fin").fill(await hoyEnNavegador(page));
    await ventana.getByRole("button", { name: "Crear tarea" }).click();
    await expect(ventana).toBeHidden();

    await page
      .getByRole("group", { name: "Origen" })
      .getByRole("button", { name: "Asignadas por mí" })
      .click();
    const filaCreador = page.locator(".tarea-fila", { hasText: titulo });
    await expect(filaCreador).toContainText(`Para ${USUARIO_COLEGA.nombre}`);
    await expect(filaCreador.locator(".pill", { hasText: "Urgente" })).toBeVisible();

    // El colega la ve en su inicio y en Mis tareas, y la trabaja
    const contexto = await browser.newContext();
    const colega = await contexto.newPage();
    colega.on("pageerror", (error) => errores.push(String(error)));
    await iniciarSesionComo(colega, USUARIO_COLEGA, PASSWORD);
    await expect(colega.locator(".tg-tarjeta", { hasText: "Lo que me toca" })).toContainText(
      titulo
    );

    await colega.goto("/inicio#/tareas");
    await colega
      .getByRole("group", { name: "Origen" })
      .getByRole("button", { name: "Todo" })
      .click();
    const fila = colega.locator(".tarea-fila", { hasText: titulo });
    await expect(fila).toContainText(`Asignada por ${USUARIO_PRINCIPAL.nombre}`);
    await fila.getByRole("button", { name: `Iniciar: ${titulo}` }).click();
    await expect(fila.locator(".pill", { hasText: "En curso" })).toBeVisible();
    await expect(fila.locator(".horometro--activo")).toBeVisible();
    await colega.screenshot({ path: "test-results/mis-tareas.png", fullPage: true });

    await fila.getByRole("button", { name: `Finalizar: ${titulo}` }).click();
    await expect(fila).toHaveCount(0);
    await colega
      .getByRole("group", { name: "Estado" })
      .getByRole("button", { name: "Finalizadas" })
      .click();
    await colega
      .getByRole("group", { name: "Periodo" })
      .getByRole("button", { name: "Todas" })
      .click();
    await expect(colega.locator(".tarea-fila", { hasText: titulo })).toBeVisible();

    // Enlace directo (el de los avisos): abre la ventana de la tarea
    const token = await colega.evaluate(() => sessionStorage.getItem("erp_token"));
    const lista = await colega.request.get("/tareas?estado=todas&periodo=todas", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const tarea = (await lista.json()).tareas.find((t) => t.titulo === titulo);
    await colega.goto(`/inicio#/tareas/${tarea.id}`);
    const ventanaTarea = colega.getByRole("dialog", { name: titulo });
    await expect(ventanaTarea).toBeVisible();
    await expect(ventanaTarea.getByLabel("Estado")).toHaveValue("completada");
    await ventanaTarea.getByRole("button", { name: "Cancelar" }).click();
    await expect(colega).toHaveURL(/#\/tareas$/);

    expect(errores).toEqual([]);
    await contexto.close();
  });

  test("los proveedores se ven como tarjetas con su calificación y sus órdenes", async ({
    page,
  }) => {
    const sufijo = Date.now().toString().slice(-8);
    await iniciarSesionComo(page, USUARIO_PRINCIPAL, PASSWORD);
    const token = await page.evaluate(() => sessionStorage.getItem("erp_token"));
    const r = await page.request.post("/proveedores", {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        nit_cc: `E2E-PV-${sufijo}`,
        razon_social: `E2E Proveedor Tarjeta ${sufijo}`,
        tipo_persona: "juridica",
        origen: "nacional",
        clasificacion: "ambos",
        contacto_comercial_nombre: "Ana Compras",
        contacto_comercial_email: "ana@proveedor.test",
      },
    });
    expect(r.status()).toBe(201);
    const { proveedor } = await r.json();

    await page.evaluate(() => localStorage.removeItem("vista-proveedores"));
    await page.goto("/inicio#/proveedores");
    const tarjeta = page.locator(".prov-tarjeta", { hasText: proveedor.razon_social });
    await expect(tarjeta).toBeVisible();
    await expect(tarjeta).toContainText("Ana Compras");
    await expect(tarjeta).toContainText("Ninguna todavía");
    await expect(tarjeta.locator(".pill", { hasText: "Sin calificación" })).toBeVisible();
    await page.screenshot({ path: "test-results/proveedores-tarjetas.png", fullPage: true });

    // La vista de tabla sigue disponible
    await page
      .getByRole("group", { name: "Forma de ver la lista" })
      .getByRole("button", { name: "Tabla" })
      .click();
    await expect(page.locator("table", { hasText: proveedor.razon_social })).toBeVisible();
    await page.evaluate(() => localStorage.removeItem("vista-proveedores"));
  });

  test("con Atrás del navegador la ventana de nueva tarea se cierra", async ({ page }) => {
    const errores = [];
    page.on("pageerror", (error) => errores.push(String(error)));
    await iniciarSesionComo(page, USUARIO_PRINCIPAL, PASSWORD);
    await expect(page.getByRole("heading", { name: "Hola, QA" })).toBeVisible();

    await page.getByRole("button", { name: "+ Nueva tarea" }).click();
    const ventana = page.getByRole("dialog", { name: "Nueva tarea" });
    await expect(ventana).toBeVisible();

    await page.goBack();
    // Vuelve al inicio (tras iniciar sesión la dirección es /inicio, sin #/inicio).
    await expect(page).toHaveURL(/\/inicio(#\/inicio)?$/);
    await expect(ventana).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Hola, QA" })).toBeVisible();
    expect(errores).toEqual([]);
  });
});
