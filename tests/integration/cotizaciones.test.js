const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { crearApp } = require("../../src/app");
const { crearPool } = require("../../src/config/db");

const hayBaseDeDatos = Boolean(process.env.DB_HOST);
const describirSiHayBD = hayBaseDeDatos ? describe : describe.skip;

describirSiHayBD("CRUD de Cotizaciones (integración contra BD real)", () => {
  let app;
  let pool;
  let usuarioId;
  let clienteId;
  let token;
  const correoUsuario = `cotizaciones-test-${Date.now()}@speal.test`;
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
      ["Cliente para Cotizaciones", `COT-TEST-${Date.now()}`, usuarioId]
    );
    clienteId = cliente.insertId;

    app = crearApp();
  });

  afterAll(async () => {
    await pool.query("DELETE FROM auditoria WHERE usuario_id = ?", [usuarioId]);
    await pool.query(
      "DELETE FROM cotizacion_items WHERE cotizacion_id IN (SELECT id FROM cotizaciones WHERE asesor_comercial_id = ?)",
      [usuarioId]
    );
    await pool.query("DELETE FROM cotizaciones WHERE asesor_comercial_id = ?", [usuarioId]);
    await pool.query("DELETE FROM clientes WHERE id = ?", [clienteId]);
    await pool.query("DELETE FROM usuarios WHERE id = ?", [usuarioId]);
    await pool.end();
  });

  const autorizacion = () => ({ Authorization: `Bearer ${token}` });
  let cotizacionId;

  test("rechaza crear sin items", async () => {
    const respuesta = await request(app)
      .post("/cotizaciones")
      .set(autorizacion())
      .send({ cliente_id: clienteId, asesor_comercial_id: usuarioId, items: [] });
    expect(respuesta.status).toBe(400);
  });

  test("crea una cotización con items y le asigna un número con el formato correcto", async () => {
    const respuesta = await request(app)
      .post("/cotizaciones")
      .set(autorizacion())
      .send({
        cliente_id: clienteId,
        asesor_comercial_id: usuarioId,
        items: [
          { descripcion: "Equipo HidroSpeal 500L", cantidad: 1, valor_unitario: 15000000 },
          { descripcion: "Instalación", cantidad: 1, valor_unitario: 1500000, iva_porcentaje: 19 },
        ],
      });

    expect(respuesta.status).toBe(201);
    cotizacionId = respuesta.body.cotizacion.id;
    expect(respuesta.body.cotizacion.numero_cotizacion).toMatch(
      new RegExp(`^COT-${anioActual}-\\d{3}$`)
    );
    expect(respuesta.body.cotizacion.estado).toBe("borrador");
    expect(respuesta.body.cotizacion.items).toHaveLength(2);
  });

  test("edita la cotización mientras está en borrador", async () => {
    const respuesta = await request(app)
      .put(`/cotizaciones/${cotizacionId}`)
      .set(autorizacion())
      .send({
        items: [{ descripcion: "Equipo HidroSpeal 1000L", cantidad: 1, valor_unitario: 20000000 }],
      });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.cotizacion.items).toHaveLength(1);
    expect(respuesta.body.cotizacion.items[0].descripcion).toBe("Equipo HidroSpeal 1000L");
  });

  test("rechaza un salto de estado inválido (borrador -> enviada)", async () => {
    const respuesta = await request(app)
      .patch(`/cotizaciones/${cotizacionId}/estado`)
      .set(autorizacion())
      .send({ estado: "enviada" });
    expect(respuesta.status).toBe(409);
  });

  test("avanza borrador -> revisión", async () => {
    const respuesta = await request(app)
      .patch(`/cotizaciones/${cotizacionId}/estado`)
      .set(autorizacion())
      .send({ estado: "revision" });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.cotizacion.estado).toBe("revision");
  });

  test("ya no se puede editar fuera de borrador", async () => {
    const respuesta = await request(app)
      .put(`/cotizaciones/${cotizacionId}`)
      .set(autorizacion())
      .send({ fecha_validez: "2026-12-31" });
    expect(respuesta.status).toBe(409);
  });

  test("elimina (soft-delete) la cotización", async () => {
    const respuesta = await request(app)
      .delete(`/cotizaciones/${cotizacionId}`)
      .set(autorizacion());
    expect(respuesta.status).toBe(204);

    const obtener = await request(app)
      .get(`/cotizaciones/${cotizacionId}`)
      .set(autorizacion());
    expect(obtener.status).toBe(404);
  });
});
