const { camposCambiados, armarFila } = require("../../src/servicios/auditoriaConsulta");

describe("camposCambiados", () => {
  test("devuelve solo lo que cambió, sin fechas técnicas ni datos sensibles", () => {
    const antes = {
      estado: "pendiente",
      descripcion: "igual",
      updated_at: "2026-01-01",
      password_hash: "a",
      token_recuperacion: "x",
    };
    const despues = {
      estado: "completada",
      descripcion: "igual",
      updated_at: "2026-01-02",
      password_hash: "b",
      token_recuperacion: "y",
    };
    expect(camposCambiados(antes, despues)).toEqual([
      { campo: "estado", antes: "pendiente", despues: "completada" },
    ]);
  });

  test("un valor nuevo o borrado se muestra como vacío del otro lado", () => {
    expect(camposCambiados({ ciudad: null }, { ciudad: "Cali" })).toEqual([
      { campo: "ciudad", antes: null, despues: "Cali" },
    ]);
  });

  test("recorta los textos largos", () => {
    const [c] = camposCambiados({ nota: "a" }, { nota: "x".repeat(300) });
    expect(c.despues.length).toBe(120);
    expect(c.despues.endsWith("…")).toBe(true);
  });
});

describe("armarFila", () => {
  const base = { id: 1, creado_en: "2026-11-24", usuario_id: 2, usuario_nombre: "Ana" };

  test("una sección del expediente enlaza a su expediente", () => {
    const fila = armarFila({
      ...base,
      tabla: "verificaciones",
      registro_id: 9,
      accion: "crear",
      datos_anteriores: null,
      datos_nuevos: JSON.stringify({ expediente_id: 4, requisito_verificado: "Pureza" }),
    });
    expect(fila).toMatchObject({
      modulo: "Verificación",
      enlace: "#/expedientes-diseno/4",
      cambios: [],
    });
  });

  test("lo eliminado no tiene enlace pero conserva su identificación", () => {
    const fila = armarFila({
      ...base,
      tabla: "cotizaciones",
      registro_id: 5,
      accion: "eliminar",
      datos_anteriores: { numero_cotizacion: "COT-2026-005" },
      datos_nuevos: null,
    });
    expect(fila).toMatchObject({ documento: "COT-2026-005", enlace: null });
  });

  test("una actividad enlaza a su proyecto y una tabla desconocida muestra su nombre", () => {
    expect(
      armarFila({
        ...base,
        tabla: "proyecto_actividades",
        registro_id: 3,
        accion: "actualizar",
        datos_anteriores: { proyecto_id: 7, estado: "pendiente" },
        datos_nuevos: { proyecto_id: 7, estado: "en_curso" },
      }).enlace
    ).toBe("#/proyectos/7/actividades/3");
    expect(
      armarFila({
        ...base,
        tabla: "otra_tabla",
        registro_id: 1,
        accion: "crear",
        datos_anteriores: null,
        datos_nuevos: {},
      })
    ).toMatchObject({ modulo: "otra_tabla", enlace: null, documento: null });
  });
});
