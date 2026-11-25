const { evaluarExpediente, cierreDeEntrega } = require("../../src/servicios/tablerosOperacion");

const vacio = {
  requisitos: [],
  salidas: [],
  revisiones: [],
  riesgos: [],
  verificaciones: [],
  validaciones: [],
  transferencias: [],
};

describe("evaluarExpediente (qué falta para liberar)", () => {
  test("un expediente sin nada registrado tiene los 9 pasos pendientes", () => {
    const r = evaluarExpediente({ id: 1, numero_serie: null }, vacio, 0);
    expect(r.pasos_listos).toBe(1); // sin cambios pendientes ya cuenta como listo
    expect(r.pasos_total).toBe(9);
    expect(r.faltan).toContain("Requisitos de entrada");
  });

  test("todo completo y conforme queda listo para decidir", () => {
    const pasos = {
      requisitos: [{ expediente_id: 1, requisito: "Presión de salida" }],
      salidas: [{ expediente_id: 1, estado: "Aprobada" }],
      revisiones: [{ expediente_id: 1, cierre: "si" }],
      riesgos: [{ expediente_id: 1, severidad: "4", probabilidad: "3" }],
      verificaciones: [
        { expediente_id: 1, requisito_verificado: "presion de salida", resultado: "Conforme" },
      ],
      validaciones: [{ expediente_id: 1, resultado: "conforme" }],
      transferencias: [{ expediente_id: 1 }],
    };
    const r = evaluarExpediente({ id: 1, numero_serie: "SN-1" }, pasos, 0);
    expect(r.faltan).toEqual([]);
    expect(r.pasos_listos).toBe(9);
    expect(r.riesgos_altos).toBe(1); // 4 × 3 = 12
  });

  test("no mezcla los pasos de otro expediente y cuenta los cambios sin decidir", () => {
    const pasos = { ...vacio, requisitos: [{ expediente_id: 2, requisito: "Otro" }] };
    const r = evaluarExpediente({ id: 1, numero_serie: "SN-1" }, pasos, 2);
    expect(r.faltan).toContain("Requisitos de entrada");
    expect(r.faltan).toContain("2 cambios sin decidir");
  });
});

describe("cierreDeEntrega", () => {
  const entrega = { id: 7, proyecto_id: 3, fecha: "2026-01-10" };

  test("usa el cierre que referencia el acta de entrega", () => {
    const cierres = [{ id: 1, acta_entrega_id: 7, proyecto_id: 3, fecha: "2026-01-20" }];
    expect(cierreDeEntrega(entrega, cierres).id).toBe(1);
  });

  test("sin referencia, toma un cierre posterior del mismo proyecto", () => {
    const cierres = [
      { id: 1, acta_entrega_id: null, proyecto_id: 3, fecha: "2026-01-05" },
      { id: 2, acta_entrega_id: null, proyecto_id: 3, fecha: "2026-01-15" },
    ];
    expect(cierreDeEntrega(entrega, cierres).id).toBe(2);
  });

  test("un cierre de otra entrega u otro proyecto no cuenta", () => {
    const cierres = [
      { id: 1, acta_entrega_id: 99, proyecto_id: 3, fecha: "2026-01-20" },
      { id: 2, acta_entrega_id: null, proyecto_id: 4, fecha: "2026-01-20" },
    ];
    expect(cierreDeEntrega(entrega, cierres)).toBeNull();
  });
});
