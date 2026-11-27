const fs = require("fs");
const { test, expect } = require("@playwright/test");
const { PASSWORD, USUARIO_PRINCIPAL, USUARIO_COLEGA } = require("./fixtures");
const { iniciarSesionComo } = require("./helpers");

test("el listado maestro de servicios filtra y descarga el CSV", async ({ page }) => {
  const errores = [];
  page.on("pageerror", (error) => errores.push(String(error)));
  const sufijo = Date.now().toString().slice(-8);
  const serie = `E2E-LM-${sufijo}`;
  await iniciarSesionComo(page, USUARIO_PRINCIPAL, PASSWORD);

  const token = await page.evaluate(() => sessionStorage.getItem("erp_token"));
  const encabezados = { Authorization: `Bearer ${token}` };
  const crear = async (ruta, data) => {
    const respuesta = await page.request.post(ruta, { headers: encabezados, data });
    expect(respuesta.status(), `${ruta}: ${await respuesta.text()}`).toBe(201);
    return respuesta.json();
  };
  const perfil = await (await page.request.get("/auth/perfil", { headers: encabezados })).json();
  const { usuarios } = await (await page.request.get("/usuarios", { headers: encabezados })).json();
  const colega = usuarios.find((u) => u.correo === USUARIO_COLEGA.correo);
  const { cliente } = await crear("/clientes", {
    nombre_razon_social: `E2E Listado Cliente ${sufijo}`,
    tipo_identificacion: "NIT",
    numero_identificacion: `E2E-LM-${sufijo}`,
  });
  const { proyecto } = await crear("/proyectos", {
    cliente_id: cliente.id,
    responsable_id: perfil.usuario.id,
    nombre_proyecto: `E2E Listado Proyecto ${sufijo}`,
  });
  await crear("/equipos", {
    numero_serie: serie,
    descripcion: "Concentrador del listado",
    cliente_id: cliente.id,
    proyecto_id: proyecto.id,
  });
  const { reporte } = await crear("/reportes-servicio-tecnico", {
    equipo_numero_serie: serie,
    cliente_id: cliente.id,
    proyecto_id: proyecto.id,
    tipo_servicio: "garantia",
    en_garantia: true,
    tecnico_responsable_id: colega.id,
    fecha_servicio: "2026-06-15",
    hora_inicio: "08:00",
    hora_fin: "09:45",
  });

  // Soporte técnico → pestaña "Listado maestro"
  await page.goto("/inicio#/soporte");
  await page.locator("#subtabs").getByRole("link", { name: "Listado maestro" }).click();
  await expect(page).toHaveURL(/#\/listado-servicios$/);
  await expect(page.getByRole("heading", { name: "Listado maestro de servicios" })).toBeVisible();

  await page
    .getByRole("combobox", { name: "Cliente", exact: true })
    .selectOption(String(cliente.id));
  const filas = page.locator(".tabla-listado-maestro tbody tr");
  await expect(filas).toHaveCount(1);
  const fila = filas.first();
  await expect(fila).toContainText(reporte.numero_reporte);
  await expect(fila).toContainText(serie);
  await expect(fila).toContainText("Concentrador del listado");
  await expect(fila).toContainText("Garantía");
  await expect(fila).toContainText(USUARIO_COLEGA.nombre);
  await expect(fila).toContainText("1 h 45 min");
  await expect(page.locator(".resumen-listado")).toHaveText("1 servicio");

  // sin garantía no hay ninguno de este cliente
  await page.getByRole("combobox", { name: "Garantía" }).selectOption("no");
  await expect(filas.first()).toContainText("No hay servicios con estos filtros.");
  await page.getByRole("combobox", { name: "Garantía" }).selectOption("");
  await expect(filas.first()).toContainText(reporte.numero_reporte);

  // la descarga trae los mismos filtros
  const [descarga] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Descargar CSV (Excel)" }).click(),
  ]);
  expect(descarga.suggestedFilename()).toMatch(
    /^listado-maestro-servicios-\d{4}-\d{2}-\d{2}\.csv$/
  );
  const contenido = fs.readFileSync(await descarga.path(), "utf8");
  const lineas = contenido.replace("\uFEFF", "").trim().split("\r\n");
  expect(lineas).toHaveLength(2);
  expect(lineas[1]).toContain(`${reporte.numero_reporte};1;15/06/2026;`);
  expect(lineas[1]).toContain(`;Garantía;Sí;${USUARIO_COLEGA.nombre};08:00;09:45;105;`);

  // el número lleva al reporte
  await fila.getByRole("link", { name: reporte.numero_reporte }).click();
  await expect(page).toHaveURL(new RegExp(`#/reportes-servicio/${reporte.id}$`));
  await page.screenshot({ path: "test-results/listado-maestro.png", fullPage: true });
  expect(errores).toEqual([]);
});
