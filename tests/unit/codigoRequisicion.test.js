const { formatearCodigoReq } = require("../../src/dominio/codigoRequisicion");

describe("codigoRequisicion", () => {
  test("rellena el consecutivo con ceros a la izquierda hasta 3 dígitos", () => {
    expect(formatearCodigoReq(2026, 1)).toBe("REQ-2026-001");
    expect(formatearCodigoReq(2026, 23)).toBe("REQ-2026-023");
  });
});
