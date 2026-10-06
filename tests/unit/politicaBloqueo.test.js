const {
  LIMITE_INTENTOS,
  estaBloqueado,
  calcularTrasIntentoFallido,
} = require("../../src/dominio/politicaBloqueo");

describe("politicaBloqueo", () => {
  test("un usuario sin bloqueado_hasta no está bloqueado", () => {
    expect(estaBloqueado({ bloqueado_hasta: null })).toBe(false);
  });

  test("un usuario con bloqueado_hasta en el futuro está bloqueado", () => {
    const ahora = new Date("2026-01-01T10:00:00Z");
    const usuario = { bloqueado_hasta: "2026-01-01T10:10:00Z" };
    expect(estaBloqueado(usuario, ahora)).toBe(true);
  });

  test("un usuario con bloqueado_hasta en el pasado ya no está bloqueado", () => {
    const ahora = new Date("2026-01-01T10:00:00Z");
    const usuario = { bloqueado_hasta: "2026-01-01T09:00:00Z" };
    expect(estaBloqueado(usuario, ahora)).toBe(false);
  });

  test("intentos por debajo del límite no generan bloqueo", () => {
    const resultado = calcularTrasIntentoFallido(2);
    expect(resultado.intentos).toBe(3);
    expect(resultado.bloqueadoHasta).toBeNull();
  });

  test(`al llegar a ${LIMITE_INTENTOS} intentos se genera bloqueoHasta`, () => {
    const ahora = new Date("2026-01-01T10:00:00Z");
    const resultado = calcularTrasIntentoFallido(LIMITE_INTENTOS - 1, ahora);
    expect(resultado.intentos).toBe(LIMITE_INTENTOS);
    expect(resultado.bloqueadoHasta).toEqual(new Date("2026-01-01T10:15:00Z"));
  });
});
