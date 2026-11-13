const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { crearApp } = require("../../src/app");
const { crearPool } = require("../../src/config/db");
const { sufijoUnico } = require("../helpers/unico");

const hayBaseDeDatos = Boolean(process.env.DB_HOST);
const describirSiHayBD = hayBaseDeDatos ? describe : describe.skip;

describirSiHayBD("Cambios de diseño (integración contra BD real)", () => {
  let app;
  let pool;
  let usuarioId;
  let clienteId;
  let proyectoId;
  let expedienteId;
  let token;
  const correoUsuario = `cambios-diseno-test-${Date.now()}@speal.test`;

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
      ["Cliente para Cambios", `CA-TEST-${Date.now()}`, usuarioId]
    );
    clienteId = cliente.insertId;

    const [proyecto] = await pool.query(
      `INSERT INTO proyectos (codigo_pry, cliente_id, nombre_proyecto, estado, responsable_id)
       VALUES (?, ?, 'Proyecto para Cambios', 'prospecto', ?)`,
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
    await pool.query("DELETE FROM cambios_diseno WHERE expediente_id = ?", [expedienteId]);
    await pool.query("DELETE FROM expedientes_diseno WHERE id = ?", [expedienteId]);
    await pool.query("DELETE FROM proyectos WHERE id = ?", [proyectoId]);
    await pool.query("DELETE FROM clientes WHERE id = ?", [clienteId]);
    await pool.query("DELETE FROM usuarios WHERE id = ?", [usuarioId]);
    await pool.end();
  });

  const autorizacion = () => ({ Authorization: `Bearer ${token}` });
  let cambioId;

  test("rechaza crear en un expediente inexistente", async () => {
    const respuesta = await request(app)
      .post("/expedientes-diseno/999999999/cambios-diseno")
      .set(autorizacion())
      .send({ descripcion: "Cambio de material" });
    expect(respuesta.status).toBe(404);
  });

  test("crea el primer cambio con numero 1 y estado pendiente por defecto", async () => {
    const respuesta = await request(app)
      .post(`/expedientes-diseno/${expedienteId}/cambios-diseno`)
      .set(autorizacion())
      .send({ descripcion: "Cambio de material", motivo: "Disponibilidad del proveedor" });
    expect(respuesta.status).toBe(201);
    cambioId = respuesta.body.cambio.id;
    expect(respuesta.body.cambio.expediente_id).toBe(expedienteId);
    expect(respuesta.body.cambio.numero).toBe(1);
    expect(respuesta.body.cambio.estado).toBe("pendiente");
  });

  test("el segundo cambio recibe el consecutivo siguiente", async () => {
    const respuesta = await request(app)
      .post(`/expedientes-diseno/${expedienteId}/cambios-diseno`)
      .set(autorizacion())
      .send({ descripcion: "Cambio de tolerancia" });
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.cambio.numero).toBe(2);
  });

  test("lista los cambios del expediente", async () => {
    const respuesta = await request(app)
      .get(`/expedientes-diseno/${expedienteId}/cambios-diseno`)
      .set(autorizacion());
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.cambios).toHaveLength(2);
  });

  test("al marcar un cambio como aprobado, aprobado_por y aprobado_en se llenan solos", async () => {
    const respuesta = await request(app)
      .put(`/expedientes-diseno/${expedienteId}/cambios-diseno/${cambioId}`)
      .set(autorizacion())
      .send({ estado: "aprobado" });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.cambio.estado).toBe("aprobado");
    expect(respuesta.body.cambio.aprobado_por).toBe(usuarioId);
    expect(respuesta.body.cambio.aprobado_en).not.toBeNull();
  });

  test("al liberar el expediente, ya no se pueden agregar cambios", async () => {
    await request(app)
      .patch(`/expedientes-diseno/${expedienteId}/estado`)
      .set(autorizacion())
      .send({ estado: "aprobado" });

    const respuesta = await request(app)
      .post(`/expedientes-diseno/${expedienteId}/cambios-diseno`)
      .set(autorizacion())
      .send({ descripcion: "Otro cambio" });
    expect(respuesta.status).toBe(409);
  });
});
