const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { crearApp } = require("../../src/app");
const { crearPool } = require("../../src/config/db");

const hayBaseDeDatos = Boolean(process.env.DB_HOST);
const describirSiHayBD = hayBaseDeDatos ? describe : describe.skip;

describirSiHayBD("CRUD de Clientes (integración contra BD real)", () => {
  let app;
  let pool;
  let usuarioId;
  let token;
  const correoUsuario = `clientes-test-${Date.now()}@speal.test`;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "secreto-de-pruebas";

    pool = crearPool();
    const passwordHash = await bcrypt.hash("ClaveSegura123", 10);
    const [resultado] = await pool.query(
      "INSERT INTO usuarios (nombre, correo, password_hash, rol, activo) VALUES (?, ?, ?, 'tester', 1)",
      ["Usuario de prueba", correoUsuario, passwordHash]
    );
    usuarioId = resultado.insertId;
    token = jwt.sign(
      { id: usuarioId, correo: correoUsuario, rol: "tester" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    app = crearApp();
  });

  afterAll(async () => {
    await pool.query("DELETE FROM auditoria WHERE usuario_id = ?", [usuarioId]);
    await pool.query("DELETE FROM clientes WHERE created_by = ?", [usuarioId]);
    await pool.query("DELETE FROM usuarios WHERE id = ?", [usuarioId]);
    await pool.end();
  });

  const autorizacion = () => ({ Authorization: `Bearer ${token}` });
  let clienteId;
  const numeroIdentificacion = `TEST-${Date.now()}`;

  test("rechaza la creación sin token", async () => {
    const respuesta = await request(app).post("/clientes").send({});
    expect(respuesta.status).toBe(401);
  });

  test("crea un cliente y deja un registro en auditoria", async () => {
    const respuesta = await request(app)
      .post("/clientes")
      .set(autorizacion())
      .send({
        nombre_razon_social: "Cliente de Prueba S.A.S.",
        tipo_identificacion: "NIT",
        numero_identificacion: numeroIdentificacion,
        pais: "Colombia",
        ciudad: "Bogotá",
      });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.cliente.id).toBeDefined();
    clienteId = respuesta.body.cliente.id;

    const [filas] = await pool.query(
      "SELECT * FROM auditoria WHERE tabla = 'clientes' AND registro_id = ? AND accion = 'crear'",
      [clienteId]
    );
    expect(filas.length).toBe(1);
    expect(filas[0].usuario_id).toBe(usuarioId);
  });

  test("rechaza un segundo cliente con el mismo número de identificación", async () => {
    const respuesta = await request(app)
      .post("/clientes")
      .set(autorizacion())
      .send({
        nombre_razon_social: "Otro Cliente",
        tipo_identificacion: "NIT",
        numero_identificacion: numeroIdentificacion,
      });
    expect(respuesta.status).toBe(409);
  });

  test("obtiene el cliente por id", async () => {
    const respuesta = await request(app).get(`/clientes/${clienteId}`).set(autorizacion());
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.cliente.numero_identificacion).toBe(numeroIdentificacion);
  });

  test("lista clientes e incluye el creado", async () => {
    const respuesta = await request(app).get("/clientes").set(autorizacion());
    expect(respuesta.status).toBe(200);
    const encontrado = respuesta.body.clientes.find((c) => c.id === clienteId);
    expect(encontrado).toBeDefined();
  });

  test("actualiza el cliente y deja un registro en auditoria", async () => {
    const respuesta = await request(app)
      .put(`/clientes/${clienteId}`)
      .set(autorizacion())
      .send({ ciudad: "Medellín" });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.cliente.ciudad).toBe("Medellín");

    const [filas] = await pool.query(
      "SELECT * FROM auditoria WHERE tabla = 'clientes' AND registro_id = ? AND accion = 'actualizar'",
      [clienteId]
    );
    expect(filas.length).toBe(1);
  });

  test("elimina (soft-delete) el cliente y ya no aparece en el listado", async () => {
    const respuesta = await request(app).delete(`/clientes/${clienteId}`).set(autorizacion());
    expect(respuesta.status).toBe(204);

    const obtener = await request(app).get(`/clientes/${clienteId}`).set(autorizacion());
    expect(obtener.status).toBe(404);

    const [filas] = await pool.query(
      "SELECT * FROM auditoria WHERE tabla = 'clientes' AND registro_id = ? AND accion = 'eliminar'",
      [clienteId]
    );
    expect(filas.length).toBe(1);
  });
});
