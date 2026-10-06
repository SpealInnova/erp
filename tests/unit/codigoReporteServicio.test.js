const { formatearCodigoRST } = require("../../src/dominio/codigoReporteServicio");

describe("codigoReporteServicio", () => {
  test("rellena el consecutivo con ceros a la izquierda hasta 3 dígitos", () => {
    expect(formatearCodigoRST(2026, 1)).toBe("RST-2026-001");
    expect(formatearCodigoRST(2026, 9)).toBe("RST-2026-009");
  });
});
