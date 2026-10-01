const { ESTADOS, puedeTransicionar, transicionar } = require("../../src/dominio/estadoProyecto");

describe("estadoProyecto - máquina de estados", () => {
  test("permite la transición válida prospecto -> cotizado", () => {
    expect(puedeTransicionar(ESTADOS.PROSPECTO, ESTADOS.COTIZADO)).toBe(true);
  });

  test("rechaza una transición inválida (saltar pasos)", () => {
    expect(puedeTransicionar(ESTADOS.PROSPECTO, ESTADOS.EN_EJECUCION)).toBe(false);
  });

  test("un estado cerrado no permite más transiciones", () => {
    expect(puedeTransicionar(ESTADOS.CERRADO, ESTADOS.EN_EJECUCION)).toBe(false);
  });

  test("transicionar() devuelve el nuevo estado cuando es válido", () => {
    expect(transicionar(ESTADOS.COTIZADO, ESTADOS.APROBADO)).toBe(ESTADOS.APROBADO);
  });

  test("transicionar() lanza error cuando la transición no es válida", () => {
    expect(() => transicionar(ESTADOS.PROSPECTO, ESTADOS.CERRADO)).toThrow(
      "Transición no permitida"
    );
  });

  test("puedeTransicionar() lanza error si el estado actual no existe", () => {
    expect(() => puedeTransicionar("estado_inventado", ESTADOS.COTIZADO)).toThrow(
      "Estado actual desconocido"
    );
  });
});
