const { formatearCodigoCot } = require("../../src/dominio/codigoCotizacion");

describe("codigoCotizacion", () => {
  test("rellena el consecutivo con ceros a la izquierda hasta 3 dígitos", () => {
    expect(formatearCodigoCot(2026, 1)).toBe("COT-2026-001");
    expect(formatearCodigoCot(2026, 57)).toBe("COT-2026-057");
  });
});
