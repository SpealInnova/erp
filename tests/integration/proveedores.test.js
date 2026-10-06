const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { crearApp } = require("../../src/app");
const { crearPool } = require("../../src/config/db");

const hayBaseDeDatos = Boolean(process.env.DB_HOST);
const describirSiHayBD = hayBaseDeDatos ? describe : describe.skip;

describirSiHayBD("CRUD de Proveedores (integración contra BD real)", () => {
  let app;
  let pool;
  let usuarioId;
  let token;
  const correoUsuario = `proveedores-test-${Date.now()}@speal.test`;
  const nitCc = `PROV-TEST-${Date.now()}`;

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
    app = crearApp();
  });

  afterAll(async () => {
    await pool.query("DELETE FROM auditoria WHERE usuario_id = ?", [usuarioId]);
    await pool.query("DELETE FROM proveedores WHERE created_by = ?", [usuarioId]);
    await pool.query("DELETE FROM usuarios WHERE id = ?", [usuarioId]);
    await pool.end();
  });

  const autorizacion = () => ({ Authorization: `Bearer ${token}` });
  let proveedorId;

  test("crea un proveedor y deja un registro en auditoria", async () => {
    const respuesta = await request(app)
      .post("/proveedores")
      .set(autorizacion())
      .send({
        nit_cc: nitCc,
        razon_social: "Proveedor de Prueba S.A.S.",
        tipo_persona: "juridica",
        origen: "nacional",
        clasificacion: "productos",
        contacto_comercial_nombre: "Ana Comercial",
        documentacion_estado: { RUT: "cumple", "Camara de Comercio": "no cumple" },
      });

    expect(respuesta.status).toBe(201);
    proveedorId = respuesta.body.proveedor.id;
    expect(respuesta.body.proveedor.calificacion_actual).toBeNull();

    const [filas] = await pool.query(
      "SELECT * FROM auditoria WHERE tabla = 'proveedores' AND registro_id = ? AND accion = 'crear'",
      [proveedorId]
    );
    expect(filas.length).toBe(1);
  });

  test("ignora calificacion_actual si se intenta mandar en el body", async () => {
    const respuesta = await request(app)
      .put(`/proveedores/${proveedorId}`)
      .set(autorizacion())
      .send({ calificacion_actual: 99, razon_social: "Proveedor Actualizado" });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.proveedor.calificacion_actual).toBeNull();
    expect(respuesta.body.proveedor.razon_social).toBe("Proveedor Actualizado");
  });

  test("rechaza un segundo proveedor con el mismo nit_cc", async () => {
    const respuesta = await request(app)
      .post("/proveedores")
      .set(autorizacion())
      .send({
        nit_cc: nitCc,
        razon_social: "Otro Proveedor",
        tipo_persona: "natural",
        origen: "nacional",
        clasificacion: "servicios",
      });
    expect(respuesta.status).toBe(409);
  });

  test("obtiene el proveedor por id con su documentacion_estado", async () => {
    const respuesta = await request(app)
      .get(`/proveedores/${proveedorId}`)
      .set(autorizacion());
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.proveedor.documentacion_estado).toEqual({
      RUT: "cumple",
      "Camara de Comercio": "no cumple",
    });
  });

  test("lista proveedores e incluye el creado", async () => {
    const respuesta = await request(app).get("/proveedores").set(autorizacion());
    expect(respuesta.status).toBe(200);
    const encontrado = respuesta.body.proveedores.find((p) => p.id === proveedorId);
    expect(encontrado).toBeDefined();
  });

  test("elimina (soft-delete) el proveedor", async () => {
    const respuesta = await request(app)
      .delete(`/proveedores/${proveedorId}`)
      .set(autorizacion());
    expect(respuesta.status).toBe(204);

    const obtener = await request(app)
      .get(`/proveedores/${proveedorId}`)
      .set(autorizacion());
    expect(obtener.status).toBe(404);
  });
});
