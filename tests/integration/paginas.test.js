const request = require("supertest");
const { crearApp } = require("../../src/app");

describe("Páginas de acceso (sin base de datos)", () => {
  const app = crearApp();

  test("/login sirve la pantalla de inicio de sesión", async () => {
    const respuesta = await request(app).get("/login");
    expect(respuesta.status).toBe(200);
    expect(respuesta.headers["content-type"]).toMatch(/text\/html/);
    expect(respuesta.text).toContain("Entrar");
  });

  test("/restablecer-password sirve la pantalla de nueva contraseña", async () => {
    const respuesta = await request(app).get("/restablecer-password?token=abc");
    expect(respuesta.status).toBe(200);
    expect(respuesta.text).toContain("Guardar contraseña");
  });

  test("/inicio sirve la pantalla de inicio", async () => {
    const respuesta = await request(app).get("/inicio");
    expect(respuesta.status).toBe(200);
  });

  test("los estilos y scripts se sirven como archivos estáticos", async () => {
    const css = await request(app).get("/css/estilos.css");
    expect(css.status).toBe(200);
    expect(css.headers["content-type"]).toMatch(/text\/css/);

    const js = await request(app).get("/js/login.js");
    expect(js.status).toBe(200);
  });
});
