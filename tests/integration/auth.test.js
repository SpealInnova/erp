const bcrypt = require("bcryptjs");
const request = require("supertest");
const { crearApp } = require("../../src/app");
const { crearPool } = require("../../src/config/db");

jest.mock("../../src/servicios/correo", () => ({
  enviarCorreo: jest.fn().mockResolvedValue(undefined),
}));
const correo = require("../../src/servicios/correo");

const hayBaseDeDatos = Boolean(process.env.DB_HOST);
const describirSiHayBD = hayBaseDeDatos ? describe : describe.skip;

describirSiHayBD("Autenticación (integración contra BD real)", () => {
  let app;
  let pool;
  let usuarioId;
  const correoPrueba = `auth-test-${Date.now()}@speal.test`;
  const passwordOriginal = "ClaveSegura123";

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "secreto-de-pruebas";
    process.env.APP_URL = process.env.APP_URL || "http://localhost:3000";

    pool = crearPool();
    const passwordHash = await bcrypt.hash(passwordOriginal, 10);
    const [resultado] = await pool.query(
      "INSERT INTO usuarios (nombre, correo, password_hash, rol, activo) VALUES (?, ?, ?, 'tester', 1)",
      ["Usuario de prueba", correoPrueba, passwordHash]
    );
    usuarioId = resultado.insertId;
    app = crearApp();
  });

  afterAll(async () => {
    await pool.query("DELETE FROM usuarios WHERE id = ?", [usuarioId]);
    await pool.end();
  });

  test("login con credenciales correctas devuelve un token", async () => {
    const respuesta = await request(app)
      .post("/auth/login")
      .send({ correo: correoPrueba, password: passwordOriginal });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.token).toBeDefined();
  });

  test("login con contraseña incorrecta devuelve 401", async () => {
    const respuesta = await request(app)
      .post("/auth/login")
      .send({ correo: correoPrueba, password: "incorrecta" });
    expect(respuesta.status).toBe(401);
  });

  test("5 intentos fallidos consecutivos bloquean al usuario (423)", async () => {
    await pool.query(
      "UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ?",
      [usuarioId]
    );
    for (let i = 0; i < 4; i += 1) {
      await request(app).post("/auth/login").send({ correo: correoPrueba, password: "mal" });
    }
    const respuesta = await request(app)
      .post("/auth/login")
      .send({ correo: correoPrueba, password: "mal" });
    expect(respuesta.status).toBe(423);
  });

  test("GET /auth/perfil sin token responde 401", async () => {
    const respuesta = await request(app).get("/auth/perfil");
    expect(respuesta.status).toBe(401);
  });

  test("GET /auth/perfil con token válido responde con el usuario", async () => {
    await pool.query(
      "UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ?",
      [usuarioId]
    );
    const loginResp = await request(app)
      .post("/auth/login")
      .send({ correo: correoPrueba, password: passwordOriginal });

    const respuesta = await request(app)
      .get("/auth/perfil")
      .set("Authorization", `Bearer ${loginResp.body.token}`);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.usuario.correo).toBe(correoPrueba);
  });

  test("solicitar recuperación guarda el token y envía el correo (mockeado)", async () => {
    const respuesta = await request(app)
      .post("/auth/solicitar-recuperacion")
      .send({ correo: correoPrueba });
    expect(respuesta.status).toBe(200);
    expect(correo.enviarCorreo).toHaveBeenCalled();
  });

  test("restablecer contraseña con el token generado funciona", async () => {
    const [filas] = await pool.query("SELECT token_recuperacion FROM usuarios WHERE id = ?", [
      usuarioId,
    ]);
    const token = filas[0].token_recuperacion;

    const respuesta = await request(app)
      .post("/auth/restablecer-password")
      .send({ token, nuevaPassword: "NuevaClave456" });
    expect(respuesta.status).toBe(200);

    const loginConNueva = await request(app)
      .post("/auth/login")
      .send({ correo: correoPrueba, password: "NuevaClave456" });
    expect(loginConNueva.status).toBe(200);
  });

  test("restablecer contraseña con un token inválido devuelve 400", async () => {
    const respuesta = await request(app)
      .post("/auth/restablecer-password")
      .send({ token: "token-que-no-existe", nuevaPassword: "OtraClave789" });
    expect(respuesta.status).toBe(400);
  });
});
