const { test, expect } = require("@playwright/test");
const { PASSWORD, USUARIO_PRINCIPAL } = require("./fixtures");
const { iniciarSesionComo } = require("./helpers");

// Las listas ya no se quedan en los 20 más recientes: se busca, se pagina, y
// la búsqueda y la página se conservan al volver de una ficha.
test("busca y pagina una lista, y conserva la página al volver de una ficha", async ({ page }) => {
  const errores = [];
  page.on("pageerror", (e) => errores.push(String(e)));
  const marca = `E2E Lista ${Date.now().toString().slice(-8)}`;
  await iniciarSesionComo(page, USUARIO_PRINCIPAL, PASSWORD);
  const token = await page.evaluate(() => sessionStorage.getItem("erp_token"));
  for (let i = 1; i <= 22; i += 1) {
    const r = await page.request.post("/clientes", {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        nombre_razon_social: `${marca} ${String(i).padStart(2, "0")}`,
        tipo_identificacion: "NIT",
        numero_identificacion: `${marca.replace(/\D/g, "")}-${i}`,
      },
    });
    expect(r.status()).toBe(201);
  }

  await page.goto("/inicio#/clientes");
  const buscador = page.getByRole("searchbox", { name: "Buscar clientes" });
  await buscador.fill(marca);
  await expect(page.locator(".resumen-listado")).toHaveText("22 registros encontrados");
  await expect(page.locator(".resultados-listado tbody tr")).toHaveCount(20);

  const paginador = page.getByRole("navigation", { name: "Páginas de clientes" });
  await expect(paginador).toContainText("Página 1 de 2");
  await paginador.getByRole("button", { name: "Siguiente" }).click();
  await expect(paginador).toContainText("Página 2 de 2");
  await expect(page.locator(".resultados-listado tbody tr")).toHaveCount(2);
  // los más antiguos quedan en la segunda página
  await expect(page.getByRole("cell", { name: `${marca} 01`, exact: true })).toBeVisible();

  // abrir la ficha y volver conserva la búsqueda y la página
  await page.getByRole("button", { name: `Editar ${marca} 01` }).click();
  await expect(page).toHaveURL(/#\/clientes\/\d+$/);
  await expect(page.getByRole("heading", { name: "Editar cliente" })).toBeVisible();
  await page.goBack();
  await expect(buscador).toHaveValue(marca);
  await expect(paginador).toContainText("Página 2 de 2");

  // una búsqueda sin resultados lo dice
  await buscador.fill(`${marca} inexistente`);
  await expect(page.getByText("Ningún registro coincide con la búsqueda.")).toBeVisible();
  // con una sola página el paginador queda vacío (y oculto)
  await expect(page.locator(".paginador")).toBeEmpty();

  expect(errores).toEqual([]);
});
