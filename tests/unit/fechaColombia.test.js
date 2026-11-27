const { hoyEnColombia } = require("../../src/dominio/fechaColombia");

// Día local (del proceso) de una fecha, como "AAAA-MM-DD".
const dia = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

describe("hoyEnColombia", () => {
  test("entre las 7 p. m. y la medianoche de Colombia sigue siendo el mismo día", () => {
    // 03:00 UTC del 25 = 10:00 p. m. del 24 en Colombia
    expect(dia(hoyEnColombia(new Date("2026-11-25T03:00:00Z")))).toBe("2026-11-24");
  });

  test("desde la medianoche de Colombia ya es el día siguiente", () => {
    // 05:00 UTC del 25 = 00:00 del 25 en Colombia
    expect(dia(hoyEnColombia(new Date("2026-11-25T05:00:00Z")))).toBe("2026-11-25");
  });

  test("devuelve la medianoche local, comparable con las columnas DATE", () => {
    const hoy = hoyEnColombia(new Date("2026-11-25T15:30:00Z"));
    expect([hoy.getHours(), hoy.getMinutes(), hoy.getSeconds()]).toEqual([0, 0, 0]);
  });

  test("cambia de mes y de año según Colombia", () => {
    // 01:00 UTC del 1 de enero = 8:00 p. m. del 31 de diciembre en Colombia
    expect(dia(hoyEnColombia(new Date("2027-01-01T01:00:00Z")))).toBe("2026-12-31");
  });
});
