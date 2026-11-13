const { insertarConCodigoUnico, MAX_INTENTOS } = require("../../src/servicios/codigoUnico");

function errorDuplicado(indice) {
  const error = new Error(`Duplicate entry 'X' for key '${indice}'`);
  error.code = "ER_DUP_ENTRY";
  error.sqlMessage = error.message;
  return error;
}

describe("insertarConCodigoUnico", () => {
  test("si el código choca con otro creado al mismo tiempo, calcula otro y reintenta", async () => {
    const codigos = ["PRY-2026-001", "PRY-2026-002"];
    const generar = jest.fn(async () => codigos.shift());
    const insertar = jest
      .fn()
      .mockRejectedValueOnce(errorDuplicado("uq_proyectos_codigo_pry"))
      .mockResolvedValueOnce(42);

    await expect(
      insertarConCodigoUnico("uq_proyectos_codigo_pry", generar, insertar)
    ).resolves.toBe(42);
    expect(insertar).toHaveBeenNthCalledWith(2, "PRY-2026-002");
  });

  test("no reintenta si el duplicado es de otro índice (p. ej. número de serie)", async () => {
    const insertar = jest.fn().mockRejectedValue(errorDuplicado("uq_expedientes_numero_serie"));
    await expect(
      insertarConCodigoUnico("uq_expedientes_codigo", async () => "EXP-1", insertar)
    ).rejects.toThrow("uq_expedientes_numero_serie");
    expect(insertar).toHaveBeenCalledTimes(1);
  });

  test("se rinde después del máximo de intentos", async () => {
    const insertar = jest.fn().mockRejectedValue(errorDuplicado("uq_cotizaciones_numero"));
    await expect(
      insertarConCodigoUnico("uq_cotizaciones_numero", async () => "COT-1", insertar)
    ).rejects.toThrow();
    expect(insertar).toHaveBeenCalledTimes(MAX_INTENTOS);
  });
});
