const { entradaAlEstado } = require("../../src/servicios/tableros");

describe("entradaAlEstado", () => {
  const oc = { id: 1, estado: "aprobada_pte_pago", creada: "2026-01-10" };

  test("sin cambios auditados, cuenta desde la creación", () => {
    expect(entradaAlEstado(oc)).toBe("2026-01-10");
    expect(entradaAlEstado(oc, [])).toBe("2026-01-10");
  });

  test("toma el cambio que lo llevó al estado actual", () => {
    const cambios = [
      { fecha: "2026-01-20", estado_anterior: "pte_aprobar", estado_nuevo: "aprobada_pte_pago" },
    ];
    expect(entradaAlEstado(oc, cambios)).toBe("2026-01-20");
  });

  test("ignora ediciones que no cambian el estado", () => {
    const cambios = [
      { fecha: "2026-01-20", estado_anterior: "pte_aprobar", estado_nuevo: "aprobada_pte_pago" },
      {
        fecha: "2026-01-25",
        estado_anterior: "aprobada_pte_pago",
        estado_nuevo: "aprobada_pte_pago",
      },
    ];
    expect(entradaAlEstado(oc, cambios)).toBe("2026-01-20");
  });

  test("si volvió al mismo estado más de una vez, cuenta desde la última vez", () => {
    const requisicion = { id: 2, estado: "solicitada", creada: "2026-01-01" };
    const cambios = [
      { fecha: "2026-01-05", estado_anterior: "solicitada", estado_nuevo: "en_cotizacion" },
      { fecha: "2026-01-09", estado_anterior: "en_cotizacion", estado_nuevo: "solicitada" },
    ];
    expect(entradaAlEstado(requisicion, cambios)).toBe("2026-01-09");
  });
});
