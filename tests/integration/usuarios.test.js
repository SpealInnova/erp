const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { crearApp } = require("../../src/app");
const { crearPool } = require("../../src/config/db");

const hayBaseDeDatos = Boolean(process.env.DB_HOST);
const describirSiHayBD = hayBaseDeDatos ? describe : describe.skip;

describirSiHayBD("Listado de usuarios (integración contra BD real)", () => {
  let app;
  let pool;
  let usuarioId;
  let token;
  const correoUsuario = `usuarios-test-${Date.now()}@speal.test`;

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
    await pool.query("DELETE FROM usuarios WHERE id = ?", [usuarioId]);
    await pool.end();
  });

  test("rechaza sin token", async () => {
    const respuesta = await request(app).get("/usuarios");
    expect(respuesta.status).toBe(401);
  });

  test("lista usuarios activos sin exponer la contraseña", async () => {
    const respuesta = await request(app)
      .get("/usuarios")
      .set("Authorization", `Bearer ${token}`);
    expect(respuesta.status).toBe(200);
    const encontrado = respuesta.body.usuarios.find((u) => u.id === usuarioId);
    expect(encontrado).toBeDefined();
    expect(encontrado.password_hash).toBeUndefined();
  });
});
