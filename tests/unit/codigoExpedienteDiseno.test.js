const { formatearCodigoExp } = require("../../src/dominio/codigoExpedienteDiseno");

describe("codigoExpedienteDiseno", () => {
  test("rellena el consecutivo con ceros a la izquierda hasta 3 dígitos", () => {
    expect(formatearCodigoExp(2026, 1)).toBe("EXP-2026-001");
    expect(formatearCodigoExp(2026, 15)).toBe("EXP-2026-015");
  });
});
