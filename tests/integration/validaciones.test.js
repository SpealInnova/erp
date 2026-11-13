const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { crearApp } = require("../../src/app");
const { crearPool } = require("../../src/config/db");
const { sufijoUnico } = require("../helpers/unico");

const hayBaseDeDatos = Boolean(process.env.DB_HOST);
const describirSiHayBD = hayBaseDeDatos ? describe : describe.skip;

describirSiHayBD("Validaciones (integración contra BD real)", () => {
  let app;
  let pool;
  let usuarioId;
  let clienteId;
  let proyectoId;
  let expedienteId;
  let token;
  const correoUsuario = `validaciones-test-${Date.now()}@speal.test`;

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
      ["Cliente para Validaciones", `VA-TEST-${Date.now()}`, usuarioId]
    );
    clienteId = cliente.insertId;

    const [proyecto] = await pool.query(
      `INSERT INTO proyectos (codigo_pry, cliente_id, nombre_proyecto, estado, responsable_id)
       VALUES (?, ?, 'Proyecto para Validaciones', 'prospecto', ?)`,
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
    await pool.query("DELETE FROM validaciones WHERE expediente_id = ?", [expedienteId]);
    await pool.query("DELETE FROM expedientes_diseno WHERE id = ?", [expedienteId]);
    await pool.query("DELETE FROM proyectos WHERE id = ?", [proyectoId]);
    await pool.query("DELETE FROM clientes WHERE id = ?", [clienteId]);
    await pool.query("DELETE FROM usuarios WHERE id = ?", [usuarioId]);
    await pool.end();
  });

  const autorizacion = () => ({ Authorization: `Bearer ${token}` });
  let validacionId;

  test("rechaza crear en un expediente inexistente", async () => {
    const respuesta = await request(app)
      .post("/expedientes-diseno/999999999/validaciones")
      .set(autorizacion())
      .send({ aspecto_validado: "Uso previsto" });
    expect(respuesta.status).toBe(404);
  });

  test("crea una validación", async () => {
    const respuesta = await request(app)
      .post(`/expedientes-diseno/${expedienteId}/validaciones`)
      .set(autorizacion())
      .send({
        aspecto_validado: "Uso previsto",
        metodo: "Prueba en campo",
        condicion_prueba: "Condiciones normales de operación",
        resultado: "Cumple",
      });
    expect(respuesta.status).toBe(201);
    validacionId = respuesta.body.validacion.id;
    expect(respuesta.body.validacion.expediente_id).toBe(expedienteId);
  });

  test("lista las validaciones del expediente", async () => {
    const respuesta = await request(app)
      .get(`/expedientes-diseno/${expedienteId}/validaciones`)
      .set(autorizacion());
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.validaciones).toHaveLength(1);
  });

  test("edita la validación mientras el expediente sigue pendiente", async () => {
    const respuesta = await request(app)
      .put(`/expedientes-diseno/${expedienteId}/validaciones/${validacionId}`)
      .set(autorizacion())
      .send({ resultado: "No cumple" });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.validacion.resultado).toBe("No cumple");
  });

  test("al liberar el expediente, ya no se pueden agregar validaciones", async () => {
    await request(app)
      .patch(`/expedientes-diseno/${expedienteId}/estado`)
      .set(autorizacion())
      .send({ estado: "aprobado" });

    const respuesta = await request(app)
      .post(`/expedientes-diseno/${expedienteId}/validaciones`)
      .set(autorizacion())
      .send({ aspecto_validado: "Otra validación" });
    expect(respuesta.status).toBe(409);
  });
});
