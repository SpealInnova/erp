const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { crearApp } = require("../../src/app");
const { crearPool } = require("../../src/config/db");
const { sufijoUnico } = require("../helpers/unico");

const hayBaseDeDatos = Boolean(process.env.DB_HOST);
const describirSiHayBD = hayBaseDeDatos ? describe : describe.skip;

describirSiHayBD("Presupuesto de proyecto (integración contra BD real)", () => {
  let app;
  let pool;
  let usuarioId;
  let clienteId;
  let proyectoId;
  let requisicionId;
  let proveedorId;
  let token;
  const correoUsuario = `proy-presupuesto-test-${Date.now()}@speal.test`;

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
      ["Cliente para Presupuesto", `PP-TEST-${Date.now()}`, usuarioId]
    );
    clienteId = cliente.insertId;

    const [proveedor] = await pool.query(
      `INSERT INTO proveedores (nit_cc, razon_social, tipo_persona, origen, clasificacion, created_by)
       VALUES (?, 'Proveedor para Presupuesto', 'juridica', 'nacional', 'productos', ?)`,
      [`PROV-PP-TEST-${Date.now()}`, usuarioId]
    );
    proveedorId = proveedor.insertId;

    app = crearApp();
  });

  afterAll(async () => {
    await pool.query("DELETE FROM auditoria WHERE usuario_id = ?", [usuarioId]);
    await pool.query(
      "DELETE FROM orden_compra_items WHERE orden_compra_id IN (SELECT id FROM ordenes_compra WHERE requisicion_id = ?)",
      [requisicionId]
    );
    await pool.query("DELETE FROM ordenes_compra WHERE requisicion_id = ?", [requisicionId]);
    await pool.query("DELETE FROM requisiciones WHERE id = ?", [requisicionId]);
    await pool.query("DELETE FROM proveedores WHERE id = ?", [proveedorId]);
    await pool.query("DELETE FROM proyectos WHERE id = ?", [proyectoId]);
    await pool.query("DELETE FROM clientes WHERE id = ?", [clienteId]);
    await pool.query("DELETE FROM notificaciones WHERE usuario_id = ?", [usuarioId]);
    await pool.query("DELETE FROM usuarios WHERE id = ?", [usuarioId]);
    await pool.end();
  });

  const autorizacion = () => ({ Authorization: `Bearer ${token}` });

  test("crea un proyecto con presupuesto estimado y sin gasto real todavía", async () => {
    const respuesta = await request(app)
      .post("/proyectos")
      .set(autorizacion())
      .send({
        cliente_id: clienteId,
        responsable_id: usuarioId,
        nombre_proyecto: "Proyecto con presupuesto",
        presupuesto_estimado: 10000,
      });
    expect(respuesta.status).toBe(201);
    proyectoId = respuesta.body.proyecto.id;
    expect(Number(respuesta.body.proyecto.presupuesto_estimado)).toBe(10000);

    const obtener = await request(app).get(`/proyectos/${proyectoId}`).set(autorizacion());
    expect(obtener.status).toBe(200);
    expect(Number(obtener.body.proyecto.gasto_real)).toBe(0);
  });

  test("el gasto real refleja los items de las órdenes de compra del proyecto", async () => {
    const requisicion = await pool.query(
      `INSERT INTO requisiciones (numero_requisicion, proyecto_id, solicitante_id, procedencia, estado)
       VALUES (?, ?, ?, 'nacional', 'solicitada')`,
      [`REQ-${sufijoUnico()}`, proyectoId, usuarioId]
    );
    requisicionId = requisicion[0].insertId;

    const crearOC = await request(app)
      .post("/ordenes-compra")
      .set(autorizacion())
      .send({
        requisicion_id: requisicionId,
        proveedor_id: proveedorId,
        items: [
          { descripcion: "Ítem A", cantidad: 2, precio_unitario: 1500 },
          { descripcion: "Ítem B", cantidad: 1, precio_unitario: 500 },
        ],
      });
    expect(crearOC.status).toBe(201);

    const obtener = await request(app).get(`/proyectos/${proyectoId}`).set(autorizacion());
    expect(obtener.status).toBe(200);
    expect(Number(obtener.body.proyecto.gasto_real)).toBe(3500);
  });

  test("actualiza el presupuesto estimado de un proyecto", async () => {
    const respuesta = await request(app)
      .put(`/proyectos/${proyectoId}`)
      .set(autorizacion())
      .send({ presupuesto_estimado: 20000 });
    expect(respuesta.status).toBe(200);
    expect(Number(respuesta.body.proyecto.presupuesto_estimado)).toBe(20000);
  });
});
