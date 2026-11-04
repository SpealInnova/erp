const request = require("supertest");
const { crearApp } = require("../../src/app");

describe("GET /health, GET /estado y GET / (integración)", () => {
  const app = crearApp();

  test("/health responde 200 ok", async () => {
    const respuesta = await request(app).get("/health");
    expect(respuesta.status).toBe(200);
    expect(respuesta.text).toBe("ok");
  });

  test("/estado responde con el estado del proyecto", async () => {
    const respuesta = await request(app).get("/estado");
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.proyecto).toBe("SPEAL Project Control");
    expect(respuesta.body.estado).toBe("funcionando");
  });

  test("/ redirige a /login", async () => {
    const respuesta = await request(app).get("/");
    expect(respuesta.status).toBe(302);
    expect(respuesta.headers.location).toBe("/login");
  });
});
