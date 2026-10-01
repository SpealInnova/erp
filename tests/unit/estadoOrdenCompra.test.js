const {
  ESTADOS,
  puedeTransicionar,
  transicionar,
} = require("../../src/dominio/estadoOrdenCompra");

describe("estadoOrdenCompra - máquina de estados", () => {
  test("avanza en orden: pte_aprobar -> aprobada_pte_pago -> paga -> contabilizada", () => {
    expect(puedeTransicionar(ESTADOS.PTE_APROBAR, ESTADOS.APROBADA_PTE_PAGO)).toBe(true);
    expect(puedeTransicionar(ESTADOS.APROBADA_PTE_PAGO, ESTADOS.PAGA)).toBe(true);
    expect(puedeTransicionar(ESTADOS.PAGA, ESTADOS.CONTABILIZADA)).toBe(true);
  });

  test("no permite saltar fases", () => {
    expect(puedeTransicionar(ESTADOS.PTE_APROBAR, ESTADOS.PAGA)).toBe(false);
  });

  test("contabilizada es un estado final", () => {
    expect(puedeTransicionar(ESTADOS.CONTABILIZADA, ESTADOS.PAGA)).toBe(false);
  });

  test("transicionar() lanza error cuando la transición no es válida", () => {
    expect(() => transicionar(ESTADOS.PTE_APROBAR, ESTADOS.CONTABILIZADA)).toThrow(
      "Transición no permitida"
    );
  });
});
