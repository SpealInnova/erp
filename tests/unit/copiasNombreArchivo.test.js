const { nombreArchivo } = require("../../src/servicios/copiasSeguridad");

describe("nombreArchivo de la copia de seguridad", () => {
  test("usa la fecha y la hora de Colombia, no la del servidor", () => {
    // 08:05 UTC = 03:05 en Colombia.
    expect(nombreArchivo("erp_prod", new Date("2026-11-24T08:05:00Z"))).toBe(
      "copia-erp-erp_prod-2026-11-24_0305.sql.gz"
    );
  });

  test("cerca de medianoche UTC sigue siendo el día anterior en Colombia", () => {
    // 03:30 UTC del 24 = 22:30 del 23 en Colombia.
    expect(nombreArchivo("erp_prod", new Date("2026-11-24T03:30:00Z"))).toBe(
      "copia-erp-erp_prod-2026-11-23_2230.sql.gz"
    );
  });
});
