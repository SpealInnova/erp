const { test, expect } = require("@playwright/test");
const { PASSWORD, USUARIO_PRINCIPAL } = require("./fixtures");
const { iniciarSesionComo, responderProximoDialogo } = require("./helpers");

test.describe("Tablero gerencial y navegación por módulos", () => {
  test("se abre desde el menú (cargos directivos) y pinta indicadores y gráficas sin errores", async ({
    page,
  }) => {
    const errores = [];
    page.on("pageerror", (error) => errores.push(String(error)));

    await iniciarSesionComo(page, USUARIO_PRINCIPAL, PASSWORD);

    // El inicio es el tablero general; el gerencial está en el menú.
    await expect(page.locator('.menu a[data-modulo="inicio"]')).toHaveAttribute(
      "aria-current",
      "page"
    );
    await page.locator('.menu a[data-modulo="tablero"]').click();
    await expect(page).toHaveURL(/#\/tablero$/);
    await expect(page.getByRole("heading", { name: "Tablero gerencial" })).toBeVisible();
    await expect(page.locator('.menu a[data-modulo="tablero"]')).toHaveAttribute(
      "aria-current",
      "page"
    );
    await expect(page.locator(".tablero .kpi")).toHaveCount(6);
    // cada gráfica muestra sus columnas o, si no hay datos, un aviso de vacío
    for (const [id, columnas] of [
      ["#tb-fases", 9],
      ["#tb-cot", 6],
    ]) {
      const vacia = await page.locator(`${id} .vacio`).count();
      if (!vacia) await expect(page.locator(`${id} .cg`)).toHaveCount(columnas);
    }
    await expect(page.locator("#tb-cartera .pg, #tb-cartera .vacio").first()).toBeVisible();
    await expect(page.locator("#subtabs")).toBeHidden();

    await page.screenshot({ path: "test-results/tablero-gerencial.png", fullPage: true });
    expect(errores).toEqual([]);
  });

  test("agrupa las entidades de cada módulo en pestañas horizontales", async ({ page }) => {
    await iniciarSesionComo(page, USUARIO_PRINCIPAL, PASSWORD);

    await page.goto("/inicio#/clientes");
    await expect(page.locator('.menu a[data-modulo="comercial"]')).toHaveAttribute(
      "aria-current",
      "page"
    );
    const pestanas = page.locator("#subtabs");
    await expect(pestanas).toBeVisible();
    await expect(pestanas.getByRole("link", { name: "Clientes" })).toHaveAttribute(
      "aria-current",
      "page"
    );

    await pestanas.getByRole("link", { name: "Cotizaciones" }).click();
    await expect(page).toHaveURL(/#\/cotizaciones$/);
    await expect(pestanas.getByRole("link", { name: "Cotizaciones" })).toHaveAttribute(
      "aria-current",
      "page"
    );

    await page.goto("/inicio#/ordenes-compra");
    await expect(page.locator('.menu a[data-modulo="compras"]')).toHaveAttribute(
      "aria-current",
      "page"
    );
    await expect(pestanas.getByRole("link")).toHaveCount(4);

    await page.goto("/inicio#/proyectos");
    await expect(pestanas).toBeHidden();
  });

  test("los resúmenes de Comercial y Compras se abren desde el menú", async ({ page }) => {
    const errores = [];
    page.on("pageerror", (error) => errores.push(String(error)));
    await iniciarSesionComo(page, USUARIO_PRINCIPAL, PASSWORD);
    const pestanas = page.locator("#subtabs");

    await page.locator('.menu a[data-modulo="comercial"]').click();
    await expect(page).toHaveURL(/#\/comercial$/);
    await expect(page.getByRole("heading", { name: "Comercial", level: 1 })).toBeVisible();
    await expect(pestanas.getByRole("link", { name: "Resumen" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    await expect(page.locator(".tablero .kpi")).toHaveCount(6);
    await expect(page.locator("#cm-embudo .kcol")).toHaveCount(6);
    await expect(page.locator("#cm-tabla thead th")).toHaveCount(8);
    await page.screenshot({ path: "test-results/tablero-comercial.png", fullPage: true });

    await page.locator('.menu a[data-modulo="compras"]').click();
    await expect(page).toHaveURL(/#\/compras$/);
    await expect(page.getByRole("heading", { name: "Compras", level: 1 })).toBeVisible();
    await expect(page.locator(".tablero .kpi")).toHaveCount(6);
    await expect(page.locator("#cp-flujo .fnode")).toHaveCount(6);
    await page.screenshot({ path: "test-results/tablero-compras.png", fullPage: true });

    expect(errores).toEqual([]);
  });

  test("los resúmenes de Diseño, Soporte y Entregas se abren desde el menú", async ({ page }) => {
    const errores = [];
    page.on("pageerror", (error) => errores.push(String(error)));
    await iniciarSesionComo(page, USUARIO_PRINCIPAL, PASSWORD);
    const pestanas = page.locator("#subtabs");
    const modulos = [
      { modulo: "diseno", titulo: "Diseño I+D+i", kpis: 4, pestanas: 2, tabla: "#ds-pendientes" },
      // Resumen, Reportes de servicio, Equipos y Listado maestro
      { modulo: "soporte", titulo: "Soporte técnico", kpis: 5, pestanas: 4, tabla: "#st-ultimos" },
      {
        modulo: "entregas",
        titulo: "Entregas y cierre",
        kpis: 5,
        pestanas: 3,
        tabla: "#en-pendientes",
      },
    ];
    for (const m of modulos) {
      await page.locator(`.menu a[data-modulo="${m.modulo}"]`).click();
      await expect(page).toHaveURL(new RegExp(`#/${m.modulo}$`));
      await expect(page.getByRole("heading", { name: m.titulo, level: 1 })).toBeVisible();
      await expect(pestanas.getByRole("link")).toHaveCount(m.pestanas);
      await expect(pestanas.getByRole("link", { name: "Resumen" })).toHaveAttribute(
        "aria-current",
        "page"
      );
      await expect(page.locator(".tablero .kpi")).toHaveCount(m.kpis);
      await expect(page.locator(`${m.tabla} thead th`).first()).toBeVisible();
      await page.screenshot({ path: `test-results/tablero-${m.modulo}.png`, fullPage: true });
    }

    // la pestaña de la lista sigue llevando a su módulo
    await pestanas.getByRole("link", { name: "Actas de entrega" }).click();
    await expect(page).toHaveURL(/#\/actas-entrega$/);
    await expect(page.locator('.menu a[data-modulo="entregas"]')).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(errores).toEqual([]);
  });

  test("aprueba una orden de compra desde la lista de pendientes", async ({ page }) => {
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
      nombre_razon_social: `E2E Tablero Cliente ${sufijo}`,
      tipo_identificacion: "NIT",
      numero_identificacion: `E2E-TB-${sufijo}`,
    });
    const { proyecto } = await crear("/proyectos", {
      cliente_id: cliente.id,
      responsable_id: perfil.usuario.id,
      nombre_proyecto: `E2E Tablero Proyecto ${sufijo}`,
    });
    const { proveedor } = await crear("/proveedores", {
      nit_cc: `E2E-TB-${sufijo}`,
      razon_social: `E2E Tablero Proveedor ${sufijo}`,
      tipo_persona: "juridica",
      origen: "nacional",
      clasificacion: "productos",
    });
    const { requisicion } = await crear("/requisiciones", {
      numero_requisicion: `E2E-REQ-${sufijo}`,
      proyecto_id: proyecto.id,
      procedencia: "nacional",
      items: [{ descripcion: "Válvula de alivio", cantidad: 2, unidad: "und" }],
    });
    const { orden } = await crear("/ordenes-compra", {
      requisicion_id: requisicion.id,
      proveedor_id: proveedor.id,
      items: [{ descripcion: "Válvula de alivio", cantidad: 2, precio_unitario: 850000 }],
    });

    await page.goto("/inicio#/tablero");
    await page.getByRole("button", { name: "Actualizar" }).click();
    const pendiente = page.locator(".ap", { hasText: orden.numero_oc });
    await expect(pendiente).toBeVisible();
    await expect(pendiente).toContainText("Válvula de alivio");

    const confirmado = responderProximoDialogo(page, true);
    await pendiente.getByRole("button", { name: "Aprobar" }).click();
    await confirmado;
    await expect(pendiente).toHaveClass(/done/);

    const verificada = await page.request.get(`/ordenes-compra/${orden.id}`, {
      headers: encabezados,
    });
    expect((await verificada.json()).orden.estado).toBe("aprobada_pte_pago");
  });
});
