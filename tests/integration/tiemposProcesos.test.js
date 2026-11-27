const jwt = require("jsonwebtoken");
const request = require("supertest");
const { crearApp } = require("../../src/app");
const { crearPool } = require("../../src/config/db");
const { sufijoUnico } = require("../helpers/unico");
const { hoyEnColombia } = require("../../src/dominio/fechaColombia");

const hayBaseDeDatos = Boolean(process.env.DB_HOST);
const describirSiHayBD = hayBaseDeDatos ? describe : describe.skip;

// Fecha y hora "AAAA-MM-DD HH:MM:SS" a `dias` del hoy de Colombia (el del servidor).
function momento(dias, hora = "09:00:00") {
  const d = hoyEnColombia();
  d.setDate(d.getDate() + dias);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd} ${hora}`;
}
const fecha = (dias) => momento(dias).slice(0, 10);

describirSiHayBD("Tiempos y KPI (integración)", () => {
  let app;
  let pool;
  const u = {};
  const tokens = {};
  const sufijo = sufijoUnico();
  const categoria = `Ingeniería ${sufijo}`;
  let clienteId;
  let proyectoId;
  const act = {};

  const como = (quien) => ({ Authorization: `Bearer ${tokens[quien]}` });

  async function actividad(datos) {
    const [r] = await pool.query(
      `INSERT INTO proyecto_actividades
         (proyecto_id, fase, categoria, descripcion, estado, fecha_inicio, fecha_fin,
          iniciada_en, completada_en)
       VALUES (?, 'planeacion', ?, ?, ?, ?, ?, ?, ?)`,
      [
        proyectoId,
        categoria,
        datos.descripcion,
        datos.estado,
        datos.fecha_inicio,
        datos.fecha_fin,
        datos.iniciada_en || null,
        datos.completada_en || null,
      ]
    );
    return r.insertId;
  }

  async function transicion(entidad, registroId, estadoNuevo, cuando) {
    await pool.query(
      `INSERT INTO transiciones_estado (entidad, registro_id, proyecto_id, estado_nuevo, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [entidad, registroId, proyectoId, estadoNuevo, cuando]
    );
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "secreto-de-pruebas";
    pool = crearPool();
    for (const [clave, cargo] of [
      ["director", "Director de Operaciones y Producción"],
      ["tecnico", "Técnico Mantenimiento y Ensamble"],
    ]) {
      const correo = `tiempos-${clave}-${sufijo}@speal.test`;
      const [r] = await pool.query(
        "INSERT INTO usuarios (nombre, correo, password_hash, rol, cargo, activo) VALUES (?, ?, 'x', 'tester', ?, 1)",
        [`Tiempos ${clave}`, correo, cargo]
      );
      u[clave] = r.insertId;
      tokens[clave] = jwt.sign({ id: r.insertId, correo, rol: "tester" }, process.env.JWT_SECRET, {
        expiresIn: "1h",
      });
    }
    const [cliente] = await pool.query(
      `INSERT INTO clientes (nombre_razon_social, tipo_identificacion, numero_identificacion, created_by)
       VALUES (?, 'NIT', ?, ?)`,
      [`Cliente Tiempos ${sufijo}`, `TI-${sufijo}`, u.director]
    );
    clienteId = cliente.insertId;
    const [proyecto] = await pool.query(
      `INSERT INTO proyectos (codigo_pry, cliente_id, nombre_proyecto, estado, responsable_id)
       VALUES (?, ?, ?, 'diseno', ?)`,
      [`PRY-TI-${sufijo}`, clienteId, `Proyecto Tiempos ${sufijo}`, u.director]
    );
    proyectoId = proyecto.insertId;

    // Planeación: plan de 5 días (hace 25 a hace 21); duró 16 (entró hace 25, salió hace 10).
    await transicion("proyecto", proyectoId, "prospecto", momento(-30));
    await transicion("proyecto", proyectoId, "planeacion", momento(-25));
    await transicion("proyecto", proyectoId, "diseno", momento(-10));

    // Con horómetro: plan 5 días, se inició 1 día tarde, real 7 días, 6 h en curso.
    act.conHorometro = await actividad({
      descripcion: `Ingeniería básica ${sufijo}`,
      estado: "completada",
      fecha_inicio: fecha(-25),
      fecha_fin: fecha(-21),
      iniciada_en: momento(-24, "10:00:00"),
      completada_en: momento(-18, "10:00:00"),
    });
    await transicion("actividad", act.conHorometro, "en_curso", momento(-24, "10:00:00"));
    await transicion("actividad", act.conHorometro, "pendiente", momento(-24, "14:00:00"));
    await transicion("actividad", act.conHorometro, "en_curso", momento(-18, "08:00:00"));
    await transicion("actividad", act.conHorometro, "completada", momento(-18, "10:00:00"));

    // Sin horómetro, a tiempo: plan 5 días, real 4.
    act.aTiempo = await actividad({
      descripcion: `Planos de taller ${sufijo}`,
      estado: "completada",
      fecha_inicio: fecha(-12),
      fecha_fin: fecha(-8),
      completada_en: momento(-9),
    });

    // Abierta y vencida: plan 4 días (hace 6 a hace 3), lleva 7.
    act.vencida = await actividad({
      descripcion: `Lista de materiales ${sufijo}`,
      estado: "pendiente",
      fecha_inicio: fecha(-6),
      fecha_fin: fecha(-3),
    });

    app = crearApp();
  });

  afterAll(async () => {
    await pool.query("DELETE FROM transiciones_estado WHERE proyecto_id = ?", [proyectoId]);
    await pool.query("DELETE FROM proyecto_actividades WHERE proyecto_id = ?", [proyectoId]);
    await pool.query("DELETE FROM proyectos WHERE id = ?", [proyectoId]);
    await pool.query("DELETE FROM clientes WHERE id = ?", [clienteId]);
    // las actividades vencidas de la prueba pueden generar avisos (según la
    // fecha y la hora en que corra): se borran antes que sus usuarios
    await pool.query("DELETE FROM notificaciones WHERE usuario_id IN (?)", [Object.values(u)]);
    await pool.query("DELETE FROM usuarios WHERE id IN (?)", [Object.values(u)]);
    await pool.end();
  });

  test("solo los cargos directivos lo consultan", async () => {
    expect((await request(app).get("/tableros/tiempos").set(como("tecnico"))).status).toBe(403);
    expect((await request(app).get("/tableros/tiempos").set(como("director"))).status).toBe(200);
    expect(
      (await request(app).get("/tableros/tiempos?periodo=siempre").set(como("director"))).status
    ).toBe(400);
  });

  test("compara cada tipo de actividad con su plan y separa el tiempo en curso", async () => {
    const r = await request(app).get("/tableros/tiempos?periodo=todo").set(como("director"));
    const fila = r.body.tablero.categorias.find((c) => c.categoria === categoria);
    expect(fila).toMatchObject({
      finalizadas: 2,
      abiertas: 1,
      vencidas: 1,
      a_tiempo_pct: 50,
      plan_promedio_dias: 5,
      real_promedio_dias: 5.5, // (7 + 4) / 2
      desviacion_pct: 10, // (11 - 10) / 10
      retraso_inicio_promedio_dias: 1,
      horas_en_curso_promedio: 6,
      con_horometro: 1,
      espera_promedio_dias: 6.8, // 7 días reales - 6 h en curso
    });
  });

  test("lista las actividades más demoradas frente a su plan", async () => {
    const r = await request(app).get("/tableros/tiempos?periodo=todo").set(como("director"));
    const { lentas } = r.body.tablero;
    const vencida = lentas.find((l) => l.id === act.vencida);
    // las de otras pruebas pueden quedar por delante: se verifica la propia
    if (vencida) {
      expect(vencida).toMatchObject({
        plan_dias: 4,
        real_dias: 7,
        exceso_dias: 3,
        finalizada: false,
      });
    } else {
      expect(lentas).toHaveLength(10);
      expect(lentas[9].exceso_dias).toBeGreaterThanOrEqual(3);
    }
    const ids = lentas.map((l) => l.id);
    expect(ids).not.toContain(act.aTiempo);
  });

  test("mide la fase de planeación contra el plan de sus actividades", async () => {
    const r = await request(app).get("/tableros/tiempos?periodo=todo").set(como("director"));
    const planeacion = r.body.tablero.fases.find((f) => f.fase === "planeacion");
    expect(planeacion.cerrados).toBeGreaterThanOrEqual(1);
    expect(planeacion.desviacion_pct).not.toBeNull();
    const diseno = r.body.tablero.fases.find((f) => f.fase === "diseno");
    expect(diseno.en_fase_ahora).toBeGreaterThanOrEqual(1);
    expect(r.body.tablero.fases.map((f) => f.fase)).not.toContain("cancelado");
  });
});
