const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { crearApp } = require("../../src/app");
const { crearPool } = require("../../src/config/db");

const hayBaseDeDatos = Boolean(process.env.DB_HOST);
const describirSiHayBD = hayBaseDeDatos ? describe : describe.skip;

describirSiHayBD("CRUD de Órdenes de Compra (integración contra BD real)", () => {
  let app;
  let pool;
  let usuarioId;
  let clienteId;
  let proyectoId;
  let requisicionId;
  let proveedorId;
  let token;
  const correoUsuario = `oc-test-${Date.now()}@speal.test`;
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
      ["Cliente para OC", `OC-TEST-${Date.now()}`, usuarioId]
    );
    clienteId = cliente.insertId;

    const [proyecto] = await pool.query(
      `INSERT INTO proyectos (codigo_pry, cliente_id, nombre_proyecto, estado, responsable_id)
       VALUES (?, ?, 'Proyecto para OC', 'prospecto', ?)`,
      [`PRY-OC-TEST-${Date.now()}`, clienteId, usuarioId]
    );
    proyectoId = proyecto.insertId;

    const [requisicion] = await pool.query(
      `INSERT INTO requisiciones (numero_requisicion, proyecto_id, solicitante_id, procedencia, estado)
       VALUES (?, ?, ?, 'nacional', 'solicitada')`,
      [`REQ-OC-TEST-${Date.now()}`, proyectoId, usuarioId]
    );
    requisicionId = requisicion.insertId;

    const [proveedor] = await pool.query(
      `INSERT INTO proveedores (nit_cc, razon_social, tipo_persona, origen, clasificacion, created_by)
       VALUES (?, 'Proveedor para OC', 'juridica', 'nacional', 'productos', ?)`,
      [`PROV-OC-TEST-${Date.now()}`, usuarioId]
    );
    proveedorId = proveedor.insertId;

    app = crearApp();
  });

  afterAll(async () => {
    await pool.query("DELETE FROM auditoria WHERE usuario_id = ?", [usuarioId]);
    await pool.query(
      "DELETE FROM orden_compra_items WHERE orden_compra_id IN (SELECT id FROM ordenes_compra WHERE created_by = ?)",
      [usuarioId]
    );
    await pool.query("DELETE FROM ordenes_compra WHERE created_by = ?", [usuarioId]);
    await pool.query("DELETE FROM requisiciones WHERE id = ?", [requisicionId]);
    await pool.query("DELETE FROM proveedores WHERE id = ?", [proveedorId]);
    await pool.query("DELETE FROM proyectos WHERE id = ?", [proyectoId]);
    await pool.query("DELETE FROM clientes WHERE id = ?", [clienteId]);
    await pool.query("DELETE FROM usuarios WHERE id = ?", [usuarioId]);
    await pool.end();
  });

  const autorizacion = () => ({ Authorization: `Bearer ${token}` });
  let ordenId;

  test("rechaza crear con un proveedor inexistente", async () => {
    const respuesta = await request(app)
      .post("/ordenes-compra")
      .set(autorizacion())
      .send({
        requisicion_id: requisicionId,
        proveedor_id: 999999999,
        items: [{ descripcion: "Tubería PVC", cantidad: 10, precio_unitario: 15000 }],
      });
    expect(respuesta.status).toBe(400);
  });

  test("crea una orden de compra ligada a la requisición", async () => {
    const respuesta = await request(app)
      .post("/ordenes-compra")
      .set(autorizacion())
      .send({
        requisicion_id: requisicionId,
        proveedor_id: proveedorId,
        items: [{ descripcion: "Tubería PVC", cantidad: 10, precio_unitario: 15000 }],
      });

    expect(respuesta.status).toBe(201);
    ordenId = respuesta.body.orden.id;
    expect(respuesta.body.orden.numero_oc).toMatch(new RegExp(`^OC-${anioActual}-\\d{3}$`));
    expect(respuesta.body.orden.requisicion_id).toBe(requisicionId);
    expect(respuesta.body.orden.estado).toBe("pte_aprobar");
    expect(respuesta.body.orden.aprobado_por).toBeNull();
  });

  test("al aprobar, registra automáticamente quién y cuándo", async () => {
    const respuesta = await request(app)
      .patch(`/ordenes-compra/${ordenId}/estado`)
      .set(autorizacion())
      .send({ estado: "aprobada_pte_pago" });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.orden.estado).toBe("aprobada_pte_pago");
    expect(respuesta.body.orden.aprobado_por).toBe(usuarioId);
    expect(respuesta.body.orden.aprobado_en).not.toBeNull();
  });

  test("rechaza un salto de estado inválido", async () => {
    const respuesta = await request(app)
      .patch(`/ordenes-compra/${ordenId}/estado`)
      .set(autorizacion())
      .send({ estado: "contabilizada" });
    expect(respuesta.status).toBe(409);
  });

  test("ya no se puede editar fuera de pte_aprobar", async () => {
    const respuesta = await request(app)
      .put(`/ordenes-compra/${ordenId}`)
      .set(autorizacion())
      .send({ proveedor_id: proveedorId });
    expect(respuesta.status).toBe(409);
  });
});
