const { test, expect } = require("@playwright/test");
const { PASSWORD, USUARIO_PRINCIPAL } = require("./fixtures");
const { iniciarSesionComo } = require("./helpers");

test.describe("Bloqueo de eliminación y versiones", () => {
  test("un proyecto con documentos no se elimina: se corrige con una nueva versión y queda el historial", async ({
    page,
  }) => {
    const sufijo = Date.now().toString().slice(-8);
    const nombreOriginal = `E2E Versiones Proyecto ${sufijo}`;
    const nombreCorregido = `E2E Versiones Corregido ${sufijo}`;
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
      nombre_razon_social: `E2E Versiones Cliente ${sufijo}`,
      tipo_identificacion: "NIT",
      numero_identificacion: `E2E-VER-${sufijo}`,
    });
    const { proyecto } = await crear("/proyectos", {
      cliente_id: cliente.id,
      responsable_id: perfil.usuario.id,
      nombre_proyecto: nombreOriginal,
    });
    const { requisicion } = await crear("/requisiciones", {
      numero_requisicion: `E2E-RQV-${sufijo}`,
      proyecto_id: proyecto.id,
      procedencia: "nacional",
      items: [{ descripcion: "Tubería", cantidad: 3, unidad: "m" }],
    });

    // Eliminar desde la lista: aparece qué lo bloquea, con vista previa
    await page.goto("/inicio#/proyectos");
    await page.getByRole("button", { name: `Eliminar proyecto ${proyecto.codigo_pry}` }).click();
    const bloqueo = page.locator(".bloqueo-eliminacion");
    await expect(bloqueo).toContainText("no se puede eliminar");
    await expect(bloqueo.locator(".docs-col", { hasText: "Requisiciones" })).toContainText(
      requisicion.numero_requisicion
    );

    // Nueva versión con motivo
    await bloqueo.getByRole("button", { name: "Crear nueva versión" }).click();
    await expect(page).toHaveURL(new RegExp(`#/proyectos/${proyecto.id}/nueva-version$`));
    await page.fill("#nombre_proyecto", nombreCorregido);
    await page.click('button:has-text("Guardar como versión 2")');
    await expect(page.locator(".alerta.error")).toContainText("motivo");
    await page.fill("#motivo_version", "El nombre no coincidía con el contrato firmado");
    await page.click('button:has-text("Guardar como versión 2")');

    await expect(page).toHaveURL(new RegExp(`#/proyectos/${proyecto.id}$`));
    await expect(
      page.getByRole("heading", { name: `Proyecto ${proyecto.codigo_pry} · v2` })
    ).toBeVisible();
    const panel = page.locator(".panel-versiones");
    await expect(panel).toContainText("v1 reemplazada");
    await expect(panel).toContainText("El nombre no coincidía con el contrato firmado");
    await panel.getByRole("button", { name: "Ver la versión 1" }).click();
    await expect(panel.locator(".vista-version")).toContainText(nombreOriginal);
    await page.screenshot({ path: "test-results/versiones-proyecto.png", fullPage: true });
  });
});
