const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { crearApp } = require("../../src/app");
const { crearPool } = require("../../src/config/db");
const { sufijoUnico } = require("../helpers/unico");

const hayBaseDeDatos = Boolean(process.env.DB_HOST);
const describirSiHayBD = hayBaseDeDatos ? describe : describe.skip;

describirSiHayBD("CRUD de Expedientes de Diseño (integración contra BD real)", () => {
  let app;
  let pool;
  let usuarioId;
  let clienteId;
  let proyectoId;
  let token;
  const correoUsuario = `expediente-test-${Date.now()}@speal.test`;
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
      ["Cliente para Expediente", `EXP-TEST-${Date.now()}`, usuarioId]
    );
    clienteId = cliente.insertId;

    const [proyecto] = await pool.query(
      `INSERT INTO proyectos (codigo_pry, cliente_id, nombre_proyecto, estado, responsable_id)
       VALUES (?, ?, 'Proyecto para Expediente', 'prospecto', ?)`,
      [`PRY-${sufijoUnico()}`, clienteId, usuarioId]
    );
    proyectoId = proyecto.insertId;

    app = crearApp();
  });

  afterAll(async () => {
    await pool.query("DELETE FROM auditoria WHERE usuario_id = ?", [usuarioId]);
    await pool.query("DELETE FROM expedientes_diseno WHERE created_by = ?", [usuarioId]);
    await pool.query("DELETE FROM proyectos WHERE id = ?", [proyectoId]);
    await pool.query("DELETE FROM clientes WHERE id = ?", [clienteId]);
    await pool.query("DELETE FROM usuarios WHERE id = ?", [usuarioId]);
    await pool.end();
  });

  const autorizacion = () => ({ Authorization: `Bearer ${token}` });
  let expedienteId;
  const numeroSerie = `SN-${sufijoUnico()}`;

  test("rechaza crear con un proyecto inexistente", async () => {
    const respuesta = await request(app)
      .post("/expedientes-diseno")
      .set(autorizacion())
      .send({
        proyecto_id: 999999999,
        producto_nombre: "HidroSpeal 500L",
        responsable_diseno_id: usuarioId,
      });
    expect(respuesta.status).toBe(400);
  });

  test("crea un expediente sin numero_serie (opcional)", async () => {
    const respuesta = await request(app)
      .post("/expedientes-diseno")
      .set(autorizacion())
      .send({
        proyecto_id: proyectoId,
        producto_nombre: "HidroSpeal 500L",
        modelo: "HS-500",
        responsable_diseno_id: usuarioId,
      });

    expect(respuesta.status).toBe(201);
    expedienteId = respuesta.body.expediente.id;
    expect(respuesta.body.expediente.codigo_expediente).toMatch(
      new RegExp(`^EXP-${anioActual}-\\d{3}$`)
    );
    expect(respuesta.body.expediente.numero_serie).toBeNull();
    expect(respuesta.body.expediente.estado_liberacion).toBe("pendiente");
  });

  test("edita el expediente y le asigna numero_serie mientras está pendiente", async () => {
    const respuesta = await request(app)
      .put(`/expedientes-diseno/${expedienteId}`)
      .set(autorizacion())
      .send({ numero_serie: numeroSerie });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.expediente.numero_serie).toBe(numeroSerie);
  });

  test("rechaza un numero_serie repetido en otro expediente", async () => {
    const otro = await request(app)
      .post("/expedientes-diseno")
      .set(autorizacion())
      .send({
        proyecto_id: proyectoId,
        producto_nombre: "Otro producto",
        numero_serie: numeroSerie,
        responsable_diseno_id: usuarioId,
      });
    expect(otro.status).toBe(409);
  });

  test("libera el expediente (pendiente -> aprobado)", async () => {
    const respuesta = await request(app)
      .patch(`/expedientes-diseno/${expedienteId}/estado`)
      .set(autorizacion())
      .send({ estado: "aprobado" });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.expediente.estado_liberacion).toBe("aprobado");
  });

  test("ya no se puede editar ni volver a cambiar de estado tras liberarse", async () => {
    const editar = await request(app)
      .put(`/expedientes-diseno/${expedienteId}`)
      .set(autorizacion())
      .send({ modelo: "HS-500-v2" });
    expect(editar.status).toBe(409);

    const cambiarEstado = await request(app)
      .patch(`/expedientes-diseno/${expedienteId}/estado`)
      .set(autorizacion())
      .send({ estado: "rechazado" });
    expect(cambiarEstado.status).toBe(409);
  });
});
