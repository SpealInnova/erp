const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { crearApp } = require("../../src/app");
const { crearPool } = require("../../src/config/db");

const hayBaseDeDatos = Boolean(process.env.DB_HOST);
const describirSiHayBD = hayBaseDeDatos ? describe : describe.skip;

describirSiHayBD("Salidas de diseño (integración contra BD real)", () => {
  let app;
  let pool;
  let usuarioId;
  let clienteId;
  let proyectoId;
  let expedienteId;
  let token;
  const correoUsuario = `salida-diseno-test-${Date.now()}@speal.test`;

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
      ["Cliente para Salidas", `SD-TEST-${Date.now()}`, usuarioId]
    );
    clienteId = cliente.insertId;

    const [proyecto] = await pool.query(
      `INSERT INTO proyectos (codigo_pry, cliente_id, nombre_proyecto, estado, responsable_id)
       VALUES (?, ?, 'Proyecto para Salidas', 'prospecto', ?)`,
      [`PRY-${Date.now()}`, clienteId, usuarioId]
    );
    proyectoId = proyecto.insertId;

    const [expediente] = await pool.query(
      `INSERT INTO expedientes_diseno (codigo_expediente, proyecto_id, producto_nombre, responsable_diseno_id, estado_liberacion)
       VALUES (?, ?, 'Producto de prueba', ?, 'pendiente')`,
      [`EXP-${Date.now()}`, proyectoId, usuarioId]
    );
    expedienteId = expediente.insertId;

    app = crearApp();
  });

  afterAll(async () => {
    await pool.query("DELETE FROM auditoria WHERE usuario_id = ?", [usuarioId]);
    await pool.query("DELETE FROM salidas_diseno WHERE expediente_id = ?", [expedienteId]);
    await pool.query("DELETE FROM expedientes_diseno WHERE id = ?", [expedienteId]);
    await pool.query("DELETE FROM proyectos WHERE id = ?", [proyectoId]);
    await pool.query("DELETE FROM clientes WHERE id = ?", [clienteId]);
    await pool.query("DELETE FROM usuarios WHERE id = ?", [usuarioId]);
    await pool.end();
  });

  const autorizacion = () => ({ Authorization: `Bearer ${token}` });
  let salidaId;

  test("rechaza crear con un responsable inexistente", async () => {
    const respuesta = await request(app)
      .post(`/expedientes-diseno/${expedienteId}/salidas-diseno`)
      .set(autorizacion())
      .send({ salida: "Plano general", responsable_id: 999999999 });
    expect(respuesta.status).toBe(400);
  });

  test("crea una salida de diseño", async () => {
    const respuesta = await request(app)
      .post(`/expedientes-diseno/${expedienteId}/salidas-diseno`)
      .set(autorizacion())
      .send({
        salida: "Plano general",
        codigo_version: "v1.0",
        responsable_id: usuarioId,
        fecha: "2026-10-01",
        estado: "borrador",
      });
    expect(respuesta.status).toBe(201);
    salidaId = respuesta.body.salida.id;
    expect(respuesta.body.salida.expediente_id).toBe(expedienteId);
  });

  test("lista las salidas del expediente", async () => {
    const respuesta = await request(app)
      .get(`/expedientes-diseno/${expedienteId}/salidas-diseno`)
      .set(autorizacion());
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.salidas).toHaveLength(1);
  });

  test("edita la salida mientras el expediente sigue pendiente", async () => {
    const respuesta = await request(app)
      .put(`/expedientes-diseno/${expedienteId}/salidas-diseno/${salidaId}`)
      .set(autorizacion())
      .send({ estado: "aprobado" });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.salida.estado).toBe("aprobado");
  });

  test("al liberar el expediente, ya no se pueden agregar salidas", async () => {
    await request(app)
      .patch(`/expedientes-diseno/${expedienteId}/estado`)
      .set(autorizacion())
      .send({ estado: "aprobado" });

    const respuesta = await request(app)
      .post(`/expedientes-diseno/${expedienteId}/salidas-diseno`)
      .set(autorizacion())
      .send({ salida: "Otro documento", responsable_id: usuarioId });
    expect(respuesta.status).toBe(409);
  });
});
