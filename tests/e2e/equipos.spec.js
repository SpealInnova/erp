const { test, expect } = require("@playwright/test");
const { PASSWORD, USUARIO_PRINCIPAL } = require("./fixtures");
const { iniciarSesionComo, responderProximoDialogo } = require("./helpers");

test.describe("Equipos y reportes de servicio", () => {
  test("registra un equipo histórico y le hace un reporte que queda en su proyecto", async ({
    page,
  }) => {
    const sufijo = Date.now().toString().slice(-8);
    const serie = `E2E-SN-${sufijo}`;
    await iniciarSesionComo(page, USUARIO_PRINCIPAL, PASSWORD);

    const token = await page.evaluate(() => sessionStorage.getItem("erp_token"));
    const encabezados = { Authorization: `Bearer ${token}` };
    const crear = async (ruta, data) => {
      const respuesta = await page.request.post(ruta, { headers: encabezados, data });
      expect(respuesta.status(), `${ruta}: ${await respuesta.text()}`).toBe(201);
      return respuesta.json();
    };
    const perfil = await (await page.request.get("/auth/perfil", { headers: encabezados })).json();
    const { cliente } = await crear("/clientes", {
      nombre_razon_social: `E2E Equipos Cliente ${sufijo}`,
      tipo_identificacion: "NIT",
      numero_identificacion: `E2E-EQ-${sufijo}`,
    });
    const { proyecto } = await crear("/proyectos", {
      cliente_id: cliente.id,
      responsable_id: perfil.usuario.id,
      nombre_proyecto: `E2E Equipos Proyecto ${sufijo}`,
    });

    // registrar el equipo histórico desde la pestaña Equipos de Soporte técnico
    await page.goto("/inicio#/equipos/nuevo");
    await expect(page.locator("#subtabs").getByRole("link", { name: "Equipos" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    await page.fill("#numero_serie", serie);
    await page.fill("#descripcion", "Concentrador instalado antes del ERP");
    await page.selectOption("#cliente_id", String(cliente.id));
    await page.selectOption("#proyecto_id", String(proyecto.id));
    const confirmado = responderProximoDialogo(page, true);
    await page.click('button:has-text("Registrar equipo")');
    await confirmado;
    await expect(page.getByRole("heading", { name: `Equipo ${serie}` })).toBeVisible();

    // desde su ficha, nuevo reporte: cliente y proyecto se completan solos
    await page.getByRole("button", { name: "Nuevo reporte para este equipo" }).click();
    await expect(page).toHaveURL(/#\/reportes-servicio\/nuevo$/);
    await expect(page.locator("#equipo_numero_serie")).toHaveValue(serie);
    await expect(page.locator("#cliente_id")).toHaveValue(String(cliente.id));
    await expect(page.locator("#proyecto_id")).toHaveValue(String(proyecto.id));
    await page.selectOption("#tipo_servicio", "mantenimiento_correctivo");
    const confirmadoReporte = responderProximoDialogo(page, true);
    await page.click('button:has-text("Crear reporte")');
    await confirmadoReporte;
    await expect(page).toHaveURL(/#\/reportes-servicio$/);

    const fila = page.locator("tr", { hasText: serie });
    await expect(fila).toContainText(proyecto.codigo_pry);
    await expect(fila).toContainText(/RST-\d{4}-\d{3}/);

    // el reporte ya creado admite evidencias (fotos y PDF a Drive)
    await fila.getByRole("button", { name: `Editar reporte de ${serie}` }).click();
    await expect(page).toHaveURL(/#\/reportes-servicio\/\d+$/);
    await expect(page.getByRole("heading", { name: "Evidencias del servicio" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Subir evidencia" })).toBeVisible();

    // parámetros de funcionamiento: se cargan los 7 del formato FO-ST-005
    const parametros = page.locator(".tarjeta-ancha", {
      has: page.getByRole("heading", { name: "Parámetros de funcionamiento" }),
    });
    const cargarFormato = parametros.getByRole("button", {
      name: "Cargar parámetros del formato (FO-ST-005)",
    });
    await cargarFormato.click();
    await expect(parametros.locator("tbody tr")).toHaveCount(7);
    await expect(cargarFormato).toBeHidden();
    // la primera fila es la presión (orden del formato); al editarla su texto
    // pasa a un campo, así que se ubica por posición y no por texto
    const presion = parametros.locator("tbody tr").first();
    await expect(presion).toContainText("Presión manométrica");
    await presion.getByRole("button", { name: "Editar" }).click();
    await presion.getByLabel("Valor medido").fill("52");
    await presion.getByLabel("Valor esperado").fill("50");
    await presion.getByRole("button", { name: "Guardar" }).click();
    await expect(parametros.locator("tbody tr", { hasText: "Presión manométrica" })).toContainText(
      "52"
    );
    await page.screenshot({ path: "test-results/reporte-parametros.png", fullPage: true });
  });
});
