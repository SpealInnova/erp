const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { crearApp } = require("../../src/app");
const { crearPool } = require("../../src/config/db");
const { sufijoUnico } = require("../helpers/unico");

const hayBaseDeDatos = Boolean(process.env.DB_HOST);
const describirSiHayBD = hayBaseDeDatos ? describe : describe.skip;

describirSiHayBD("Acta de Entrega de Equipos (integración contra BD real)", () => {
  let app;
  let pool;
  let usuarioId;
  let clienteId;
  let proyectoId;
  let expedienteId;
  let numeroSerie;
  let token;
  const correoUsuario = `acta-entrega-test-${Date.now()}@speal.test`;
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
      ["Cliente para Acta de Entrega", `AEE-TEST-${Date.now()}`, usuarioId]
    );
    clienteId = cliente.insertId;

    const [proyecto] = await pool.query(
      `INSERT INTO proyectos (codigo_pry, cliente_id, nombre_proyecto, estado, responsable_id)
       VALUES (?, ?, 'Proyecto para Acta de Entrega', 'prospecto', ?)`,
      [`PRY-${sufijoUnico()}`, clienteId, usuarioId]
    );
    proyectoId = proyecto.insertId;

    numeroSerie = `SN-AEE-${sufijoUnico()}`;
    const [expediente] = await pool.query(
      `INSERT INTO expedientes_diseno
        (codigo_expediente, proyecto_id, producto_nombre, numero_serie, responsable_diseno_id, estado_liberacion)
       VALUES (?, ?, 'Producto para Acta de Entrega', ?, ?, 'aprobado')`,
      [`EXP-${sufijoUnico()}`, proyectoId, numeroSerie, usuarioId]
    );
    expedienteId = expediente.insertId;

    app = crearApp();
  });

  afterAll(async () => {
    await pool.query("DELETE FROM auditoria WHERE usuario_id = ?", [usuarioId]);
    await pool.query(
      "DELETE FROM acta_entrega_items WHERE acta_id IN (SELECT id FROM actas_entrega_equipos WHERE entregante_id = ?)",
      [usuarioId]
    );
    await pool.query("DELETE FROM actas_entrega_equipos WHERE entregante_id = ?", [usuarioId]);
    await pool.query("DELETE FROM expedientes_diseno WHERE id = ?", [expedienteId]);
    await pool.query("DELETE FROM proyectos WHERE id = ?", [proyectoId]);
    await pool.query("DELETE FROM clientes WHERE id = ?", [clienteId]);
    await pool.query("DELETE FROM usuarios WHERE id = ?", [usuarioId]);
    await pool.end();
  });

  const autorizacion = () => ({ Authorization: `Bearer ${token}` });
  let actaId;

  test("rechaza crear sin equipos", async () => {
    const respuesta = await request(app)
      .post("/actas-entrega-equipos")
      .set(autorizacion())
      .send({
        proyecto_id: proyectoId,
        cliente_id: clienteId,
        objeto: "Entrega de equipo HidroSpeal",
        receptor_nombre: "Juan Pérez",
        items: [],
      });
    expect(respuesta.status).toBe(400);
  });

  test("crea un acta con equipos, numero_acta correcto y entregante automático", async () => {
    const respuesta = await request(app)
      .post("/actas-entrega-equipos")
      .set(autorizacion())
      .send({
        proyecto_id: proyectoId,
        cliente_id: clienteId,
        numero_contrato_oc: "OC-2026-123",
        objeto: "Entrega de equipo HidroSpeal",
        lugar_entrega: "Planta del cliente",
        receptor_nombre: "Juan Pérez",
        receptor_identificacion: "CC 123456",
        receptor_cargo: "Jefe de Planta",
        items: [
          {
            descripcion_equipo: "Equipo HidroSpeal 500L",
            cantidad: 1,
            marca: "SPEAL",
            modelo: "HS-500",
            numero_serie: numeroSerie,
            cumple: "si",
          },
          {
            descripcion_equipo: "Manual de usuario",
            cantidad: 1,
            cumple: "si",
          },
        ],
      });

    expect(respuesta.status).toBe(201);
    actaId = respuesta.body.acta.id;
    expect(respuesta.body.acta.numero_acta).toMatch(new RegExp(`^AEE-${anioActual}-\\d{3}$`));
    expect(respuesta.body.acta.entregante_id).toBe(usuarioId);
    expect(respuesta.body.acta.fecha_elaboracion).not.toBeNull();
    expect(respuesta.body.acta.items).toHaveLength(2);
  });

  test("el ítem con numero_serie existente queda enlazado al Expediente de Diseño", async () => {
    const respuesta = await request(app)
      .get(`/actas-entrega-equipos/${actaId}`)
      .set(autorizacion());
    expect(respuesta.status).toBe(200);
    const itemConSerie = respuesta.body.acta.items.find((i) => i.numero_serie === numeroSerie);
    expect(itemConSerie.expediente_id).toBe(expedienteId);
  });

  test("un ítem con numero_serie que no existe se permite igual, sin enlazar", async () => {
    const respuesta = await request(app)
      .get(`/actas-entrega-equipos/${actaId}`)
      .set(autorizacion());
    const itemSinSerie = respuesta.body.acta.items.find((i) => i.descripcion_equipo === "Manual de usuario");
    expect(itemSinSerie.expediente_id).toBeNull();
  });

  test("edita el acta y reemplaza los equipos", async () => {
    const respuesta = await request(app)
      .put(`/actas-entrega-equipos/${actaId}`)
      .set(autorizacion())
      .send({
        items: [
          { descripcion_equipo: "Equipo HidroSpeal 500L", cantidad: 1, cumple: "si" },
        ],
      });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.acta.items).toHaveLength(1);
  });

  test("elimina (soft-delete) el acta", async () => {
    const respuesta = await request(app)
      .delete(`/actas-entrega-equipos/${actaId}`)
      .set(autorizacion());
    expect(respuesta.status).toBe(204);

    const obtener = await request(app)
      .get(`/actas-entrega-equipos/${actaId}`)
      .set(autorizacion());
    expect(obtener.status).toBe(404);
  });
});
