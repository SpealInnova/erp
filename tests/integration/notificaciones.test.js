const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { crearApp } = require("../../src/app");
const { crearPool } = require("../../src/config/db");
const { sufijoUnico } = require("../helpers/unico");

jest.mock("../../src/servicios/correo", () => ({
  enviarCorreo: jest.fn().mockResolvedValue(undefined),
}));
const correo = require("../../src/servicios/correo");

const hayBaseDeDatos = Boolean(process.env.DB_HOST);
const describirSiHayBD = hayBaseDeDatos ? describe : describe.skip;

describirSiHayBD("Notificaciones (integración contra BD real)", () => {
  let app;
  let pool;
  let responsableId;
  let colaboradorId;
  let clienteId;
  let proyectoId;
  let tokenResponsable;
  let tokenColaborador;
  const correoResponsable = `notif-responsable-${Date.now()}@speal.test`;
  const correoColaborador = `notif-colaborador-${Date.now()}@speal.test`;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "secreto-de-pruebas";
    pool = crearPool();

    const passwordHash = await bcrypt.hash("ClaveSegura123", 10);
    const [responsable] = await pool.query(
      "INSERT INTO usuarios (nombre, correo, password_hash, rol, activo) VALUES (?, ?, ?, 'tester', 1)",
      ["Responsable de prueba", correoResponsable, passwordHash]
    );
    responsableId = responsable.insertId;
    tokenResponsable = jwt.sign(
      { id: responsableId, correo: correoResponsable, rol: "tester" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const [colaborador] = await pool.query(
      "INSERT INTO usuarios (nombre, correo, password_hash, rol, activo) VALUES (?, ?, ?, 'tester', 1)",
      ["Colaborador de prueba", correoColaborador, passwordHash]
    );
    colaboradorId = colaborador.insertId;
    tokenColaborador = jwt.sign(
      { id: colaboradorId, correo: correoColaborador, rol: "tester" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const [cliente] = await pool.query(
      `INSERT INTO clientes (nombre_razon_social, tipo_identificacion, numero_identificacion, created_by)
       VALUES (?, 'NIT', ?, ?)`,
      ["Cliente para Notificaciones", `NOTIF-TEST-${Date.now()}`, responsableId]
    );
    clienteId = cliente.insertId;

    app = crearApp();
  });

  afterAll(async () => {
    await pool.query("DELETE FROM notificaciones WHERE usuario_id IN (?, ?)", [
      responsableId,
      colaboradorId,
    ]);
    await pool.query("DELETE FROM proyecto_actividades WHERE proyecto_id = ?", [proyectoId]);
    await pool.query("DELETE FROM auditoria WHERE usuario_id = ?", [responsableId]);
    await pool.query("DELETE FROM proyectos WHERE id = ?", [proyectoId]);
    await pool.query("DELETE FROM clientes WHERE id = ?", [clienteId]);
    await pool.query("DELETE FROM usuarios WHERE id IN (?, ?)", [responsableId, colaboradorId]);
    await pool.end();
  });

  const autorizacion = (token) => ({ Authorization: `Bearer ${token}` });

  test("un usuario sin notificaciones recibe lista vacía y no_leidas en 0", async () => {
    const respuesta = await request(app)
      .get("/notificaciones")
      .set(autorizacion(tokenColaborador));
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.notificaciones).toEqual([]);
    expect(respuesta.body.no_leidas).toBe(0);
  });

  test("el cambio de fase de un proyecto notifica al responsable y envía correo", async () => {
    const crear = await request(app)
      .post("/proyectos")
      .set(autorizacion(tokenResponsable))
      .send({
        cliente_id: clienteId,
        responsable_id: responsableId,
        nombre_proyecto: `Proyecto notificaciones ${sufijoUnico()}`,
      });
    proyectoId = crear.body.proyecto.id;

    await request(app)
      .patch(`/proyectos/${proyectoId}/estado`)
      .set(autorizacion(tokenResponsable))
      .send({ estado: "planeacion" });

    const respuesta = await request(app)
      .get("/notificaciones")
      .set(autorizacion(tokenResponsable));
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.no_leidas).toBeGreaterThanOrEqual(1);

    const notificacion = respuesta.body.notificaciones.find(
      (n) => n.tipo === "proyecto_cambio_fase"
    );
    expect(notificacion).toBeDefined();
    expect(notificacion.mensaje).toContain("planeacion");
    expect(correo.enviarCorreo).toHaveBeenCalled();
  });

  test("asignar un responsable a una actividad lo notifica sin enviar correo", async () => {
    correo.enviarCorreo.mockClear();

    const lista = await request(app)
      .get(`/proyectos/${proyectoId}/actividades`)
      .set(autorizacion(tokenResponsable));
    const actividadId = lista.body.actividades[0].id;

    await request(app)
      .put(`/proyectos/${proyectoId}/actividades/${actividadId}`)
      .set(autorizacion(tokenResponsable))
      .send({ responsable_id: colaboradorId });

    const respuesta = await request(app)
      .get("/notificaciones")
      .set(autorizacion(tokenColaborador));
    expect(respuesta.status).toBe(200);
    const notificacion = respuesta.body.notificaciones.find(
      (n) => n.tipo === "actividad_asignada"
    );
    expect(notificacion).toBeDefined();
    expect(correo.enviarCorreo).not.toHaveBeenCalled();
  });

  test("marca una notificación como leída y descuenta el contador", async () => {
    const antes = await request(app)
      .get("/notificaciones")
      .set(autorizacion(tokenColaborador));
    const noLeidasAntes = antes.body.no_leidas;
    const notificacionId = antes.body.notificaciones[0].id;

    const marcar = await request(app)
      .patch(`/notificaciones/${notificacionId}/leida`)
      .set(autorizacion(tokenColaborador));
    expect(marcar.status).toBe(204);

    const despues = await request(app)
      .get("/notificaciones")
      .set(autorizacion(tokenColaborador));
    expect(despues.body.no_leidas).toBe(noLeidasAntes - 1);
  });

  test("rechaza marcar como leída una notificación de otro usuario", async () => {
    const lista = await request(app)
      .get("/notificaciones")
      .set(autorizacion(tokenResponsable));
    const notificacionId = lista.body.notificaciones[0].id;

    const respuesta = await request(app)
      .patch(`/notificaciones/${notificacionId}/leida`)
      .set(autorizacion(tokenColaborador));
    expect(respuesta.status).toBe(404);
  });

  test("marca todas las notificaciones como leídas", async () => {
    const marcar = await request(app)
      .patch("/notificaciones/leer-todas")
      .set(autorizacion(tokenResponsable));
    expect(marcar.status).toBe(204);

    const respuesta = await request(app)
      .get("/notificaciones")
      .set(autorizacion(tokenResponsable));
    expect(respuesta.body.no_leidas).toBe(0);
  });
});
