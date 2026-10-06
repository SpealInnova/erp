const {
  ESTADOS,
  puedeTransicionar,
  transicionar,
} = require("../../src/dominio/estadoExpedienteDiseno");

describe("estadoExpedienteDiseno - máquina de estados", () => {
  test("desde pendiente puede ir a cualquiera de los 3 resultados", () => {
    expect(puedeTransicionar(ESTADOS.PENDIENTE, ESTADOS.APROBADO)).toBe(true);
    expect(puedeTransicionar(ESTADOS.PENDIENTE, ESTADOS.APROBADO_CON_RESTRICCIONES)).toBe(true);
    expect(puedeTransicionar(ESTADOS.PENDIENTE, ESTADOS.RECHAZADO)).toBe(true);
  });

  test("los 3 resultados son finales, sin retroceso", () => {
    expect(puedeTransicionar(ESTADOS.APROBADO, ESTADOS.PENDIENTE)).toBe(false);
    expect(puedeTransicionar(ESTADOS.APROBADO_CON_RESTRICCIONES, ESTADOS.APROBADO)).toBe(false);
    expect(puedeTransicionar(ESTADOS.RECHAZADO, ESTADOS.PENDIENTE)).toBe(false);
  });

  test("transicionar() lanza error cuando la transición no es válida", () => {
    expect(() => transicionar(ESTADOS.APROBADO, ESTADOS.RECHAZADO)).toThrow(
      "Transición no permitida"
    );
  });
});
