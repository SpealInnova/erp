const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { sufijoUnico } = require("../helpers/unico");

jest.mock("../../src/servicios/archivosDrive", () => ({
  subirArchivo: jest.fn().mockResolvedValue({
    driveFileId: "fake-drive-id",
    driveEnlace: "https://drive.google.com/file/d/fake-drive-id/view",
  }),
  crearCarpeta: jest.fn().mockResolvedValue({ id: "fake-folder-id" }),
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
    await pool.query(
      "DELETE FROM archivos_adjuntos WHERE registro_id = ? AND tabla = 'proyectos'",
      [proyectoId]
    );
    await pool.query("DELETE FROM auditoria WHERE usuario_id = ?", [usuarioId]);
    await pool.query("DELETE FROM proyecto_drive_carpetas WHERE proyecto_id = ?", [proyectoId]);
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

describirSiHayBD("Evidencias en reportes de servicio y actas (integración)", () => {
  let app;
  let pool;
  let token;
  const sufijo = sufijoUnico();
  const ids = {};

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "secreto-de-pruebas";
    pool = crearPool();
    const q = async (sql, params) => (await pool.query(sql, params))[0];
    const correo = `evidencias-docs-${sufijo}@speal.test`;
    ids.usuario = (
      await q(
        "INSERT INTO usuarios (nombre, correo, password_hash, rol, activo) VALUES (?, ?, 'x', 'tester', 1)",
        [`Evidencias ${sufijo}`, correo]
      )
    ).insertId;
    token = jwt.sign({ id: ids.usuario, correo, rol: "tester" }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    ids.cliente = (
      await q(
        `INSERT INTO clientes (nombre_razon_social, tipo_identificacion, numero_identificacion, created_by)
         VALUES (?, 'NIT', ?, ?)`,
        [`Cliente evidencias ${sufijo}`, `EV-${sufijo}`, ids.usuario]
      )
    ).insertId;
    ids.proyecto = (
      await q(
        `INSERT INTO proyectos (codigo_pry, cliente_id, nombre_proyecto, estado, responsable_id, drive_folder_id)
         VALUES (?, ?, 'Proyecto evidencias', 'seguimiento', ?, 'carpeta-existente')`,
        [`PRY-EV-${sufijo}`, ids.cliente, ids.usuario]
      )
    ).insertId;
    const serie = `EQ-EV-${sufijo}`;
    ids.equipo = (
      await q(
        `INSERT INTO equipos (numero_serie, cliente_id, proyecto_id, descripcion, origen)
         VALUES (?, ?, ?, 'Equipo de evidencias', 'historico')`,
        [serie, ids.cliente, ids.proyecto]
      )
    ).insertId;
    ids.reportes_servicio_tecnico = (
      await q(
        `INSERT INTO reportes_servicio_tecnico
          (numero_reporte, equipo_numero_serie, cliente_id, proyecto_id, tipo_servicio, tecnico_responsable_id)
         VALUES (?, ?, ?, ?, 'inspeccion', ?)`,
        [`RST-EV-${sufijo}`, serie, ids.cliente, ids.proyecto, ids.usuario]
      )
    ).insertId;
    ids.actas_entrega_equipos = (
      await q(
        `INSERT INTO actas_entrega_equipos
          (numero_acta, proyecto_id, cliente_id, objeto, entregante_id, receptor_nombre, fecha_elaboracion)
         VALUES (?, ?, ?, 'Entrega', ?, 'Receptor', '2026-11-01')`,
        [`AE-EV-${sufijo}`, ids.proyecto, ids.cliente, ids.usuario]
      )
    ).insertId;
    ids.actas_cierre_satisfaccion = (
      await q(
        `INSERT INTO actas_cierre_satisfaccion
          (numero_acta, proyecto_id, cliente_id, tipo_entrega, tipo_documento_referencia, objeto,
           responsable_entrega_id, receptor_cliente_nombre, fecha_elaboracion)
         VALUES (?, ?, ?, 'venta', 'contrato', 'Cierre', ?, 'Receptor', '2026-11-10')`,
        [`ACS-EV-${sufijo}`, ids.proyecto, ids.cliente, ids.usuario]
      )
    ).insertId;
    app = crearApp();
  });

  afterAll(async () => {
    const q = (sql, params) => pool.query(sql, params);
    await q("DELETE FROM archivos_adjuntos WHERE subido_por = ?", [ids.usuario]);
    await q("DELETE FROM auditoria WHERE usuario_id = ?", [ids.usuario]);
    await q("DELETE FROM proyecto_drive_carpetas WHERE proyecto_id = ?", [ids.proyecto]);
    await q("DELETE FROM actas_cierre_satisfaccion WHERE id = ?", [ids.actas_cierre_satisfaccion]);
    await q("DELETE FROM actas_entrega_equipos WHERE id = ?", [ids.actas_entrega_equipos]);
    await q("DELETE FROM reportes_servicio_tecnico WHERE id = ?", [ids.reportes_servicio_tecnico]);
    await q("DELETE FROM equipos WHERE id = ?", [ids.equipo]);
    await q("DELETE FROM proyectos WHERE id = ?", [ids.proyecto]);
    await q("DELETE FROM clientes WHERE id = ?", [ids.cliente]);
    await q("DELETE FROM usuarios WHERE id = ?", [ids.usuario]);
    await pool.end();
  });

  test.each(["reportes_servicio_tecnico", "actas_entrega_equipos", "actas_cierre_satisfaccion"])(
    "sube y lista una evidencia de %s",
    async (tabla) => {
      const subida = await request(app)
        .post("/archivos-adjuntos")
        .set("Authorization", `Bearer ${token}`)
        .field("tabla", tabla)
        .field("registro_id", String(ids[tabla]))
        .attach("archivo", Buffer.from("%PDF-1.4"), "soporte.pdf");
      expect(subida.status).toBe(201);
      const lista = await request(app)
        .get("/archivos-adjuntos")
        .set("Authorization", `Bearer ${token}`)
        .query({ tabla, registro_id: ids[tabla] });
      expect(lista.body.archivos.map((a) => a.id)).toContain(subida.body.archivo.id);
    }
  );

  test("un documento que no existe se rechaza", async () => {
    const r = await request(app)
      .post("/archivos-adjuntos")
      .set("Authorization", `Bearer ${token}`)
      .field("tabla", "actas_cierre_satisfaccion")
      .field("registro_id", "999999999")
      .attach("archivo", Buffer.from("%PDF-1.4"), "soporte.pdf");
    expect(r.status).toBe(400);
  });

  test("las evidencias de reportes y actas aparecen en la línea de tiempo del proyecto", async () => {
    const r = await request(app)
      .get(`/proyectos/${ids.proyecto}/linea-tiempo`)
      .set("Authorization", `Bearer ${token}`);
    expect(r.status).toBe(200);
    const evidencias = r.body.eventos.filter((e) => e.tabla === "archivos_adjuntos");
    expect(evidencias.map((e) => e.evidencia_tabla).sort()).toEqual([
      "actas_cierre_satisfaccion",
      "actas_entrega_equipos",
      "reportes_servicio_tecnico",
    ]);
    expect(evidencias.every((e) => Number.isInteger(e.evidencia_id))).toBe(true);
  });
});
