const { test, expect } = require("@playwright/test");
const { PASSWORD, USUARIO_PRINCIPAL } = require("./fixtures");
const { iniciarSesionComo } = require("./helpers");

// Crea cliente y proyecto, y lo pasa a Planeación: la fase trae sus
// actividades de plantilla, sin fechas (barras provisionales desde hoy).
async function proyectoEnPlaneacion(page, etiqueta) {
  const sufijo = Date.now().toString().slice(-8);
  const nombreCliente = `E2E Gantt ${etiqueta} Cliente ${sufijo}`;
  const nombreProyecto = `E2E Gantt ${etiqueta} Proyecto ${sufijo}`;

  await iniciarSesionComo(page, USUARIO_PRINCIPAL, PASSWORD);

  await page.goto("/inicio#/clientes/nuevo");
  await page.fill("#nombre_razon_social", nombreCliente);
  await page.selectOption("#tipo_identificacion", "NIT");
  await page.fill("#numero_identificacion", `E2E-GANTT-${etiqueta}-${sufijo}`);
  page.once("dialog", (dialog) => dialog.accept());
  await page.click('button:has-text("Crear cliente")');
  await page.waitForURL("**/inicio#/clientes");

  await page.goto("/inicio#/proyectos/nuevo");
  await page.selectOption("#cliente_id", { label: nombreCliente });
  await page.selectOption("#responsable_id", { label: USUARIO_PRINCIPAL.nombre });
  await page.fill("#nombre_proyecto", nombreProyecto);
  page.once("dialog", (dialog) => dialog.accept());
  await page.click('button:has-text("Crear proyecto")');
  await page.waitForURL("**/inicio#/proyectos");

  const fila = page.locator("tr", { hasText: nombreProyecto });
  await fila.getByRole("button", { name: /Ver proyecto/ }).click();

  await page.selectOption("#nueva_fase", "planeacion");
  await page.fill("#observacion_fase", "Aprobado por QA automatizado");
  await page.click('button:has-text("Actualizar fase")');

  // La fase más reciente con actividades es la que se abre.
  const gantt = page.locator("details[open] .gantt").first();
  await expect(gantt).toBeVisible();
  const proyectoId = page.url().match(/#\/proyectos\/(\d+)/)[1];
  return { gantt, proyectoId };
}

async function encabezadosApi(page) {
  const token = await page.evaluate(() => sessionStorage.getItem("erp_token"));
  return { Authorization: `Bearer ${token}` };
}

// Fecha local del navegador desplazada n días, en AAAA-MM-DD.
function fechaLocal(page, dias) {
  return page.evaluate((n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
  }, dias);
}

test.describe("Gantt de actividades", () => {
  test("ocupa todo el ancho, se comprime al sumar semanas y no muestra días pasados", async ({
    page,
  }) => {
    const { gantt } = await proyectoEnPlaneacion(page, "Ancho");

    const colorBarra = await gantt
      .locator(".gantt-barra")
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(colorBarra).toBe("rgb(201, 147, 10)"); // #c9930a, color de marca

    const lineaDia = await gantt
      .locator(".gantt-col")
      .nth(1)
      .evaluate((el) => parseFloat(getComputedStyle(el).borderLeftWidth));
    expect(lineaDia).toBeGreaterThanOrEqual(1);

    // Primera columna = hoy; "+ Días atrás" no puede ir antes.
    await expect(gantt.locator(".gantt-dia").first()).toHaveClass(/es-hoy/);
    await expect(page.getByRole("button", { name: "+ Días atrás" })).toBeDisabled();

    const medir = () =>
      gantt.evaluate((g) => ({
        dias: g.querySelectorAll(".gantt-dia").length,
        marco: g.querySelector(".gantt-marco").clientWidth,
        lienzo: g.querySelector(".gantt-lienzo").scrollWidth,
        columna: g.querySelector(".gantt-dia").getBoundingClientRect().width,
        // Ningún texto del encabezado se sale de su celda (antes se pisaban).
        desbordados: [...g.querySelectorAll(".gantt-mes, .gantt-semana")].filter(
          (c) => c.scrollWidth > c.clientWidth + 1
        ).length,
      }));

    const antes = await medir();
    expect(antes.lienzo).toBe(antes.marco); // todo el ancho, sin desplazamiento
    expect(antes.desbordados).toBe(0);

    // Mes en una sola línea; debajo, las semanas.
    await expect(gantt.locator(".gantt-mes").first()).toHaveAttribute(
      "title",
      /^(Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre) \d{4}$/
    );
    await expect(gantt.locator(".gantt-semana").first()).toHaveAttribute("title", /^Semana \d$/);

    const adelante = page.getByRole("button", { name: "+ Días adelante" });
    await adelante.click();
    const despues = await medir();
    expect(despues.dias).toBe(antes.dias + 7);
    expect(despues.columna).toBeLessThan(antes.columna); // se comprime
    expect(despues.lienzo).toBe(despues.marco);
    expect(despues.desbordados).toBe(0);

    // Con columnas estrechas, los días se escriben en vertical.
    for (let i = 0; i < 8 && (await gantt.getAttribute("data-dias")) !== "vertical"; i++) {
      await adelante.click();
    }
    await expect(gantt).toHaveAttribute("data-dias", "vertical");
    const escritura = await gantt
      .locator(".gantt-dia span")
      .first()
      .evaluate((el) => getComputedStyle(el).writingMode);
    expect(escritura).toBe("vertical-rl");
    expect((await medir()).desbordados).toBe(0);

    await page.screenshot({ path: "test-results/gantt-vista.png", fullPage: true });
  });

  test("no rompe el encabezado cuando una actividad ya tiene fecha guardada", async ({ page }) => {
    const { proyectoId } = await proyectoEnPlaneacion(page, "Fecha");
    const headers = await encabezadosApi(page);

    const listado = await page.request.get(`/proyectos/${proyectoId}/actividades`, { headers });
    const { actividades } = await listado.json();

    // Una actividad con fechas reales (una de ellas antes de hoy).
    const guardado = await page.request.put(
      `/proyectos/${proyectoId}/actividades/${actividades[0].id}`,
      { headers, data: { fecha_inicio: "2026-11-08", fecha_fin: "2026-11-10" } }
    );
    expect(guardado.ok()).toBe(true);

    await page.reload();
    const gantt = page.locator("details[open] .gantt").first();
    await expect(gantt).toBeVisible();

    const textoCompleto = await gantt.evaluate((el) => el.textContent);
    expect(textoCompleto).not.toContain("NaN");
    expect(textoCompleto).not.toContain("undefined");
    expect(await gantt.locator(".gantt-dia").count()).toBeGreaterThan(0);

    const columnas = await gantt
      .locator(".gantt-barra")
      .evaluateAll((barras) => barras.map((b) => b.style.gridColumn));
    columnas.forEach((c) => expect(c).toMatch(/^\d+ \/ \d+$/));

    await page.screenshot({ path: "test-results/gantt-encabezado.png", fullPage: true });
  });

  test("clic en la barra muestra el resumen y el engranaje gestiona la actividad", async ({
    page,
  }) => {
    const { gantt, proyectoId } = await proyectoEnPlaneacion(page, "Gestion");
    const seccion = page.locator(".tarjeta-ancha", { hasText: "Actividades por fase" }).last();

    // La tabla de actividades y las subactividades ya no aparecen.
    await expect(seccion.locator("table")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "+ Agregar subactividad" })).toHaveCount(0);

    const headers = await encabezadosApi(page);
    const { actividades } = await (
      await page.request.get(`/proyectos/${proyectoId}/actividades`, { headers })
    ).json();
    const primera = actividades.find((a) => a.fase === "planeacion");
    const totalBarras = await gantt.locator(".gantt-barra").count();

    // Resumen
    await gantt.locator(".gantt-barra").first().click();
    const popup = page.locator(".gantt-popup");
    await expect(popup).toBeVisible();
    await expect(popup.getByRole("heading", { name: primera.descripcion })).toBeVisible();
    await expect(popup).toContainText("Pendiente");
    await expect(popup).toContainText("Sin asignar");

    // Engranaje → ventana de gestión
    await popup.getByRole("button", { name: "Gestionar actividad" }).click();
    const dialogo = page.getByRole("dialog", { name: primera.descripcion });
    await expect(dialogo).toBeVisible();
    await expect(dialogo.getByRole("heading", { name: "Evidencias" })).toBeVisible();
    await expect(dialogo).toContainText("Aún no hay evidencias cargadas.");

    const inicio = await fechaLocal(page, 1);
    const fin = await fechaLocal(page, 3);
    await dialogo.getByLabel("Responsable").selectOption({ label: USUARIO_PRINCIPAL.nombre });
    await dialogo.getByLabel("Estado", { exact: true }).selectOption("completada");
    await dialogo.getByLabel("Fecha de inicio").fill(inicio);
    await dialogo.getByLabel("Fecha de fin").fill(fin);
    await dialogo.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.locator("dialog[open]")).toHaveCount(0);

    const barra = gantt.locator(`.gantt-barra[data-actividad-id="${primera.id}"]`);
    await expect(barra).toHaveClass(/gantt-barra--completada/);
    await expect(seccion.locator("details[open] > summary")).toContainText(`1/${totalBarras}`);

    const guardada = (
      await (await page.request.get(`/proyectos/${proyectoId}/actividades`, { headers })).json()
    ).actividades.find((a) => a.id === primera.id);
    expect(guardada.estado).toBe("completada");
    expect(String(guardada.fecha_inicio).slice(0, 10)).toBe(inicio);
    expect(String(guardada.fecha_fin).slice(0, 10)).toBe(fin);
    expect(guardada.responsable_id).not.toBeNull();

    await barra.click();
    await expect(popup).toContainText(USUARIO_PRINCIPAL.nombre);
    await expect(popup).toContainText("Completada");

    // Quitar la actividad desde la ventana
    await popup.getByRole("button", { name: "Gestionar actividad" }).click();
    page.once("dialog", (d) => d.accept());
    await page.locator("dialog[open]").getByRole("button", { name: "Quitar actividad" }).click();
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await expect(gantt.locator(".gantt-barra")).toHaveCount(totalBarras - 1);
  });

  test("arrastrar una barra mueve sus fechas", async ({ page }) => {
    const { gantt, proyectoId } = await proyectoEnPlaneacion(page, "Arrastre");
    const headers = await encabezadosApi(page);

    // La segunda barra es provisional: hoy+1 a hoy+2. Se mueve dos días.
    const barra = gantt.locator(".gantt-barra").nth(1);
    const id = await barra.getAttribute("data-actividad-id");
    await barra.scrollIntoViewIfNeeded();
    const caja = await barra.boundingBox();
    const columna = await gantt
      .locator(".gantt-dia")
      .first()
      .evaluate((el) => el.getBoundingClientRect().width);

    const y = caja.y + caja.height / 2;
    const x = caja.x + caja.width / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + columna, y, { steps: 4 });
    await page.mouse.move(x + columna * 2, y, { steps: 4 });
    await page.mouse.up();

    const esperadoInicio = await fechaLocal(page, 3);
    const esperadoFin = await fechaLocal(page, 4);
    await expect
      .poll(async () => {
        const { actividades } = await (
          await page.request.get(`/proyectos/${proyectoId}/actividades`, { headers })
        ).json();
        const a = actividades.find((x2) => String(x2.id) === id);
        return [String(a.fecha_inicio).slice(0, 10), String(a.fecha_fin).slice(0, 10)];
      })
      .toEqual([esperadoInicio, esperadoFin]);

    // Soltar no abre la tarjeta de resumen.
    await expect(page.locator(".gantt-popup")).toHaveCount(0);
  });
});
