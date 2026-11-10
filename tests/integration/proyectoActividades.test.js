const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { crearApp } = require("../../src/app");
const { crearPool } = require("../../src/config/db");
const { sufijoUnico } = require("../helpers/unico");
const { obtenerActividadesPorFase } = require("../../src/dominio/actividadesCatalogoProyecto");

const hayBaseDeDatos = Boolean(process.env.DB_HOST);
const describirSiHayBD = hayBaseDeDatos ? describe : describe.skip;

describirSiHayBD("Actividades de proyecto por fase (integración contra BD real)", () => {
  let app;
  let pool;
  let usuarioId;
  let clienteId;
  let proyectoId;
  let token;
  const correoUsuario = `proy-actividades-test-${Date.now()}@speal.test`;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "secreto-de-pruebas";
    pool = crearPool();

    const passwordHash = await bcrypt.hash("ClaveSegura123", 10);
    const [usuario] = await pool.query(
      "INSERT INTO usuarios (nombre, correo, password_hash, rol, activo) VALUES (?, ?, ?, 'tester', 1)",
      ["Usuario de prueba", correoUsuario, passwordHash]
    );
    usuarioId = usuario.insertId;
    token = jwt.sign(
      { id: usuarioId, correo: correoUsuario, rol: "tester" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const [cliente] = await pool.query(
      `INSERT INTO clientes (nombre_razon_social, tipo_identificacion, numero_identificacion, created_by)
       VALUES (?, 'NIT', ?, ?)`,
      ["Cliente para Actividades", `PA-TEST-${Date.now()}`, usuarioId]
    );
    clienteId = cliente.insertId;

    const [proyecto] = await pool.query(
      `INSERT INTO proyectos (codigo_pry, cliente_id, nombre_proyecto, estado, responsable_id)
       VALUES (?, ?, 'Proyecto para Actividades', 'prospecto', ?)`,
      [`PRY-${sufijoUnico()}`, clienteId, usuarioId]
    );
    proyectoId = proyecto.insertId;

    app = crearApp();
  });

  afterAll(async () => {
    await pool.query("DELETE FROM auditoria WHERE usuario_id = ?", [usuarioId]);
    await pool.query("DELETE FROM proyecto_actividades WHERE proyecto_id = ?", [proyectoId]);
    await pool.query("DELETE FROM proyectos WHERE id = ?", [proyectoId]);
    await pool.query("DELETE FROM clientes WHERE id = ?", [clienteId]);
    await pool.query("DELETE FROM notificaciones WHERE usuario_id = ?", [usuarioId]);
    await pool.query("DELETE FROM usuarios WHERE id = ?", [usuarioId]);
    await pool.end();
  });

  const autorizacion = () => ({ Authorization: `Bearer ${token}` });
  let actividadId;

  test("un proyecto recién creado (prospecto) no tiene actividades preestablecidas", async () => {
    const respuesta = await request(app)
      .get(`/proyectos/${proyectoId}/actividades`)
      .set(autorizacion());
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.actividades).toHaveLength(0);
  });

  test("al avanzar a planeación se siembran las actividades del catálogo de esa fase", async () => {
    const avance = await request(app)
      .patch(`/proyectos/${proyectoId}/estado`)
      .set(autorizacion())
      .send({ estado: "planeacion", observacion: "Aprobado en comité de apertura" });
    expect(avance.status).toBe(200);

    const respuesta = await request(app)
      .get(`/proyectos/${proyectoId}/actividades`)
      .set(autorizacion());
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.actividades).toHaveLength(obtenerActividadesPorFase("planeacion").length);
    expect(respuesta.body.actividades.every((a) => a.fase === "planeacion")).toBe(true);
    expect(respuesta.body.actividades.every((a) => a.estado === "pendiente")).toBe(true);
    actividadId = respuesta.body.actividades[0].id;
  });

  test("avanzar de fase no duplica actividades ya generadas para esa fase", async () => {
    // reintentar la misma transición (idempotencia del sembrado) no aplica porque
    // el motor de estados no permite reenviar el mismo estado; se valida indirectamente
    // verificando que el conteo de planeación no cambió tras la siguiente transición
    await request(app)
      .patch(`/proyectos/${proyectoId}/estado`)
      .set(autorizacion())
      .send({ estado: "diseno" });

    const respuesta = await request(app)
      .get(`/proyectos/${proyectoId}/actividades`)
      .set(autorizacion());
    const dePlaneacion = respuesta.body.actividades.filter((a) => a.fase === "planeacion");
    expect(dePlaneacion).toHaveLength(obtenerActividadesPorFase("planeacion").length);
    const deDiseno = respuesta.body.actividades.filter((a) => a.fase === "diseno");
    expect(deDiseno).toHaveLength(obtenerActividadesPorFase("diseno").length);
  });

  test("marca una actividad como completada y le asigna responsable", async () => {
    const respuesta = await request(app)
      .put(`/proyectos/${proyectoId}/actividades/${actividadId}`)
      .set(autorizacion())
      .send({ estado: "completada", responsable_id: usuarioId });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.actividad.estado).toBe("completada");
    expect(respuesta.body.actividad.responsable_id).toBe(usuarioId);
    expect(respuesta.body.actividad.completada_por).toBe(usuarioId);
    expect(respuesta.body.actividad.completada_en).not.toBeNull();
  });

  test("asigna fecha de inicio y fin a una actividad", async () => {
    const respuesta = await request(app)
      .put(`/proyectos/${proyectoId}/actividades/${actividadId}`)
      .set(autorizacion())
      .send({ fecha_inicio: "2026-11-10", fecha_fin: "2026-11-14" });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.actividad.fecha_inicio).toMatch(/^2026-11-10/);
    expect(respuesta.body.actividad.fecha_fin).toMatch(/^2026-11-14/);
  });

  test("rechaza una fecha final anterior a la de inicio", async () => {
    const respuesta = await request(app)
      .put(`/proyectos/${proyectoId}/actividades/${actividadId}`)
      .set(autorizacion())
      .send({ fecha_inicio: "2026-11-10", fecha_fin: "2026-11-01" });
    expect(respuesta.status).toBe(400);
  });

  test("agrega una actividad manual (fuera del catálogo) en la fase actual", async () => {
    const respuesta = await request(app)
      .post(`/proyectos/${proyectoId}/actividades`)
      .set(autorizacion())
      .send({ categoria: "Ad-hoc", descripcion: "Actividad agregada manualmente" });
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.actividad.fase).toBe("diseno");
    expect(respuesta.body.actividad.estado).toBe("pendiente");
  });

  test("rechaza agregar actividades a un proyecto inexistente", async () => {
    const respuesta = await request(app)
      .post("/proyectos/999999999/actividades")
      .set(autorizacion())
      .send({ categoria: "Ad-hoc", descripcion: "No debería crearse" });
    expect(respuesta.status).toBe(404);
  });

  test("elimina (soft-delete) una actividad", async () => {
    const lista = await request(app)
      .get(`/proyectos/${proyectoId}/actividades`)
      .set(autorizacion());
    const ultima = lista.body.actividades[lista.body.actividades.length - 1];

    const respuesta = await request(app)
      .delete(`/proyectos/${proyectoId}/actividades/${ultima.id}`)
      .set(autorizacion());
    expect(respuesta.status).toBe(204);

    const listaFinal = await request(app)
      .get(`/proyectos/${proyectoId}/actividades`)
      .set(autorizacion());
    expect(listaFinal.body.actividades.find((a) => a.id === ultima.id)).toBeUndefined();
  });
});
