const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { crearApp } = require("../../src/app");
const { crearPool } = require("../../src/config/db");

const hayBaseDeDatos = Boolean(process.env.DB_HOST);
const describirSiHayBD = hayBaseDeDatos ? describe : describe.skip;

describirSiHayBD("Requisitos de entrada (integración contra BD real)", () => {
  let app;
  let pool;
  let usuarioId;
  let clienteId;
  let proyectoId;
  let expedienteId;
  let token;
  const correoUsuario = `req-entrada-test-${Date.now()}@speal.test`;

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
      ["Cliente para Requisitos", `RE-TEST-${Date.now()}`, usuarioId]
    );
    clienteId = cliente.insertId;

    const [proyecto] = await pool.query(
      `INSERT INTO proyectos (codigo_pry, cliente_id, nombre_proyecto, estado, responsable_id)
       VALUES (?, ?, 'Proyecto para Requisitos', 'prospecto', ?)`,
      [`PRY-${Date.now()}`, clienteId, usuarioId]
    );
    proyectoId = proyecto.insertId;

    const [expediente] = await pool.query(
      `INSERT INTO expedientes_diseno (codigo_expediente, proyecto_id, producto_nombre, responsable_diseno_id, estado_liberacion)
       VALUES (?, ?, 'Producto de prueba', ?, 'pendiente')`,
      [`EXP-${Date.now()}`, proyectoId, usuarioId]
    );
    expedienteId = expediente.insertId;

    app = crearApp();
  });

  afterAll(async () => {
    await pool.query("DELETE FROM auditoria WHERE usuario_id = ?", [usuarioId]);
    await pool.query("DELETE FROM requisitos_entrada WHERE expediente_id = ?", [expedienteId]);
    await pool.query("DELETE FROM expedientes_diseno WHERE id = ?", [expedienteId]);
    await pool.query("DELETE FROM proyectos WHERE id = ?", [proyectoId]);
    await pool.query("DELETE FROM clientes WHERE id = ?", [clienteId]);
    await pool.query("DELETE FROM usuarios WHERE id = ?", [usuarioId]);
    await pool.end();
  });

  const autorizacion = () => ({ Authorization: `Bearer ${token}` });
  let requisitoId;

  test("rechaza crear en un expediente inexistente", async () => {
    const respuesta = await request(app)
      .post("/expedientes-diseno/999999999/requisitos-entrada")
      .set(autorizacion())
      .send({ requisito: "Caudal mínimo" });
    expect(respuesta.status).toBe(404);
  });

  test("crea un requisito de entrada", async () => {
    const respuesta = await request(app)
      .post(`/expedientes-diseno/${expedienteId}/requisitos-entrada`)
      .set(autorizacion())
      .send({
        requisito: "Caudal mínimo",
        valor: "500 L/h",
        fuente: "Especificación del cliente",
        criterio_aceptacion: ">= 500 L/h",
        cumple: "si",
      });
    expect(respuesta.status).toBe(201);
    requisitoId = respuesta.body.requisito.id;
    expect(respuesta.body.requisito.expediente_id).toBe(expedienteId);
  });

  test("lista los requisitos del expediente", async () => {
    const respuesta = await request(app)
      .get(`/expedientes-diseno/${expedienteId}/requisitos-entrada`)
      .set(autorizacion());
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.requisitos).toHaveLength(1);
  });

  test("edita el requisito mientras el expediente sigue pendiente", async () => {
    const respuesta = await request(app)
      .put(`/expedientes-diseno/${expedienteId}/requisitos-entrada/${requisitoId}`)
      .set(autorizacion())
      .send({ cumple: "no" });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.requisito.cumple).toBe("no");
  });

  test("al liberar el expediente, ya no se pueden agregar requisitos", async () => {
    await request(app)
      .patch(`/expedientes-diseno/${expedienteId}/estado`)
      .set(autorizacion())
      .send({ estado: "aprobado" });

    const respuesta = await request(app)
      .post(`/expedientes-diseno/${expedienteId}/requisitos-entrada`)
      .set(autorizacion())
      .send({ requisito: "Otro requisito" });
    expect(respuesta.status).toBe(409);
  });
});
