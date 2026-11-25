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
    // los documentos viven en su pestaña, en el orden del flujo
    await page.getByRole("tab", { name: "Documentos" }).click();
    const seccion = page.locator(".docs-proyecto");
    await expect(seccion.getByRole("heading", { name: "Documentos del proyecto" })).toBeVisible();
    await expect(seccion.locator(".docs-col")).toHaveCount(7);

    const columnaRequisiciones = seccion.locator(".docs-col", { hasText: "Requisiciones" });
    await expect(columnaRequisiciones.locator(".docs-cantidad")).toHaveText("1");
    const enlace = columnaRequisiciones.getByRole("link", {
      name: new RegExp(requisicion.numero_requisicion),
    });
    await expect(enlace).toBeVisible();
    // cada paso que se puede crear desde aquí trae el proyecto ya elegido
    await expect(
      seccion.getByRole("link", { name: "Crear actas de entrega para este proyecto" })
    ).toHaveAttribute("href", `#/actas-entrega/nuevo?proyecto=${proyecto.id}`);

    // la línea de tiempo (en su pestaña) también registra la requisición, con enlace
    await page.getByRole("tab", { name: "Línea de tiempo" }).click();
    await expect(
      page.getByRole("link", { name: `Requisición ${requisicion.numero_requisicion} creada` })
    ).toBeVisible();
    await page.getByRole("tab", { name: "Documentos" }).click();

    await page.screenshot({ path: "test-results/proyecto-documentos.png", fullPage: true });

    await enlace.click();
    await expect(page).toHaveURL(new RegExp(`#/requisiciones/${requisicion.id}$`));
  });

  test("la ficha tiene cinco pestañas y desde Documentos se crea un acta ya enlazada", async ({
    page,
  }) => {
    const sufijo = Date.now().toString().slice(-8);
    await iniciarSesionComo(page, USUARIO_PRINCIPAL, PASSWORD);
    const token = await page.evaluate(() => sessionStorage.getItem("erp_token"));
    const encabezados = { Authorization: `Bearer ${token}` };
    const perfil = await (await page.request.get("/auth/perfil", { headers: encabezados })).json();
    const { cliente } = await (
      await page.request.post("/clientes", {
        headers: encabezados,
        data: {
          nombre_razon_social: `E2E Ficha Cliente ${sufijo}`,
          tipo_identificacion: "NIT",
          numero_identificacion: `E2E-FICHA-${sufijo}`,
        },
      })
    ).json();
    const { proyecto } = await (
      await page.request.post("/proyectos", {
        headers: encabezados,
        data: {
          cliente_id: cliente.id,
          responsable_id: perfil.usuario.id,
          nombre_proyecto: `E2E Ficha Proyecto ${sufijo}`,
        },
      })
    ).json();

    await page.goto(`/inicio#/proyectos/${proyecto.id}`);
    await expect(page.locator(".ficha-cod")).toHaveText(`${proyecto.codigo_pry} · v1`);
    await expect(
      page.getByRole("heading", { name: `E2E Ficha Proyecto ${sufijo}`, level: 2 })
    ).toBeVisible();
    const nombres = await page.getByRole("tab").allTextContents();
    expect(nombres).toEqual([
      "Actividades",
      "Resumen por etapa",
      "Línea de tiempo",
      "Documentos",
      "Datos y versiones",
    ]);
    await expect(page.getByRole("tab", { name: "Actividades" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(page.locator("#nueva_fase")).toBeVisible();

    await page.getByRole("tab", { name: "Datos y versiones" }).click();
    await expect(page.locator("#nombre_proyecto")).toBeVisible();
    await expect(page.locator(".panel-versiones")).toBeVisible();

    // "Elegir cotización" (siguiente paso) abre la pestaña donde está el campo
    await page.getByRole("tab", { name: "Actividades" }).click();
    await page.getByRole("button", { name: "Elegir cotización" }).click();
    await expect(page.getByRole("tab", { name: "Datos y versiones" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(page.locator("#cotizacion_id")).toBeFocused();

    await page.getByRole("tab", { name: "Documentos" }).click();
    await page.getByRole("link", { name: "Crear actas de entrega para este proyecto" }).click();
    await expect(page).toHaveURL(new RegExp(`#/actas-entrega/nuevo\\?proyecto=${proyecto.id}$`));
    await expect(page.locator("#proyecto_id")).toHaveValue(String(proyecto.id));
  });
});
