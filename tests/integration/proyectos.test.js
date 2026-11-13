const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const request = require("supertest");

jest.mock("../../src/servicios/archivosDrive", () => ({
  renombrarCarpeta: jest.fn().mockResolvedValue(undefined),
}));

const archivosDrive = require("../../src/servicios/archivosDrive");
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
    await pool.query(
      "DELETE FROM proyecto_actividades WHERE proyecto_id IN (SELECT id FROM proyectos WHERE responsable_id = ?)",
      [usuarioId]
    );
    await pool.query("DELETE FROM proyectos WHERE responsable_id = ?", [usuarioId]);
    await pool.query("DELETE FROM clientes WHERE id = ?", [clienteId]);
    await pool.query("DELETE FROM notificaciones WHERE usuario_id = ?", [usuarioId]);
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
    // Otras suites crean proyectos en paralelo y pueden tomar el número
    // intermedio: lo que se garantiza es que el consecutivo siempre avanza.
    expect(numeroNuevo).toBeGreaterThan(numeroAnterior);

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

  test("rechaza cambiar el código a uno que ya usa otro proyecto", async () => {
    const otro = await request(app)
      .post("/proyectos")
      .set(autorizacion())
      .send({
        cliente_id: clienteId,
        responsable_id: usuarioId,
        nombre_proyecto: "Proyecto para choque de código",
      });
    const codigoOtro = otro.body.proyecto.codigo_pry;

    const respuesta = await request(app)
      .put(`/proyectos/${proyectoId}`)
      .set(autorizacion())
      .send({ codigo_pry: codigoOtro });
    expect(respuesta.status).toBe(409);

    await pool.query("DELETE FROM proyectos WHERE id = ?", [otro.body.proyecto.id]);
  });

  test("rechaza un código con formato inválido", async () => {
    const respuesta = await request(app)
      .put(`/proyectos/${proyectoId}`)
      .set(autorizacion())
      .send({ codigo_pry: "cualquier-cosa" });
    expect(respuesta.status).toBe(400);
  });

  test("permite cambiar el código del proyecto a uno nuevo y único", async () => {
    const nuevoCodigo = `PRY-${anioActual}-999`;
    const respuesta = await request(app)
      .put(`/proyectos/${proyectoId}`)
      .set(autorizacion())
      .send({ codigo_pry: nuevoCodigo });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.proyecto.codigo_pry).toBe(nuevoCodigo);
    expect(archivosDrive.renombrarCarpeta).not.toHaveBeenCalled();
  });

  test("si el proyecto ya tiene carpeta en Drive, la renombra al cambiar el código", async () => {
    await pool.query("UPDATE proyectos SET drive_folder_id = ? WHERE id = ?", [
      "carpeta-drive-existente",
      proyectoId,
    ]);
    const nuevoCodigo = `PRY-${anioActual}-998`;

    const respuesta = await request(app)
      .put(`/proyectos/${proyectoId}`)
      .set(autorizacion())
      .send({ codigo_pry: nuevoCodigo });

    expect(respuesta.status).toBe(200);
    expect(archivosDrive.renombrarCarpeta).toHaveBeenCalledWith({
      carpetaId: "carpeta-drive-existente",
      nombre: nuevoCodigo,
    });
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

  test("rechaza eliminar sin contraseña ni justificación", async () => {
    const respuesta = await request(app).delete(`/proyectos/${proyectoId}`).set(autorizacion());
    expect(respuesta.status).toBe(400);
  });

  test("rechaza eliminar con la contraseña incorrecta", async () => {
    const respuesta = await request(app)
      .delete(`/proyectos/${proyectoId}`)
      .set(autorizacion())
      .send({ password: "ClaveIncorrecta", justificacion: "Proyecto de prueba duplicado" });
    expect(respuesta.status).toBe(403);
  });

  test("elimina (soft-delete) el proyecto con contraseña y justificación válidas", async () => {
    const respuesta = await request(app)
      .delete(`/proyectos/${proyectoId}`)
      .set(autorizacion())
      .send({ password: "ClaveSegura123", justificacion: "Proyecto de prueba duplicado" });
    expect(respuesta.status).toBe(204);

    const obtener = await request(app).get(`/proyectos/${proyectoId}`).set(autorizacion());
    expect(obtener.status).toBe(404);
  });

  describe("enganche de cotizacion_id", () => {
    let cotizacionAceptadaId;
    let cotizacionBorradorId;
    let otroClienteId;
    let cotizacionOtroClienteId;

    beforeAll(async () => {
      const sufijo = Date.now().toString().slice(-8);

      const [cotizacionAceptada] = await pool.query(
        `INSERT INTO cotizaciones (numero_cotizacion, cliente_id, asesor_comercial_id, estado, created_by)
         VALUES (?, ?, ?, 'aceptada', ?)`,
        [`COT-TA-${sufijo}`, clienteId, usuarioId, usuarioId]
      );
      cotizacionAceptadaId = cotizacionAceptada.insertId;

      const [cotizacionBorrador] = await pool.query(
        `INSERT INTO cotizaciones (numero_cotizacion, cliente_id, asesor_comercial_id, estado, created_by)
         VALUES (?, ?, ?, 'borrador', ?)`,
        [`COT-TB-${sufijo}`, clienteId, usuarioId, usuarioId]
      );
      cotizacionBorradorId = cotizacionBorrador.insertId;

      const [otroCliente] = await pool.query(
        `INSERT INTO clientes (nombre_razon_social, tipo_identificacion, numero_identificacion, created_by)
         VALUES (?, 'NIT', ?, ?)`,
        ["Otro cliente para Proyectos", `PRY-TO-${sufijo}`, usuarioId]
      );
      otroClienteId = otroCliente.insertId;

      const [cotizacionOtroCliente] = await pool.query(
        `INSERT INTO cotizaciones (numero_cotizacion, cliente_id, asesor_comercial_id, estado, created_by)
         VALUES (?, ?, ?, 'aceptada', ?)`,
        [`COT-TC-${sufijo}`, otroClienteId, usuarioId, usuarioId]
      );
      cotizacionOtroClienteId = cotizacionOtroCliente.insertId;
    });

    afterAll(async () => {
      await pool.query("DELETE FROM cotizaciones WHERE id IN (?, ?, ?)", [
        cotizacionAceptadaId,
        cotizacionBorradorId,
        cotizacionOtroClienteId,
      ]);
      await pool.query("DELETE FROM clientes WHERE id = ?", [otroClienteId]);
    });

    test("rechaza crear un proyecto con una cotización que no está aceptada", async () => {
      const respuesta = await request(app)
        .post("/proyectos")
        .set(autorizacion())
        .send({
          cliente_id: clienteId,
          responsable_id: usuarioId,
          nombre_proyecto: "Proyecto con cotización en borrador",
          cotizacion_id: cotizacionBorradorId,
        });
      expect(respuesta.status).toBe(400);
    });

    test("rechaza crear un proyecto con una cotización aceptada de otro cliente", async () => {
      const respuesta = await request(app)
        .post("/proyectos")
        .set(autorizacion())
        .send({
          cliente_id: clienteId,
          responsable_id: usuarioId,
          nombre_proyecto: "Proyecto con cotización de otro cliente",
          cotizacion_id: cotizacionOtroClienteId,
        });
      expect(respuesta.status).toBe(400);
    });

    test("crea un proyecto enganchado a una cotización aceptada del mismo cliente", async () => {
      const respuesta = await request(app)
        .post("/proyectos")
        .set(autorizacion())
        .send({
          cliente_id: clienteId,
          responsable_id: usuarioId,
          nombre_proyecto: "Proyecto enganchado a cotización",
          cotizacion_id: cotizacionAceptadaId,
        });
      expect(respuesta.status).toBe(201);
      expect(respuesta.body.proyecto.cotizacion_id).toBe(cotizacionAceptadaId);

      await pool.query("DELETE FROM proyectos WHERE id = ?", [respuesta.body.proyecto.id]);
    });
  });
});
