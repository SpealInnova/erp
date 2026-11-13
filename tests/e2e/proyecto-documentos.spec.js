const { test, expect } = require("@playwright/test");
const { PASSWORD, USUARIO_PRINCIPAL } = require("./fixtures");
const { iniciarSesionComo } = require("./helpers");

test.describe("Documentos del proyecto", () => {
  test("la ficha muestra los documentos de los demás módulos y enlaza a cada uno", async ({
    page,
  }) => {
    const sufijo = Date.now().toString().slice(-8);
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
      nombre_razon_social: `E2E Docs Cliente ${sufijo}`,
      tipo_identificacion: "NIT",
      numero_identificacion: `E2E-DOCS-${sufijo}`,
    });
    const { proyecto } = await crear("/proyectos", {
      cliente_id: cliente.id,
      responsable_id: perfil.usuario.id,
      nombre_proyecto: `E2E Docs Proyecto ${sufijo}`,
    });
    const { requisicion } = await crear("/requisiciones", {
      numero_requisicion: `E2E-RQD-${sufijo}`,
      proyecto_id: proyecto.id,
      procedencia: "importacion",
      items: [{ descripcion: "Tamiz molecular", cantidad: 1, unidad: "kg" }],
    });

    await page.goto(`/inicio#/proyectos/${proyecto.id}`);
    const seccion = page.locator(".docs-proyecto");
    await expect(seccion.getByRole("heading", { name: "Documentos del proyecto" })).toBeVisible();
    await expect(seccion.locator(".docs-col")).toHaveCount(7);

    const columnaRequisiciones = seccion.locator(".docs-col", { hasText: "Requisiciones" });
    await expect(columnaRequisiciones.locator(".docs-cantidad")).toHaveText("1");
    const enlace = columnaRequisiciones.getByRole("link", {
      name: new RegExp(requisicion.numero_requisicion),
    });
    await expect(enlace).toBeVisible();

    // la línea de tiempo (en su pestaña) también registra la requisición, con enlace
    await page.getByRole("tab", { name: "Línea de tiempo" }).click();
    await expect(
      page.getByRole("link", { name: `Requisición ${requisicion.numero_requisicion} creada` })
    ).toBeVisible();
    await page.getByRole("tab", { name: "Proyecto" }).click();

    await page.screenshot({ path: "test-results/proyecto-documentos.png", fullPage: true });

    await enlace.click();
    await expect(page).toHaveURL(new RegExp(`#/requisiciones/${requisicion.id}$`));
  });
});
