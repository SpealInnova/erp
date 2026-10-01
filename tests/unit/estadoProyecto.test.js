const { ESTADOS, puedeTransicionar, transicionar } = require("../../src/dominio/estadoProyecto");

describe("estadoProyecto - máquina de estados (9 fases + prospecto)", () => {
  test("permite la transición válida prospecto -> planeacion", () => {
    expect(puedeTransicionar(ESTADOS.PROSPECTO, ESTADOS.PLANEACION)).toBe(true);
  });

  test("rechaza una transición inválida (saltar fases)", () => {
    expect(puedeTransicionar(ESTADOS.PROSPECTO, ESTADOS.PRODUCCION)).toBe(false);
  });

  test("cualquier fase activa puede cancelarse", () => {
    expect(puedeTransicionar(ESTADOS.COMPRAS, ESTADOS.CANCELADO)).toBe(true);
  });

  test("un estado cerrado no permite más transiciones", () => {
    expect(puedeTransicionar(ESTADOS.CERRADO, ESTADOS.SEGUIMIENTO)).toBe(false);
  });

  test("un estado cancelado no permite más transiciones", () => {
    expect(puedeTransicionar(ESTADOS.CANCELADO, ESTADOS.PLANEACION)).toBe(false);
  });

  test("transicionar() avanza por toda la cadena de fases en orden", () => {
    const cadena = [
      ESTADOS.PROSPECTO,
      ESTADOS.PLANEACION,
      ESTADOS.DISENO,
      ESTADOS.COMPRAS,
      ESTADOS.PRODUCCION,
      ESTADOS.CALIDAD_FAT,
      ESTADOS.LOGISTICA,
      ESTADOS.INSTALACION,
      ESTADOS.SAT,
      ESTADOS.SEGUIMIENTO,
      ESTADOS.CERRADO,
    ];

    for (let i = 0; i < cadena.length - 1; i += 1) {
      expect(transicionar(cadena[i], cadena[i + 1])).toBe(cadena[i + 1]);
    }
  });

  test("transicionar() lanza error cuando la transición no es válida", () => {
    expect(() => transicionar(ESTADOS.PROSPECTO, ESTADOS.CERRADO)).toThrow(
      "Transición no permitida"
    );
  });

  test("puedeTransicionar() lanza error si el estado actual no existe", () => {
    expect(() => puedeTransicionar("estado_inventado", ESTADOS.PLANEACION)).toThrow(
      "Estado actual desconocido"
    );
  });
});
