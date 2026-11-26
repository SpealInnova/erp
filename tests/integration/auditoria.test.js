const jwt = require("jsonwebtoken");
const request = require("supertest");
const { crearApp } = require("../../src/app");
const { crearPool } = require("../../src/config/db");
const { sufijoUnico } = require("../helpers/unico");

const hayBaseDeDatos = Boolean(process.env.DB_HOST);
const describirSiHayBD = hayBaseDeDatos ? describe : describe.skip;

describirSiHayBD("Auditoría: quién cambió qué y cuándo (integración)", () => {
  let app;
  let pool;
  const sufijo = sufijoUnico();
  const u = {};
  const tokens = {};
  const ids = {};
  const razonSocial = `Cliente Auditoría ${sufijo}`;

  const como = (quien) => ({ Authorization: `Bearer ${tokens[quien]}` });
  const consultar = (quien, filtros) =>
    request(app).get("/auditoria").query(filtros).set(como(quien));

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "secreto-de-pruebas";
    pool = crearPool();
    for (const [clave, rol, cargo] of [
      ["admin", "admin", null],
      ["gerente", "tester", "Gerente General"],
      ["director", "tester", "Director de Operaciones y Producción"],
    ]) {
      const correo = `auditoria-${clave}-${sufijo}@speal.test`;
      const [r] = await pool.query(
        "INSERT INTO usuarios (nombre, correo, password_hash, rol, cargo, activo) VALUES (?, ?, 'x', ?, ?, 1)",
        [`Auditoría ${clave} ${sufijo}`, correo, rol, cargo]
      );
      u[clave] = r.insertId;
      tokens[clave] = jwt.sign({ id: r.insertId, correo, rol }, process.env.JWT_SECRET, {
        expiresIn: "1h",
      });
    }
    app = crearApp();

    // Un cliente creado y luego editado por el admin
    const creado = await request(app)
      .post("/clientes")
      .set(como("admin"))
      .send({
        nombre_razon_social: razonSocial,
        tipo_identificacion: "NIT",
        numero_identificacion: `AUD-${sufijo}`,
        ciudad: "Bogotá",
      });
    expect(creado.status).toBe(201);
    ids.cliente = creado.body.cliente.id;
    const editado = await request(app)
      .put(`/clientes/${ids.cliente}`)
      .set(como("admin"))
      .send({ ciudad: "Medellín" });
    expect(editado.status).toBe(200);

    // Un usuario creado con contraseña y luego con otro cargo
    const nuevo = await request(app)
      .post("/usuarios")
      .set(como("admin"))
      .send({
        nombre: `Persona auditada ${sufijo}`,
        correo: `auditada-${sufijo}@speal.test`,
        cedula: `CC-${sufijo}`,
        password: "ClaveSegura123",
        rol: "tester",
        cargo: "Coordinador Comercial",
      });
    expect(nuevo.status).toBe(201);
    ids.usuario = nuevo.body.usuario.id;
    const cambioCargo = await request(app)
      .put(`/usuarios/${ids.usuario}`)
      .set(como("admin"))
      .send({ cargo: "Gerente Comercial" });
    expect(cambioCargo.status).toBe(200);
  });

  afterAll(async () => {
    await pool.query("DELETE FROM auditoria WHERE usuario_id IN (?)", [Object.values(u)]);
    await pool.query("DELETE FROM clientes WHERE id = ?", [ids.cliente]);
    await pool.query("DELETE FROM usuarios WHERE id IN (?)", [[...Object.values(u), ids.usuario]]);
    await pool.end();
  });

  test("solo el admin y el Gerente General la ven", async () => {
    expect((await consultar("director", {})).status).toBe(403);
    expect((await request(app).get("/auditoria")).status).toBe(401);
    expect((await consultar("gerente", { usuario_id: u.admin })).status).toBe(200);
    const r = await consultar("admin", { usuario_id: u.admin });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ pagina: 1, tamanoPagina: 20 });
    expect(r.body.modulos).toEqual(
      expect.arrayContaining([{ tabla: "clientes", etiqueta: "Cliente" }])
    );
  });

  test("cada cambio dice qué campo pasó de qué a qué, con enlace al registro", async () => {
    const r = await consultar("admin", {
      usuario_id: u.admin,
      tabla: "clientes",
      accion: "actualizar",
    });
    expect(r.body.total).toBe(1);
    const [fila] = r.body.registros;
    expect(fila).toMatchObject({
      accion: "actualizar",
      modulo: "Cliente",
      registro_id: ids.cliente,
      documento: razonSocial,
      enlace: `#/clientes/${ids.cliente}`,
      usuario_nombre: `Auditoría admin ${sufijo}`,
    });
    expect(fila.cambios).toEqual([{ campo: "ciudad", antes: "Bogotá", despues: "Medellín" }]);
  });

  test("filtra por acción, texto y fechas", async () => {
    const creados = await consultar("admin", { usuario_id: u.admin, accion: "crear" });
    expect(creados.body.registros.every((x) => x.accion === "crear")).toBe(true);
    expect(creados.body.total).toBe(2); // el cliente y el usuario

    const porTexto = await consultar("admin", { q: razonSocial });
    expect(porTexto.body.registros.map((x) => x.registro_id)).toEqual([ids.cliente, ids.cliente]);

    const futuro = await consultar("admin", { usuario_id: u.admin, desde: "2999-01-01" });
    expect(futuro.body.total).toBe(0);

    const hoy = new Date().toISOString().slice(0, 10);
    const ayer = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    const conRango = await consultar("admin", { usuario_id: u.admin, desde: ayer, hasta: hoy });
    expect(conRango.body.total).toBeGreaterThanOrEqual(4);

    expect((await consultar("admin", { desde: "24/11/2026" })).status).toBe(400);
    expect((await consultar("admin", { tabla: "usuarios; DROP" })).status).toBe(400);
  });

  test("nunca muestra contraseñas ni hashes", async () => {
    const r = await consultar("admin", { usuario_id: u.admin, tabla: "usuarios" });
    expect(r.status).toBe(200);
    const cambio = r.body.registros.find((x) => x.accion === "actualizar");
    expect(cambio.cambios).toEqual([
      { campo: "cargo", antes: "Coordinador Comercial", despues: "Gerente Comercial" },
    ]);
    expect(JSON.stringify(r.body)).not.toMatch(/password|ClaveSegura|\$2[aby]\$/);
  });
});
