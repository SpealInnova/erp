const { formatearCodigoPry } = require("../../src/dominio/codigoProyecto");

describe("codigoProyecto", () => {
  test("rellena el consecutivo con ceros a la izquierda hasta 3 dígitos", () => {
    expect(formatearCodigoPry(2026, 1)).toBe("PRY-2026-001");
    expect(formatearCodigoPry(2026, 42)).toBe("PRY-2026-042");
  });

  test("no trunca si el consecutivo ya tiene 3 o más dígitos", () => {
    expect(formatearCodigoPry(2026, 123)).toBe("PRY-2026-123");
    expect(formatearCodigoPry(2026, 1234)).toBe("PRY-2026-1234");
  });
});
