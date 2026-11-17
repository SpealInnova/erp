const { test, expect } = require("@playwright/test");
const { PASSWORD, USUARIO_PRINCIPAL, USUARIO_COLEGA } = require("./fixtures");
const { iniciarSesionComo } = require("./helpers");

// El colega es técnico: ve la OC pendiente pero no puede aprobarla, cambiarle
// el estado ni crear versiones. El servidor también se lo impide (403).
test("un cargo sin permisos ve los documentos pero no sus acciones restringidas", async ({
  page,
  browser,
}) => {
  const sufijo = Date.now().toString().slice(-8);
  await iniciarSesionComo(page, USUARIO_PRINCIPAL, PASSWORD);
  const tokenPrincipal = await page.evaluate(() => sessionStorage.getItem("erp_token"));
  const crear = async (ruta, data) => {
    const r = await page.request.post(ruta, {
      headers: { Authorization: `Bearer ${tokenPrincipal}` },
      data,
    });
    expect(r.status(), `${ruta}: ${await r.text()}`).toBe(201);
    return r.json();
  };
  const perfil = await (
    await page.request.get("/auth/perfil", {
      headers: { Authorization: `Bearer ${tokenPrincipal}` },
    })
  ).json();
  const { cliente } = await crear("/clientes", {
    nombre_razon_social: `E2E Permisos Cliente ${sufijo}`,
    tipo_identificacion: "NIT",
    numero_identificacion: `E2E-PE-${sufijo}`,
  });
  const { proyecto } = await crear("/proyectos", {
    cliente_id: cliente.id,
    responsable_id: perfil.usuario.id,
    nombre_proyecto: `E2E Permisos Proyecto ${sufijo}`,
  });
  const { proveedor } = await crear("/proveedores", {
    nit_cc: `E2E-PE-${sufijo}`,
    razon_social: `E2E Permisos Proveedor ${sufijo}`,
    tipo_persona: "juridica",
    origen: "nacional",
    clasificacion: "productos",
  });
  const { requisicion } = await crear("/requisiciones", {
    numero_requisicion: `E2E-PE-${sufijo}`,
    proyecto_id: proyecto.id,
    procedencia: "nacional",
    items: [{ descripcion: "Manómetro", cantidad: 1, unidad: "und" }],
  });
  const { orden } = await crear("/ordenes-compra", {
    requisicion_id: requisicion.id,
    proveedor_id: proveedor.id,
    items: [{ descripcion: "Manómetro", cantidad: 1, precio_unitario: 120000 }],
  });

  const contexto = await browser.newContext();
  const colega = await contexto.newPage();
  const errores = [];
  colega.on("pageerror", (e) => errores.push(String(e)));
  await iniciarSesionComo(colega, USUARIO_COLEGA, PASSWORD);

  // Tablero: la OC aparece con "Revisar", no con "Aprobar"
  await colega.getByRole("button", { name: "Actualizar" }).click();
  const pendiente = colega.locator(".ap", { hasText: orden.numero_oc });
  await expect(pendiente).toBeVisible();
  await expect(pendiente.getByRole("link", { name: "Revisar" })).toBeVisible();
  await expect(pendiente.getByRole("button", { name: "Aprobar" })).toHaveCount(0);

  // Ficha de la OC: sin selector de estado ni botón de nueva versión
  await colega.goto(`/inicio#/ordenes-compra/${orden.id}`);
  await expect(
    colega.getByText("La aprueba el Director Administrativo y Financiero")
  ).toBeVisible();
  await expect(colega.locator("#nuevo_estado")).toHaveCount(0);
  await expect(colega.getByText("Tu cargo no crea versiones de este documento")).toBeVisible();
  await expect(colega.getByRole("button", { name: "Crear nueva versión" })).toHaveCount(0);

  // Proyectos: sin botón de eliminar
  await colega.goto("/inicio#/proyectos");
  await expect(colega.getByRole("cell", { name: proyecto.codigo_pry, exact: true })).toBeVisible();
  await expect(
    colega.getByRole("button", { name: `Eliminar proyecto ${proyecto.codigo_pry}` })
  ).toHaveCount(0);

  // Y el servidor lo impide aunque se llame la API directamente
  const tokenColega = await colega.evaluate(() => sessionStorage.getItem("erp_token"));
  const intento = await colega.request.patch(`/ordenes-compra/${orden.id}/estado`, {
    headers: { Authorization: `Bearer ${tokenColega}` },
    data: { estado: "aprobada_pte_pago" },
  });
  expect(intento.status()).toBe(403);

  expect(errores).toEqual([]);
  await contexto.close();
});
