const { duracionMinutos, celdaCsv } = require("../../src/servicios/listadoMaestroServicios");

describe("Listado maestro de servicios: cálculos", () => {
  test("duración en minutos entre la hora de inicio y la de fin", () => {
    expect(duracionMinutos("08:30:00", "10:15:00")).toBe(105);
    expect(duracionMinutos("08:30", "08:30")).toBe(0);
  });

  test("sin una de las horas, o con el fin antes del inicio, no hay duración", () => {
    expect(duracionMinutos(null, "10:00:00")).toBeNull();
    expect(duracionMinutos("10:00:00", null)).toBeNull();
    expect(duracionMinutos("10:00:00", "09:00:00")).toBeNull();
  });

  test("CSV: comillas solo cuando hacen falta y vacío para null", () => {
    expect(celdaCsv("Revisión anual")).toBe("Revisión anual");
    expect(celdaCsv('Cambio de filtro; "urgente"')).toBe('"Cambio de filtro; ""urgente"""');
    expect(celdaCsv("línea 1\nlínea 2")).toBe('"línea 1\nlínea 2"');
    expect(celdaCsv(null)).toBe("");
    expect(celdaCsv(0)).toBe("0");
  });

  test("CSV: un texto que parece fórmula no se ejecuta en Excel", () => {
    expect(celdaCsv('=HYPERLINK("http://x")')).toBe('"\'=HYPERLINK(""http://x"")"');
    expect(celdaCsv("+57 300")).toBe("'+57 300");
    expect(celdaCsv("-5")).toBe("'-5");
    expect(celdaCsv("@suma")).toBe("'@suma");
  });
});
