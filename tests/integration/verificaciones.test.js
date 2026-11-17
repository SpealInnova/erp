const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { crearApp } = require("../../src/app");
const { crearPool } = require("../../src/config/db");
const { sufijoUnico } = require("../helpers/unico");

const hayBaseDeDatos = Boolean(process.env.DB_HOST);
const describirSiHayBD = hayBaseDeDatos ? describe : describe.skip;

describirSiHayBD("Verificaciones (integración contra BD real)", () => {
  let app;
  let pool;
  let usuarioId;
  let clienteId;
  let proyectoId;
  let expedienteId;
  let token;
  const correoUsuario = `verificaciones-test-${Date.now()}@speal.test`;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "secreto-de-pruebas";
    pool = crearPool();

    const passwordHash = await bcrypt.hash("ClaveSegura123", 10);
    const [usuario] = await pool.query(
      "INSERT INTO usuarios (nombre, correo, password_hash, rol, cargo, activo) VALUES (?, ?, ?, 'tester', 'Gerente General', 1)",
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
      ["Cliente para Verificaciones", `VE-TEST-${Date.now()}`, usuarioId]
    );
    clienteId = cliente.insertId;

    const [proyecto] = await pool.query(
      `INSERT INTO proyectos (codigo_pry, cliente_id, nombre_proyecto, estado, responsable_id)
       VALUES (?, ?, 'Proyecto para Verificaciones', 'prospecto', ?)`,
      [`PRY-${sufijoUnico()}`, clienteId, usuarioId]
    );
    proyectoId = proyecto.insertId;

    const [expediente] = await pool.query(
      `INSERT INTO expedientes_diseno (codigo_expediente, proyecto_id, producto_nombre, responsable_diseno_id, estado_liberacion)
       VALUES (?, ?, 'Producto de prueba', ?, 'pendiente')`,
      [`EXP-${sufijoUnico()}`, proyectoId, usuarioId]
    );
    expedienteId = expediente.insertId;

    app = crearApp();
  });

  afterAll(async () => {
    await pool.query("DELETE FROM auditoria WHERE usuario_id = ?", [usuarioId]);
    await pool.query("DELETE FROM verificaciones WHERE expediente_id = ?", [expedienteId]);
    await pool.query("DELETE FROM expedientes_diseno WHERE id = ?", [expedienteId]);
    await pool.query("DELETE FROM proyectos WHERE id = ?", [proyectoId]);
    await pool.query("DELETE FROM clientes WHERE id = ?", [clienteId]);
    await pool.query("DELETE FROM usuarios WHERE id = ?", [usuarioId]);
    await pool.end();
  });

  const autorizacion = () => ({ Authorization: `Bearer ${token}` });
  let verificacionId;

  test("rechaza crear en un expediente inexistente", async () => {
    const respuesta = await request(app)
      .post("/expedientes-diseno/999999999/verificaciones")
      .set(autorizacion())
      .send({ requisito_verificado: "Caudal mínimo" });
    expect(respuesta.status).toBe(404);
  });

  test("crea una verificación", async () => {
    const respuesta = await request(app)
      .post(`/expedientes-diseno/${expedienteId}/verificaciones`)
      .set(autorizacion())
      .send({
        requisito_verificado: "Caudal mínimo",
        metodo: "Medición directa",
        criterio: ">= 500 L/h",
        resultado: "Cumple",
      });
    expect(respuesta.status).toBe(201);
    verificacionId = respuesta.body.verificacion.id;
    expect(respuesta.body.verificacion.expediente_id).toBe(expedienteId);
  });

  test("lista las verificaciones del expediente", async () => {
    const respuesta = await request(app)
      .get(`/expedientes-diseno/${expedienteId}/verificaciones`)
      .set(autorizacion());
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.verificaciones).toHaveLength(1);
  });

  test("edita la verificación mientras el expediente sigue pendiente", async () => {
    const respuesta = await request(app)
      .put(`/expedientes-diseno/${expedienteId}/verificaciones/${verificacionId}`)
      .set(autorizacion())
      .send({ resultado: "No cumple" });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.verificacion.resultado).toBe("No cumple");
  });

  test("al liberar el expediente, ya no se pueden agregar verificaciones", async () => {
    await request(app)
      .patch(`/expedientes-diseno/${expedienteId}/estado`)
      .set(autorizacion())
      .send({ estado: "aprobado" });

    const respuesta = await request(app)
      .post(`/expedientes-diseno/${expedienteId}/verificaciones`)
      .set(autorizacion())
      .send({ requisito_verificado: "Otra verificación" });
    expect(respuesta.status).toBe(409);
  });
});
