const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { crearApp } = require("../../src/app");
const { crearPool } = require("../../src/config/db");
const { sufijoUnico } = require("../helpers/unico");

const hayBaseDeDatos = Boolean(process.env.DB_HOST);
const describirSiHayBD = hayBaseDeDatos ? describe : describe.skip;

describirSiHayBD("Acta de Cierre a Satisfacción (integración contra BD real)", () => {
  let app;
  let pool;
  let usuarioId;
  let clienteId;
  let proyectoId;
  let token;
  const correoUsuario = `acta-cierre-test-${Date.now()}@speal.test`;
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
      ["Cliente para Acta de Cierre", `ACS-TEST-${Date.now()}`, usuarioId]
    );
    clienteId = cliente.insertId;

    const [proyecto] = await pool.query(
      `INSERT INTO proyectos (codigo_pry, cliente_id, nombre_proyecto, estado, responsable_id)
       VALUES (?, ?, 'Proyecto para Acta de Cierre', 'prospecto', ?)`,
      [`PRY-${sufijoUnico()}`, clienteId, usuarioId]
    );
    proyectoId = proyecto.insertId;

    app = crearApp();
  });

  afterAll(async () => {
    await pool.query("DELETE FROM auditoria WHERE usuario_id = ?", [usuarioId]);
    await pool.query(
      "DELETE FROM acta_items_verificados WHERE acta_id IN (SELECT id FROM actas_cierre_satisfaccion WHERE responsable_entrega_id = ?)",
      [usuarioId]
    );
    await pool.query("DELETE FROM actas_cierre_satisfaccion WHERE responsable_entrega_id = ?", [
      usuarioId,
    ]);
    await pool.query("DELETE FROM proyectos WHERE id = ?", [proyectoId]);
    await pool.query("DELETE FROM clientes WHERE id = ?", [clienteId]);
    await pool.query("DELETE FROM usuarios WHERE id = ?", [usuarioId]);
    await pool.end();
  });

  const autorizacion = () => ({ Authorization: `Bearer ${token}` });
  let actaId;

  test("rechaza crear sin items", async () => {
    const respuesta = await request(app)
      .post("/actas-cierre-satisfaccion")
      .set(autorizacion())
      .send({
        proyecto_id: proyectoId,
        cliente_id: clienteId,
        tipo_entrega: "venta",
        tipo_documento_referencia: "orden_compra",
        objeto: "Equipo HidroSpeal 500L",
        receptor_cliente_nombre: "Juan Pérez",
        items: [],
      });
    expect(respuesta.status).toBe(400);
  });

  test("crea un acta con items y le asigna un numero_acta con el formato correcto", async () => {
    const respuesta = await request(app)
      .post("/actas-cierre-satisfaccion")
      .set(autorizacion())
      .send({
        proyecto_id: proyectoId,
        cliente_id: clienteId,
        tipo_entrega: "venta",
        tipo_documento_referencia: "orden_compra",
        numero_documento_referencia: "OC-2026-123",
        objeto: "Equipo HidroSpeal 500L",
        receptor_cliente_nombre: "Juan Pérez",
        receptor_cliente_cargo: "Jefe de Planta",
        items: [{ elemento: "Equipo HidroSpeal 500L", cantidad: 1, cumple: "si" }],
      });

    expect(respuesta.status).toBe(201);
    actaId = respuesta.body.acta.id;
    expect(respuesta.body.acta.numero_acta).toMatch(new RegExp(`^ACS-${anioActual}-\\d{3}$`));
    expect(respuesta.body.acta.responsable_entrega_id).toBe(usuarioId);
    expect(respuesta.body.acta.fecha_elaboracion).not.toBeNull();
    expect(respuesta.body.acta.items).toHaveLength(1);
  });

  test("obtiene el acta por id con sus items", async () => {
    const respuesta = await request(app)
      .get(`/actas-cierre-satisfaccion/${actaId}`)
      .set(autorizacion());
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.acta.items[0].elemento).toBe("Equipo HidroSpeal 500L");
  });

  test("edita el acta y reemplaza los items", async () => {
    const respuesta = await request(app)
      .put(`/actas-cierre-satisfaccion/${actaId}`)
      .set(autorizacion())
      .send({
        items: [
          { elemento: "Equipo HidroSpeal 500L", cantidad: 1, cumple: "si" },
          { elemento: "Manual de usuario", cantidad: 1, cumple: "si" },
        ],
      });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.acta.items).toHaveLength(2);
  });

  test("elimina (soft-delete) el acta", async () => {
    const respuesta = await request(app)
      .delete(`/actas-cierre-satisfaccion/${actaId}`)
      .set(autorizacion());
    expect(respuesta.status).toBe(204);

    const obtener = await request(app)
      .get(`/actas-cierre-satisfaccion/${actaId}`)
      .set(autorizacion());
    expect(obtener.status).toBe(404);
  });
});
