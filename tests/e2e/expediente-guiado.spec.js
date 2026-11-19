const { test, expect } = require("@playwright/test");
const { PASSWORD, USUARIO_PRINCIPAL } = require("./fixtures");
const { iniciarSesionComo } = require("./helpers");

test("el expediente se llena por pasos, con listas, criterio automático y lo que falta para liberar", async ({
  page,
}) => {
  const sufijo = Date.now().toString().slice(-8);
  await iniciarSesionComo(page, USUARIO_PRINCIPAL, PASSWORD);
  const token = await page.evaluate(() => sessionStorage.getItem("erp_token"));
  const headers = { Authorization: `Bearer ${token}` };
  const crear = async (ruta, data) => {
    const r = await page.request.post(ruta, { headers, data });
    expect(r.status()).toBe(201);
    return r.json();
  };
  const { usuario } = await (await page.request.get("/auth/perfil", { headers })).json();
  const { cliente } = await crear("/clientes", {
    nombre_razon_social: `E2E Expediente Cliente ${sufijo}`,
    tipo_identificacion: "NIT",
    numero_identificacion: `E2E-EXP-${sufijo}`,
  });
  const { proyecto } = await crear("/proyectos", {
    cliente_id: cliente.id,
    responsable_id: usuario.id,
    nombre_proyecto: `E2E Expediente Proyecto ${sufijo}`,
  });
  const { expediente } = await crear("/expedientes-diseno", {
    proyecto_id: proyecto.id,
    producto_nombre: "Planta de prueba",
    responsable_diseno_id: usuario.id,
  });

  await page.goto(`/inicio#/expedientes-diseno/${expediente.id}`);
  const pasos = page.getByRole("navigation", { name: "Pasos del expediente" });
  await expect(pasos.getByRole("button")).toHaveCount(9);
  const siguiente = page.getByRole("region", { name: "Siguiente paso del expediente" });
  await expect(siguiente).toContainText("Registrar los requisitos de entrada");
  await expect(page.locator(".exp-lateral")).toContainText(`${proyecto.codigo_pry}`);

  // Paso 1: requisito con fuente de una lista
  await page.fill("#requisitos-entrada__requisito", "Caudal 5 L/s");
  await page.selectOption("#requisitos-entrada__fuente", "cliente");
  await page.fill("#requisitos-entrada__criterio_aceptacion", "Caudal ≥ 5 L/s por 30 min");
  await page.click('button:has-text("Agregar requisito")');
  await expect(page.locator(".exp-lateral .check")).toContainText("Requisitos de entrada (1)");
  await expect(page.locator(".tabla-items")).toContainText("Cliente");

  // Paso de verificación: el requisito se elige y su criterio se trae solo
  await pasos.getByRole("button", { name: /Paso 5: Verificaciones/ }).click();
  await expect(page.locator("#verificaciones__criterio")).toHaveValue("Caudal ≥ 5 L/s por 30 min");
  await page.selectOption("#verificaciones__metodo", "ensayo");
  await page.selectOption("#verificaciones__resultado", "conforme");
  await page.click('button:has-text("Agregar verificación")');
  await expect(page.locator(".exp-lateral .check")).toContainText(
    "1 de 1 requisitos verificados conformes"
  );
  await expect(pasos.locator(".exp-paso--ok")).toHaveCount(3); // requisitos, verificación, cambios

  // Riesgo con nivel calculado
  await pasos.getByRole("button", { name: /Paso 4: Riesgos/ }).click();
  await page.fill("#riesgos-diseno__peligro", "Sobrepresión");
  await page.selectOption("#riesgos-diseno__severidad", "4");
  await page.selectOption("#riesgos-diseno__probabilidad", "3");
  await page.click('button:has-text("Agregar riesgo")');
  await expect(page.locator(".tabla-items")).toContainText("12 · Alto");

  // Liberación: avisa lo que falta, sin bloquear
  await pasos.getByRole("button", { name: /Paso 9: Liberación/ }).click();
  await expect(page.locator(".exp-centro")).toContainText("Se puede liberar igual");
  await expect(page.locator("#nuevo_estado")).toBeVisible();

  await page.screenshot({ path: "test-results/expediente-guiado.png", fullPage: true });
});
