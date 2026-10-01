const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { crearApp } = require("../../src/app");
const { crearPool } = require("../../src/config/db");

const hayBaseDeDatos = Boolean(process.env.DB_HOST);
const describirSiHayBD = hayBaseDeDatos ? describe : describe.skip;

describirSiHayBD("CRUD de Proyectos (integración contra BD real)", () => {
  let app;
  let pool;
  let usuarioId;
  let clienteId;
  let token;
  const correoUsuario = `proyectos-test-${Date.now()}@speal.test`;
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
      ["Cliente para Proyectos", `PRY-TEST-${Date.now()}`, usuarioId]
    );
    clienteId = cliente.insertId;

    app = crearApp();
  });

  afterAll(async () => {
    await pool.query("DELETE FROM auditoria WHERE usuario_id = ?", [usuarioId]);
    await pool.query("DELETE FROM proyectos WHERE responsable_id = ?", [usuarioId]);
    await pool.query("DELETE FROM clientes WHERE id = ?", [clienteId]);
    await pool.query("DELETE FROM usuarios WHERE id = ?", [usuarioId]);
    await pool.end();
  });

  const autorizacion = () => ({ Authorization: `Bearer ${token}` });
  let proyectoId;
  let primerCodigo;

  test("rechaza crear un proyecto con un cliente inexistente", async () => {
    const respuesta = await request(app)
      .post("/proyectos")
      .set(autorizacion())
      .send({
        cliente_id: 999999999,
        responsable_id: usuarioId,
        nombre_proyecto: "Proyecto inválido",
      });
    expect(respuesta.status).toBe(400);
  });

  test("crea un proyecto y le asigna un codigo_pry con el formato correcto", async () => {
    const respuesta = await request(app)
      .post("/proyectos")
      .set(autorizacion())
      .send({
        cliente_id: clienteId,
        responsable_id: usuarioId,
        nombre_proyecto: "Piloto Hospital de Prueba",
        linea_negocio: "HidroSpeal",
      });

    expect(respuesta.status).toBe(201);
    proyectoId = respuesta.body.proyecto.id;
    primerCodigo = respuesta.body.proyecto.codigo_pry;
    expect(primerCodigo).toMatch(new RegExp(`^PRY-${anioActual}-\\d{3}$`));
    expect(respuesta.body.proyecto.estado).toBe("prospecto");
  });

  test("el segundo proyecto del año recibe el consecutivo siguiente", async () => {
    const respuesta = await request(app)
      .post("/proyectos")
      .set(autorizacion())
      .send({
        cliente_id: clienteId,
        responsable_id: usuarioId,
        nombre_proyecto: "Segundo proyecto de prueba",
      });

    expect(respuesta.status).toBe(201);
    const numeroAnterior = Number(primerCodigo.split("-")[2]);
    const numeroNuevo = Number(respuesta.body.proyecto.codigo_pry.split("-")[2]);
    expect(numeroNuevo).toBe(numeroAnterior + 1);

    await pool.query("DELETE FROM proyectos WHERE id = ?", [respuesta.body.proyecto.id]);
  });

  test("obtiene el proyecto por id", async () => {
    const respuesta = await request(app).get(`/proyectos/${proyectoId}`).set(autorizacion());
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.proyecto.codigo_pry).toBe(primerCodigo);
  });

  test("actualiza el nombre del proyecto y queda en auditoria", async () => {
    const respuesta = await request(app)
      .put(`/proyectos/${proyectoId}`)
      .set(autorizacion())
      .send({ nombre_proyecto: "Piloto Hospital Actualizado" });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.proyecto.nombre_proyecto).toBe("Piloto Hospital Actualizado");
  });

  test("rechaza una transición de estado inválida (saltar fases)", async () => {
    const respuesta = await request(app)
      .patch(`/proyectos/${proyectoId}/estado`)
      .set(autorizacion())
      .send({ estado: "produccion" });
    expect(respuesta.status).toBe(409);
  });

  test("permite la transición válida prospecto -> planeacion", async () => {
    const respuesta = await request(app)
      .patch(`/proyectos/${proyectoId}/estado`)
      .set(autorizacion())
      .send({ estado: "planeacion" });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.proyecto.estado).toBe("planeacion");
  });

  test("elimina (soft-delete) el proyecto", async () => {
    const respuesta = await request(app).delete(`/proyectos/${proyectoId}`).set(autorizacion());
    expect(respuesta.status).toBe(204);

    const obtener = await request(app).get(`/proyectos/${proyectoId}`).set(autorizacion());
    expect(obtener.status).toBe(404);
  });
});
