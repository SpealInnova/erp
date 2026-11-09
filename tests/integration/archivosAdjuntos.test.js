const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { sufijoUnico } = require("../helpers/unico");

jest.mock("../../src/servicios/archivosDrive", () => ({
  subirArchivo: jest.fn().mockResolvedValue({
    driveFileId: "fake-drive-id",
    driveEnlace: "https://drive.google.com/file/d/fake-drive-id/view",
  }),
}));

const { crearApp } = require("../../src/app");
const { crearPool } = require("../../src/config/db");

const hayBaseDeDatos = Boolean(process.env.DB_HOST);
const describirSiHayBD = hayBaseDeDatos ? describe : describe.skip;

describirSiHayBD("Archivos adjuntos / evidencias (integración contra BD real)", () => {
  let app;
  let pool;
  let usuarioId;
  let clienteId;
  let proyectoId;
  let token;
  const correoUsuario = `archivos-test-${Date.now()}@speal.test`;

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
      ["Cliente para Archivos", `AA-TEST-${Date.now()}`, usuarioId]
    );
    clienteId = cliente.insertId;

    const [proyecto] = await pool.query(
      `INSERT INTO proyectos (codigo_pry, cliente_id, nombre_proyecto, estado, responsable_id)
       VALUES (?, ?, 'Proyecto para Archivos', 'prospecto', ?)`,
      [`PRY-${sufijoUnico()}`, clienteId, usuarioId]
    );
    proyectoId = proyecto.insertId;

    app = crearApp();
  });

  afterAll(async () => {
    await pool.query("DELETE FROM archivos_adjuntos WHERE registro_id = ? AND tabla = 'proyectos'", [
      proyectoId,
    ]);
    await pool.query("DELETE FROM auditoria WHERE usuario_id = ?", [usuarioId]);
    await pool.query("DELETE FROM proyectos WHERE id = ?", [proyectoId]);
    await pool.query("DELETE FROM clientes WHERE id = ?", [clienteId]);
    await pool.query("DELETE FROM usuarios WHERE id = ?", [usuarioId]);
    await pool.end();
  });

  const autorizacion = () => ({ Authorization: `Bearer ${token}` });

  test("rechaza subir un archivo para una tabla no permitida", async () => {
    const respuesta = await request(app)
      .post("/archivos-adjuntos")
      .set(autorizacion())
      .field("tabla", "usuarios")
      .field("registro_id", String(usuarioId))
      .attach("archivo", Buffer.from("contenido"), "evidencia.png");
    expect(respuesta.status).toBe(400);
  });

  test("rechaza subir un archivo sin adjuntar nada", async () => {
    const respuesta = await request(app)
      .post("/archivos-adjuntos")
      .set(autorizacion())
      .field("tabla", "proyectos")
      .field("registro_id", String(proyectoId));
    expect(respuesta.status).toBe(400);
  });

  test("rechaza un tipo de archivo no permitido", async () => {
    const respuesta = await request(app)
      .post("/archivos-adjuntos")
      .set(autorizacion())
      .field("tabla", "proyectos")
      .field("registro_id", String(proyectoId))
      .attach("archivo", Buffer.from("contenido"), {
        filename: "script.exe",
        contentType: "application/x-msdownload",
      });
    expect(respuesta.status).toBe(400);
  });

  let archivoId;

  test("sube una evidencia para un proyecto existente", async () => {
    const respuesta = await request(app)
      .post("/archivos-adjuntos")
      .set(autorizacion())
      .field("tabla", "proyectos")
      .field("registro_id", String(proyectoId))
      .attach("archivo", Buffer.from("contenido-imagen"), "evidencia.png");
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.archivo.drive_file_id).toBe("fake-drive-id");
    expect(respuesta.body.archivo.nombre_archivo).toBe("evidencia.png");
    archivoId = respuesta.body.archivo.id;
  });

  test("lista las evidencias de un proyecto", async () => {
    const respuesta = await request(app)
      .get("/archivos-adjuntos")
      .set(autorizacion())
      .query({ tabla: "proyectos", registro_id: proyectoId });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.archivos).toHaveLength(1);
    expect(respuesta.body.archivos[0].id).toBe(archivoId);
  });

  test("elimina (soft delete) una evidencia y deja de listarse", async () => {
    const eliminar = await request(app)
      .delete(`/archivos-adjuntos/${archivoId}`)
      .set(autorizacion());
    expect(eliminar.status).toBe(204);

    const respuesta = await request(app)
      .get("/archivos-adjuntos")
      .set(autorizacion())
      .query({ tabla: "proyectos", registro_id: proyectoId });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.archivos).toHaveLength(0);
  });
});
