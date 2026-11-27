const { test, expect } = require("@playwright/test");
const { PASSWORD, USUARIO_PRINCIPAL, USUARIO_COLEGA } = require("./fixtures");
const { iniciarSesionComo } = require("./helpers");

test("se asignan y se quitan varios responsables de una etapa desde la ficha", async ({ page }) => {
  const errores = [];
  page.on("pageerror", (error) => errores.push(String(error)));
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
    nombre_razon_social: `E2E Etapas Cliente ${sufijo}`,
    tipo_identificacion: "NIT",
    numero_identificacion: `E2E-ET-${sufijo}`,
  });
  const { proyecto } = await crear("/proyectos", {
    cliente_id: cliente.id,
    responsable_id: perfil.usuario.id,
    nombre_proyecto: `E2E Etapas Proyecto ${sufijo}`,
  });

  await page.goto(`/inicio#/proyectos/${proyecto.id}`);
  const fase = page.locator("details.fase-actividades", {
    has: page.locator("summary", { hasText: "Diseño" }),
  });
  await fase.locator("summary").click();
  const fila = fase.locator(".responsables-etapa");
  await expect(fila).toContainText("sin asignar");

  // dos responsables en Diseño
  const selector = fila.getByLabel("Asignar responsable de Diseño");
  await selector.selectOption({ label: USUARIO_COLEGA.nombre });
  await fila.getByRole("button", { name: "Asignar" }).click();
  await expect(fila.locator(".chip-responsable")).toHaveCount(1);
  await fila.getByLabel("Asignar responsable de Diseño").selectOption({
    label: USUARIO_PRINCIPAL.nombre,
  });
  await fila.getByRole("button", { name: "Asignar" }).click();
  await expect(fila.locator(".chip-responsable")).toHaveCount(2);
  await expect(fase.locator("summary")).toContainText(USUARIO_COLEGA.nombre);
  await expect(fase.locator("summary")).toContainText(USUARIO_PRINCIPAL.nombre);
  await page.screenshot({ path: "test-results/fase-responsables.png", fullPage: true });

  // se quita a uno
  await fila
    .getByRole("button", { name: `Quitar a ${USUARIO_COLEGA.nombre} como responsable de Diseño` })
    .click();
  await expect(fila.locator(".chip-responsable")).toHaveCount(1);
  await expect(fila.locator(".chip-responsable")).toContainText(USUARIO_PRINCIPAL.nombre);

  // y se ve en el resumen por etapa
  await page.getByRole("tab", { name: "Resumen por etapa" }).click();
  await page.locator(".etapa-tarjeta", { hasText: "Diseño" }).click();
  await expect(page.locator(".etapa-responsables")).toHaveText(
    `Responsable: ${USUARIO_PRINCIPAL.nombre}`
  );
  expect(errores).toEqual([]);
});
