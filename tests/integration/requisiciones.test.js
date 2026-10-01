const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { crearApp } = require("../../src/app");
const { crearPool } = require("../../src/config/db");

const hayBaseDeDatos = Boolean(process.env.DB_HOST);
const describirSiHayBD = hayBaseDeDatos ? describe : describe.skip;

describirSiHayBD("CRUD de Requisiciones (integración contra BD real)", () => {
  let app;
  let pool;
  let usuarioId;
  let clienteId;
  let proyectoId;
  let token;
  const correoUsuario = `requisiciones-test-${Date.now()}@speal.test`;
  const anioActual = new Date().getFullYear();

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
      ["Cliente para Requisiciones", `REQ-TEST-${Date.now()}`, usuarioId]
    );
    clienteId = cliente.insertId;

    const [proyecto] = await pool.query(
      `INSERT INTO proyectos (codigo_pry, cliente_id, nombre_proyecto, estado, responsable_id)
       VALUES (?, ?, 'Proyecto para Requisiciones', 'prospecto', ?)`,
      [`PRY-${Date.now()}`, clienteId, usuarioId]
    );
    proyectoId = proyecto.insertId;

    app = crearApp();
  });

  afterAll(async () => {
    await pool.query("DELETE FROM auditoria WHERE usuario_id = ?", [usuarioId]);
    await pool.query(
      "DELETE FROM requisicion_items WHERE requisicion_id IN (SELECT id FROM requisiciones WHERE solicitante_id = ?)",
      [usuarioId]
    );
    await pool.query("DELETE FROM requisiciones WHERE solicitante_id = ?", [usuarioId]);
    await pool.query("DELETE FROM proyectos WHERE id = ?", [proyectoId]);
    await pool.query("DELETE FROM clientes WHERE id = ?", [clienteId]);
    await pool.query("DELETE FROM usuarios WHERE id = ?", [usuarioId]);
    await pool.end();
  });

  const autorizacion = () => ({ Authorization: `Bearer ${token}` });
  let requisicionId;

  test("rechaza crear con un proyecto inexistente", async () => {
    const respuesta = await request(app)
      .post("/requisiciones")
      .set(autorizacion())
      .send({
        proyecto_id: 999999999,
        procedencia: "nacional",
        items: [{ descripcion: "Tubería PVC", cantidad: 10, unidad: "metros" }],
      });
    expect(respuesta.status).toBe(400);
  });

  test("crea una requisición con el solicitante tomado del usuario autenticado", async () => {
    const respuesta = await request(app)
      .post("/requisiciones")
      .set(autorizacion())
      .send({
        proyecto_id: proyectoId,
        procedencia: "nacional",
        items: [{ descripcion: "Tubería PVC", cantidad: 10, unidad: "metros" }],
      });

    expect(respuesta.status).toBe(201);
    requisicionId = respuesta.body.requisicion.id;
    expect(respuesta.body.requisicion.numero_requisicion).toMatch(
      new RegExp(`^REQ-${anioActual}-\\d{3}$`)
    );
    expect(respuesta.body.requisicion.solicitante_id).toBe(usuarioId);
    expect(respuesta.body.requisicion.estado).toBe("solicitada");
  });

  test("rechaza un salto de estado inválido", async () => {
    const respuesta = await request(app)
      .patch(`/requisiciones/${requisicionId}/estado`)
      .set(autorizacion())
      .send({ estado: "cerrada" });
    expect(respuesta.status).toBe(409);
  });

  test("avanza solicitada -> en_cotizacion", async () => {
    const respuesta = await request(app)
      .patch(`/requisiciones/${requisicionId}/estado`)
      .set(autorizacion())
      .send({ estado: "en_cotizacion" });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.requisicion.estado).toBe("en_cotizacion");
  });

  test("ya no se puede editar fuera de solicitada", async () => {
    const respuesta = await request(app)
      .put(`/requisiciones/${requisicionId}`)
      .set(autorizacion())
      .send({ procedencia: "importacion" });
    expect(respuesta.status).toBe(409);
  });
});
