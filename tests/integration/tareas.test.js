const jwt = require("jsonwebtoken");
const request = require("supertest");
const { crearApp } = require("../../src/app");
const { crearPool } = require("../../src/config/db");
const { generarAvisosVencimiento } = require("../../src/servicios/avisosActividades");

jest.mock("../../src/servicios/correo", () => ({
  enviarCorreo: jest.fn().mockResolvedValue(undefined),
}));

const hayBaseDeDatos = Boolean(process.env.DB_HOST);
const describirSiHayBD = hayBaseDeDatos ? describe : describe.skip;

describirSiHayBD("Gestor de tareas, tablero general y acceso al gerencial (integración)", () => {
  let app;
  let pool;
  const u = {};
  const tokens = {};
  const sufijo = Date.now();
  const ids = {};

  // Fechas según la base (evita desfases entre la zona del equipo y la de la BD).
  async function dia(n) {
    const [[fila]] = await pool.query(
      "SELECT DATE_FORMAT(CURDATE() + INTERVAL ? DAY, '%Y-%m-%d') AS d",
      [n]
    );
    return fila.d;
  }

  const como = (quien) => ({ Authorization: `Bearer ${tokens[quien]}` });

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "secreto-de-pruebas";
    pool = crearPool();
    for (const [clave, cargo] of [
      ["creador", null],
      ["responsable", "Técnico Mantenimiento y Ensamble"],
      ["ajeno", null],
      ["director", "Director de Operaciones y Producción"],
    ]) {
      const correo = `tareas-${clave}-${sufijo}@speal.test`;
      const [r] = await pool.query(
        "INSERT INTO usuarios (nombre, correo, password_hash, rol, cargo, activo) VALUES (?, ?, 'x', 'tester', ?, 1)",
        [`Tareas ${clave}`, correo, cargo]
      );
      u[clave] = r.insertId;
      tokens[clave] = jwt.sign({ id: r.insertId, correo, rol: "tester" }, process.env.JWT_SECRET, {
        expiresIn: "1h",
      });
    }
    app = crearApp();
  });

  afterAll(async () => {
    const usuarios = Object.values(u);
    const tareas = Object.values(ids);
    if (tareas.length) {
      await pool.query(
        "DELETE FROM transiciones_estado WHERE entidad = 'tarea' AND registro_id IN (?)",
        [tareas]
      );
      await pool.query("DELETE FROM auditoria WHERE tabla = 'tareas' AND registro_id IN (?)", [
        tareas,
      ]);
      await pool.query("DELETE FROM tareas WHERE id IN (?)", [tareas]);
    }
    await pool.query("DELETE FROM notificaciones WHERE usuario_id IN (?)", [usuarios]);
    await pool.query("DELETE FROM usuarios WHERE id IN (?)", [usuarios]);
    await pool.end();
  });

  const crearTarea = async (quien, datos) => {
    const r = await request(app).post("/tareas").set(como(quien)).send(datos);
    expect(r.status).toBe(201);
    return r.body.tarea;
  };

  test("sin responsable, la tarea es de quien la crea", async () => {
    const tarea = await crearTarea("creador", { titulo: "Ordenar el almacén" });
    ids.propia = tarea.id;
    expect(tarea.responsable_id).toBe(u.creador);
    expect(tarea.estado).toBe("pendiente");
    expect(tarea.prioridad).toBe("normal");
    expect(tarea.segundos_en_curso).toBe(0);
  });

  test("asignar una tarea avisa al responsable con su prioridad", async () => {
    const tarea = await crearTarea("creador", {
      titulo: "Revisar compresor del cliente",
      responsable_id: u.responsable,
      prioridad: "urgente",
      fecha_inicio: await dia(0),
      fecha_fin: await dia(1),
    });
    ids.asignada = tarea.id;
    const [avisos] = await pool.query(
      "SELECT mensaje, enlace FROM notificaciones WHERE usuario_id = ? AND tipo = 'tarea_asignada'",
      [u.responsable]
    );
    expect(avisos).toHaveLength(1);
    expect(avisos[0].mensaje).toContain("prioridad Urgente");
    expect(avisos[0].enlace).toBe(`#/tareas/${tarea.id}`);
  });

  test("filtra por origen y por periodo", async () => {
    ids.vencida = (
      await crearTarea("creador", {
        titulo: "Tarea vencida",
        fecha_inicio: await dia(-5),
        fecha_fin: await dia(-2),
      })
    ).id;
    ids.lejana = (
      await crearTarea("creador", {
        titulo: "Tarea lejana",
        fecha_inicio: await dia(40),
        fecha_fin: await dia(45),
      })
    ).id;
    const listar = async (quien, consulta) =>
      (await request(app).get(`/tareas?${consulta}`).set(como(quien))).body.tareas.map((t) => t.id);

    expect(await listar("responsable", "origen=asignadas_a_mi")).toEqual([ids.asignada]);
    expect(await listar("creador", "origen=asignadas_por_mi")).toEqual([ids.asignada]);
    expect(await listar("creador", "origen=propias")).toEqual(
      expect.arrayContaining([ids.propia, ids.vencida, ids.lejana])
    );
    expect(await listar("creador", "periodo=vencidas")).toEqual([ids.vencida]);
    const hoy = await listar("creador", "periodo=hoy");
    // hoy: lo de hoy, lo vencido y lo sin fechas; no lo lejano
    expect(hoy).toEqual(expect.arrayContaining([ids.asignada, ids.vencida, ids.propia]));
    expect(hoy).not.toContain(ids.lejana);
    expect(await listar("creador", "periodo=mes")).not.toContain(ids.lejana);
    expect(await listar("creador", "periodo=todas")).toContain(ids.lejana);
  });

  test("iniciar y finalizar registran los tiempos; un tercero no la puede cambiar", async () => {
    const enCurso = await request(app)
      .put(`/tareas/${ids.asignada}`)
      .set(como("responsable"))
      .send({ estado: "en_curso" });
    expect(enCurso.status).toBe(200);
    expect(enCurso.body.tarea.iniciada_en).not.toBeNull();

    const ajeno = await request(app)
      .put(`/tareas/${ids.asignada}`)
      .set(como("ajeno"))
      .send({ estado: "completada" });
    expect(ajeno.status).toBe(403);

    const fin = await request(app)
      .put(`/tareas/${ids.asignada}`)
      .set(como("responsable"))
      .send({ estado: "completada" });
    expect(fin.body.tarea.completada_por).toBe(u.responsable);
    expect(fin.body.tarea.segundos_en_curso).toBeGreaterThanOrEqual(0);
    const [trans] = await pool.query(
      "SELECT estado_nuevo FROM transiciones_estado WHERE entidad = 'tarea' AND registro_id = ? ORDER BY id",
      [ids.asignada]
    );
    expect(trans.map((t) => t.estado_nuevo)).toEqual(["en_curso", "completada"]);
  });

  test("la prioridad Alta avisa a quien la creó; solo quien la creó la elimina", async () => {
    await request(app)
      .put(`/tareas/${ids.asignada}`)
      .set(como("responsable"))
      .send({ prioridad: "alta" });
    const [avisos] = await pool.query(
      "SELECT mensaje FROM notificaciones WHERE usuario_id = ? AND tipo = 'tarea_actualizada'",
      [u.creador]
    );
    expect(avisos.map((a) => a.mensaje).join(" ")).toContain("prioridad Alta");

    expect(
      (await request(app).delete(`/tareas/${ids.asignada}`).set(como("responsable"))).status
    ).toBe(403);
    expect((await request(app).delete(`/tareas/${ids.lejana}`).set(como("creador"))).status).toBe(
      204
    );
    const restantes = (await request(app).get("/tareas").set(como("creador"))).body.tareas.map(
      (t) => t.id
    );
    expect(restantes).not.toContain(ids.lejana);
  });

  test("las tareas por vencer avisan en la campana y aparecen en Actividades pendientes", async () => {
    ids.porVencer = (
      await crearTarea("creador", {
        titulo: "Enviar informe",
        responsable_id: u.responsable,
        fecha_fin: await dia(1),
      })
    ).id;
    await generarAvisosVencimiento(pool);
    const [avisos] = await pool.query(
      "SELECT tipo, mensaje FROM notificaciones WHERE usuario_id = ? AND enlace = ?",
      [u.responsable, `#/tareas/${ids.porVencer}`]
    );
    expect(avisos.map((a) => a.tipo)).toContain("actividad_por_vencer");
    expect(avisos.map((a) => a.mensaje).join(" ")).toContain("vence mañana");

    const pendientes = await request(app).get("/actividades/pendientes").set(como("responsable"));
    expect(pendientes.body.tareas.map((t) => t.id)).toContain(ids.porVencer);
  });

  test("tablero general para cualquier perfil; el gerencial solo para directivos", async () => {
    ids.deHoy = (
      await crearTarea("creador", {
        titulo: "Llamar al cliente",
        responsable_id: u.responsable,
        fecha_fin: await dia(0),
      })
    ).id;
    const general = await request(app).get("/tableros/general").set(como("responsable"));
    expect(general.status).toBe(200);
    const { tablero } = general.body;
    expect(tablero.semana).toHaveLength(7);
    expect(tablero.kpis.finalizadas_mes).toBeGreaterThanOrEqual(1);
    expect(tablero.aprobaciones).toEqual([]); // su cargo no aprueba nada
    // vence hoy: "para hoy"; la que vence mañana no
    const paraHoy = tablero.para_hoy.map((p) => p.titulo);
    expect(paraHoy).toContain("Llamar al cliente");
    expect(paraHoy).not.toContain("Enviar informe");

    expect((await request(app).get("/tableros/gerencial").set(como("responsable"))).status).toBe(
      403
    );
    expect((await request(app).get("/tableros/gerencial").set(como("director"))).status).toBe(200);
  });
});
