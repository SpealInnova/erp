const { medir, tramosDeFase } = require("../../src/servicios/tiemposProcesos");

const ahora = new Date(2026, 10, 19, 12, 0, 0); // 19 nov 2026, 12:00
const dia = (d, h = 9) => new Date(2026, 10, d, h, 0, 0);

describe("tiempos de los procesos", () => {
  test("una fase se mide de su entrada a su salida; la abierta, hasta hoy", () => {
    const base = {
      proyecto_id: 1,
      codigo_pry: "PRY-1",
      nombre_proyecto: "Uno",
      estado_proyecto: "diseno",
    };
    const tramos = tramosDeFase(
      [
        { ...base, estado_nuevo: "prospecto", created_at: dia(1) },
        { ...base, estado_nuevo: "planeacion", created_at: dia(3) },
        { ...base, estado_nuevo: "diseno", created_at: dia(10) },
      ],
      ahora
    );
    expect(tramos.map((t) => [t.fase, t.dias, Boolean(t.salida)])).toEqual([
      ["prospecto", 3, true],
      ["planeacion", 8, true],
      ["diseno", 10, false],
    ]);
  });

  test("la fase que termina en cancelación no cuenta", () => {
    const base = {
      proyecto_id: 2,
      codigo_pry: "PRY-2",
      nombre_proyecto: "Dos",
      estado_proyecto: "cancelado",
    };
    const tramos = tramosDeFase(
      [
        { ...base, estado_nuevo: "prospecto", created_at: dia(1) },
        { ...base, estado_nuevo: "planeacion", created_at: dia(2) },
        { ...base, estado_nuevo: "cancelado", created_at: dia(5) },
      ],
      ahora
    );
    expect(tramos.map((t) => t.fase)).toEqual(["prospecto"]);
  });

  test("una actividad separa el tiempo en curso del tiempo en espera", () => {
    const medida = medir(
      {
        estado: "completada",
        fecha_inicio: dia(10, 0),
        fecha_fin: dia(12, 0),
        iniciada_en: dia(11, 8),
        completada_en: dia(14, 17),
        created_at: dia(1),
      },
      [
        { estado_nuevo: "en_curso", created_at: dia(11, 8) },
        { estado_nuevo: "pendiente", created_at: dia(11, 12) },
        { estado_nuevo: "en_curso", created_at: dia(14, 15) },
        { estado_nuevo: "completada", created_at: dia(14, 17) },
      ],
      ahora
    );
    expect(medida).toMatchObject({
      finalizada: true,
      plan: 3,
      real: 4,
      a_tiempo: false,
      retraso_inicio: 1,
      con_horometro: true,
      horas_en_curso: 6,
    });
    expect(medida.espera_dias).toBeCloseTo(3.75);
  });

  test("una abierta que aún no empieza no tiene tiempo real", () => {
    const medida = medir(
      { estado: "pendiente", fecha_inicio: dia(25, 0), fecha_fin: dia(28, 0), created_at: dia(1) },
      [],
      ahora
    );
    expect(medida).toMatchObject({ finalizada: false, plan: 4, real: null, vencida: false });
  });
});
