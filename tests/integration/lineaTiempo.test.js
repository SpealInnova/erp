const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { crearApp } = require("../../src/app");
const { crearPool } = require("../../src/config/db");
const { sufijoUnico } = require("../helpers/unico");

const hayBaseDeDatos = Boolean(process.env.DB_HOST);
const describirSiHayBD = hayBaseDeDatos ? describe : describe.skip;

describirSiHayBD("Línea de tiempo de proyecto (integración contra BD real)", () => {
  let app;
  let pool;
  let usuarioId;
  let clienteId;
  let proyectoId;
  let token;
  const correoUsuario = `linea-tiempo-test-${Date.now()}@speal.test`;

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
      ["Cliente para Línea de tiempo", `LT-TEST-${Date.now()}`, usuarioId]
    );
    clienteId = cliente.insertId;

    app = crearApp();
  });

  afterAll(async () => {
    await pool.query("DELETE FROM proyecto_actividades WHERE proyecto_id = ?", [proyectoId]);
    await pool.query("DELETE FROM auditoria WHERE usuario_id = ?", [usuarioId]);
    await pool.query("DELETE FROM proyectos WHERE id = ?", [proyectoId]);
    await pool.query("DELETE FROM clientes WHERE id = ?", [clienteId]);
    await pool.query("DELETE FROM notificaciones WHERE usuario_id = ?", [usuarioId]);
    await pool.query("DELETE FROM usuarios WHERE id = ?", [usuarioId]);
    await pool.end();
  });

  const autorizacion = () => ({ Authorization: `Bearer ${token}` });

  test("rechaza la línea de tiempo de un proyecto inexistente", async () => {
    const respuesta = await request(app)
      .get("/proyectos/999999999/linea-tiempo")
      .set(autorizacion());
    expect(respuesta.status).toBe(404);
  });

  test("incluye la creación del proyecto y el cambio de fase con observación", async () => {
    const crear = await request(app)
      .post("/proyectos")
      .set(autorizacion())
      .send({
        cliente_id: clienteId,
        responsable_id: usuarioId,
        nombre_proyecto: `Proyecto línea de tiempo ${sufijoUnico()}`,
      });
    proyectoId = crear.body.proyecto.id;

    await request(app)
      .patch(`/proyectos/${proyectoId}/estado`)
      .set(autorizacion())
      .send({ estado: "planeacion", observacion: "Aprobado en reunión de apertura" });

    const respuesta = await request(app)
      .get(`/proyectos/${proyectoId}/linea-tiempo`)
      .set(autorizacion());
    expect(respuesta.status).toBe(200);

    const eventos = respuesta.body.eventos;
    const creacion = eventos.find((e) => e.tabla === "proyectos" && e.accion === "crear");
    expect(creacion).toBeDefined();
    expect(creacion.usuario_nombre).toBe("Usuario de prueba");

    const cambioFase = eventos.find((e) => e.cambio_estado && e.cambio_estado.a === "planeacion");
    expect(cambioFase).toBeDefined();
    expect(cambioFase.cambio_estado.de).toBe("prospecto");
    expect(cambioFase.observacion).toBe("Aprobado en reunión de apertura");

    // más reciente primero
    expect(new Date(eventos[0].creado_en).getTime()).toBeGreaterThanOrEqual(
      new Date(eventos[eventos.length - 1].creado_en).getTime()
    );
  });

  test("incluye eventos de las actividades generadas al entrar a la fase", async () => {
    const lista = await request(app)
      .get(`/proyectos/${proyectoId}/actividades`)
      .set(autorizacion());
    const actividadId = lista.body.actividades[0].id;

    await request(app)
      .put(`/proyectos/${proyectoId}/actividades/${actividadId}`)
      .set(autorizacion())
      .send({ estado: "completada" });

    const respuesta = await request(app)
      .get(`/proyectos/${proyectoId}/linea-tiempo`)
      .set(autorizacion());

    const eventoActividad = respuesta.body.eventos.find(
      (e) => e.tabla === "proyecto_actividades" && e.actividad_cambio_estado?.a === "completada"
    );
    expect(eventoActividad).toBeDefined();
    expect(eventoActividad.actividad_descripcion).toBe(lista.body.actividades[0].descripcion);
  });
});
