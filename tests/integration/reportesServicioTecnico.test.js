const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { crearApp } = require("../../src/app");
const { crearPool } = require("../../src/config/db");
const { sufijoUnico } = require("../helpers/unico");

const hayBaseDeDatos = Boolean(process.env.DB_HOST);
const describirSiHayBD = hayBaseDeDatos ? describe : describe.skip;

describirSiHayBD("Reporte de Servicio Técnico (integración contra BD real)", () => {
  let app;
  let pool;
  let usuarioId;
  let clienteId;
  let proyectoId;
  let expedienteId;
  let token;
  const correoUsuario = `rst-test-${Date.now()}@speal.test`;
  const numeroSerie = `SN-${sufijoUnico()}`;
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
      ["Cliente para RST", `RST-TEST-${Date.now()}`, usuarioId]
    );
    clienteId = cliente.insertId;

    const [proyecto] = await pool.query(
      `INSERT INTO proyectos (codigo_pry, cliente_id, nombre_proyecto, estado, responsable_id)
       VALUES (?, ?, 'Proyecto para RST', 'prospecto', ?)`,
      [`PRY-${sufijoUnico()}`, clienteId, usuarioId]
    );
    proyectoId = proyecto.insertId;

    const [expediente] = await pool.query(
      `INSERT INTO expedientes_diseno (codigo_expediente, proyecto_id, producto_nombre, numero_serie, responsable_diseno_id, estado_liberacion)
       VALUES (?, ?, 'Producto con serie', ?, ?, 'aprobado')`,
      [`EXP-${sufijoUnico()}`, proyectoId, numeroSerie, usuarioId]
    );
    expedienteId = expediente.insertId;

    app = crearApp();
  });

  afterAll(async () => {
    await pool.query("DELETE FROM auditoria WHERE usuario_id = ?", [usuarioId]);
    await pool.query(
      "DELETE FROM parametros_medidos WHERE reporte_id IN (SELECT id FROM reportes_servicio_tecnico WHERE tecnico_responsable_id = ?)",
      [usuarioId]
    );
    await pool.query("DELETE FROM reportes_servicio_tecnico WHERE tecnico_responsable_id = ?", [
      usuarioId,
    ]);
    await pool.query("DELETE FROM expedientes_diseno WHERE id = ?", [expedienteId]);
    await pool.query("DELETE FROM proyectos WHERE id = ?", [proyectoId]);
    await pool.query("DELETE FROM clientes WHERE id = ?", [clienteId]);
    await pool.query("DELETE FROM usuarios WHERE id = ?", [usuarioId]);
    await pool.end();
  });

  const autorizacion = () => ({ Authorization: `Bearer ${token}` });
  let reporteId;

  test("rechaza crear con un numero_serie que no existe en ningún expediente", async () => {
    const respuesta = await request(app)
      .post("/reportes-servicio-tecnico")
      .set(autorizacion())
      .send({
        equipo_numero_serie: "SN-NO-EXISTE",
        cliente_id: clienteId,
        tipo_servicio: "mantenimiento_preventivo",
      });
    expect(respuesta.status).toBe(400);
  });

  test("crea un reporte vinculado por numero_serie real, sin proyecto (opcional)", async () => {
    const respuesta = await request(app)
      .post("/reportes-servicio-tecnico")
      .set(autorizacion())
      .send({
        equipo_numero_serie: numeroSerie,
        cliente_id: clienteId,
        tipo_servicio: "inspeccion",
        en_garantia: true,
        motivo: "Revisión anual",
      });

    expect(respuesta.status).toBe(201);
    reporteId = respuesta.body.reporte.id;
    expect(respuesta.body.reporte.numero_reporte).toMatch(
      new RegExp(`^RST-${anioActual}-\\d{3}$`)
    );
    expect(respuesta.body.reporte.proyecto_id).toBeNull();
    expect(respuesta.body.reporte.tecnico_responsable_id).toBe(usuarioId);
    expect(respuesta.body.reporte.en_garantia).toBe(1);
  });

  test("agrega un parámetro medido y lo lista", async () => {
    const crear = await request(app)
      .post(`/reportes-servicio-tecnico/${reporteId}/parametros-medidos`)
      .set(autorizacion())
      .send({
        parametro: "Presión de salida",
        unidad: "bar",
        valor_medido: "4.8",
        valor_esperado: "5.0",
      });
    expect(crear.status).toBe(201);

    const listar = await request(app)
      .get(`/reportes-servicio-tecnico/${reporteId}/parametros-medidos`)
      .set(autorizacion());
    expect(listar.status).toBe(200);
    expect(listar.body.parametros).toHaveLength(1);
  });

  test("edita el reporte (no hay gate de estado para este módulo)", async () => {
    const respuesta = await request(app)
      .put(`/reportes-servicio-tecnico/${reporteId}`)
      .set(autorizacion())
      .send({ hallazgos: "Sin novedades", recomendaciones: "Repetir en 6 meses" });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.reporte.hallazgos).toBe("Sin novedades");
  });

  test("elimina (soft-delete) el reporte", async () => {
    const respuesta = await request(app)
      .delete(`/reportes-servicio-tecnico/${reporteId}`)
      .set(autorizacion());
    expect(respuesta.status).toBe(204);

    const obtener = await request(app)
      .get(`/reportes-servicio-tecnico/${reporteId}`)
      .set(autorizacion());
    expect(obtener.status).toBe(404);
  });
});
