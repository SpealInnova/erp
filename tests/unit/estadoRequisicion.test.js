const {
  ESTADOS,
  puedeTransicionar,
  transicionar,
} = require("../../src/dominio/estadoRequisicion");

describe("estadoRequisicion - máquina de estados", () => {
  test("avanza en orden: solicitada -> en_cotizacion -> convertida_oc -> cerrada", () => {
    expect(puedeTransicionar(ESTADOS.SOLICITADA, ESTADOS.EN_COTIZACION)).toBe(true);
    expect(puedeTransicionar(ESTADOS.EN_COTIZACION, ESTADOS.CONVERTIDA_OC)).toBe(true);
    expect(puedeTransicionar(ESTADOS.CONVERTIDA_OC, ESTADOS.CERRADA)).toBe(true);
  });

  test("no permite saltar fases", () => {
    expect(puedeTransicionar(ESTADOS.SOLICITADA, ESTADOS.CONVERTIDA_OC)).toBe(false);
  });

  test("no permite retroceder", () => {
    expect(puedeTransicionar(ESTADOS.EN_COTIZACION, ESTADOS.SOLICITADA)).toBe(false);
  });

  test("cerrada es un estado final", () => {
    expect(puedeTransicionar(ESTADOS.CERRADA, ESTADOS.SOLICITADA)).toBe(false);
  });

  test("transicionar() lanza error cuando la transición no es válida", () => {
    expect(() => transicionar(ESTADOS.SOLICITADA, ESTADOS.CERRADA)).toThrow(
      "Transición no permitida"
    );
  });
});
