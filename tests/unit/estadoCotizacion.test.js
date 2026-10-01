const { ESTADOS, puedeTransicionar, transicionar } = require("../../src/dominio/estadoCotizacion");

describe("estadoCotizacion - máquina de estados", () => {
  test("borrador solo puede pasar a revisión", () => {
    expect(puedeTransicionar(ESTADOS.BORRADOR, ESTADOS.REVISION)).toBe(true);
    expect(puedeTransicionar(ESTADOS.BORRADOR, ESTADOS.APROBACION)).toBe(false);
  });

  test("revisión puede devolverse a borrador o avanzar a aprobación", () => {
    expect(puedeTransicionar(ESTADOS.REVISION, ESTADOS.BORRADOR)).toBe(true);
    expect(puedeTransicionar(ESTADOS.REVISION, ESTADOS.APROBACION)).toBe(true);
    expect(puedeTransicionar(ESTADOS.REVISION, ESTADOS.ENVIADA)).toBe(false);
  });

  test("enviada solo puede terminar en aceptada o rechazada", () => {
    expect(puedeTransicionar(ESTADOS.ENVIADA, ESTADOS.ACEPTADA)).toBe(true);
    expect(puedeTransicionar(ESTADOS.ENVIADA, ESTADOS.RECHAZADA)).toBe(true);
    expect(puedeTransicionar(ESTADOS.ENVIADA, ESTADOS.BORRADOR)).toBe(false);
  });

  test("aceptada y rechazada son estados finales", () => {
    expect(puedeTransicionar(ESTADOS.ACEPTADA, ESTADOS.ENVIADA)).toBe(false);
    expect(puedeTransicionar(ESTADOS.RECHAZADA, ESTADOS.BORRADOR)).toBe(false);
  });

  test("transicionar() lanza error cuando la transición no es válida", () => {
    expect(() => transicionar(ESTADOS.BORRADOR, ESTADOS.ENVIADA)).toThrow(
      "Transición no permitida"
    );
  });
});
