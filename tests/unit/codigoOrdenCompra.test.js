const { formatearCodigoOC } = require("../../src/dominio/codigoOrdenCompra");

describe("codigoOrdenCompra", () => {
  test("rellena el consecutivo con ceros a la izquierda hasta 3 dígitos", () => {
    expect(formatearCodigoOC(2026, 1)).toBe("OC-2026-001");
    expect(formatearCodigoOC(2026, 8)).toBe("OC-2026-008");
  });
});
