const { crearApp } = require("../../src/app");

const hayBaseDeDatos = Boolean(process.env.DB_HOST);
const describirSiHayBD = hayBaseDeDatos ? describe : describe.skip;

describirSiHayBD("GET /health/db contra una base de datos real (integración)", () => {
  const app = crearApp();
  const request = require("supertest");

  test("responde ok cuando la conexión y las migraciones son correctas", async () => {
    const respuesta = await request(app).get("/health/db");
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.estado).toBe("ok");
  });

  test("la tabla usuarios existe tras correr las migraciones", async () => {
    const { crearPool } = require("../../src/config/db");
    const pool = crearPool();
    const [filas] = await pool.query("SHOW TABLES LIKE 'usuarios'");
    expect(filas.length).toBe(1);
    await pool.end();
  });
});
