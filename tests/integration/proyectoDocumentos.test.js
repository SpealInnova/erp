const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { crearApp } = require("../../src/app");
const { crearPool } = require("../../src/config/db");
const { sufijoUnico } = require("../helpers/unico");

const hayBaseDeDatos = Boolean(process.env.DB_HOST);
const describirSiHayBD = hayBaseDeDatos ? describe : describe.skip;

describirSiHayBD("Documentos del proyecto y su línea de tiempo (integración)", () => {
  let app;
  let pool;
  let token;
  const sufijo = sufijoUnico();
  const ids = {};
  const serie = `SN-DOC-${sufijo}`;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "secreto-de-pruebas";
    pool = crearPool();
    const passwordHash = await bcrypt.hash("ClaveSegura123", 10);
    const [usuario] = await pool.query(
      "INSERT INTO usuarios (nombre, correo, password_hash, rol, activo) VALUES (?, ?, ?, 'tester', 1)",
      [`Documentos ${sufijo}`, `documentos-${sufijo}@speal.test`, passwordHash]
    );
    ids.usuario = usuario.insertId;
    token = jwt.sign(
      { id: ids.usuario, correo: `documentos-${sufijo}@speal.test`, rol: "tester" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    const q = (sql, p) => pool.query(sql, p).then(([r]) => r);

    ids.clienteA = (
      await q(
        `INSERT INTO clientes (nombre_razon_social, tipo_identificacion, numero_identificacion, created_by)
         VALUES (?, 'NIT', ?, ?)`,
        [`Cliente Docs A ${sufijo}`, `DOC-A-${sufijo}`, ids.usuario]
      )
    ).insertId;
    ids.clienteB = (
      await q(
        `INSERT INTO clientes (nombre_razon_social, tipo_identificacion, numero_identificacion, created_by)
         VALUES (?, 'NIT', ?, ?)`,
        [`Cliente Docs B ${sufijo}`, `DOC-B-${sufijo}`, ids.usuario]
      )
    ).insertId;

    ids.cotizacion = (
      await q(
        `INSERT INTO cotizaciones (numero_cotizacion, cliente_id, asesor_comercial_id, estado)
         VALUES (?, ?, ?, 'aceptada')`,
        [`COT-DOC-${sufijo}`, ids.clienteA, ids.usuario]
      )
    ).insertId;
    await q(
      `INSERT INTO cotizacion_items (cotizacion_id, descripcion, cantidad, valor_unitario, descuento_porcentaje, iva_porcentaje)
       VALUES (?, 'Planta', 1, 1000, 0, 0)`,
      [ids.cotizacion]
    );

    ids.proyecto = (
      await q(
        `INSERT INTO proyectos (codigo_pry, cliente_id, cotizacion_id, nombre_proyecto, estado, responsable_id)
         VALUES (?, ?, ?, 'Proyecto con documentos', 'compras', ?)`,
        [`PRY-DOC-${sufijo}`, ids.clienteA, ids.cotizacion, ids.usuario]
      )
    ).insertId;
    ids.expediente = (
      await q(
        `INSERT INTO expedientes_diseno (codigo_expediente, proyecto_id, producto_nombre, numero_serie, responsable_diseno_id, estado_liberacion)
         VALUES (?, ?, 'Planta PSA', ?, ?, 'aprobado')`,
        [`EXP-DOC-${sufijo}`, ids.proyecto, serie, ids.usuario]
      )
    ).insertId;
    ids.proveedor = (
      await q(
        `INSERT INTO proveedores (nit_cc, razon_social, tipo_persona, origen, clasificacion, created_by)
         VALUES (?, ?, 'juridica', 'nacional', 'productos', ?)`,
        [`PROV-DOC-${sufijo}`, `Proveedor Docs ${sufijo}`, ids.usuario]
      )
    ).insertId;
    ids.requisicion = (
      await q(
        `INSERT INTO requisiciones (numero_requisicion, proyecto_id, solicitante_id, procedencia, estado)
         VALUES (?, ?, ?, 'nacional', 'convertida_oc')`,
        [`REQ-DOC-${sufijo}`, ids.proyecto, ids.usuario]
      )
    ).insertId;
    // OC ya pagada (registro directo) para el total pagado
    ids.ocPagada = (
      await q(
        `INSERT INTO ordenes_compra (numero_oc, requisicion_id, proveedor_id, estado, created_by)
         VALUES (?, ?, ?, 'paga', ?)`,
        [`OC-DOCP-${sufijo}`, ids.requisicion, ids.proveedor, ids.usuario]
      )
    ).insertId;
    await q(
      `INSERT INTO orden_compra_items (orden_compra_id, descripcion, cantidad, precio_unitario)
       VALUES (?, 'Compresor', 1, 400)`,
      [ids.ocPagada]
    );
    // reporte antiguo registrado sin proyecto, sobre un equipo de este proyecto
    ids.reporteSuelto = (
      await q(
        `INSERT INTO reportes_servicio_tecnico (numero_reporte, equipo_numero_serie, cliente_id, tipo_servicio, tecnico_responsable_id, created_by)
         VALUES (?, ?, ?, 'garantia', ?, ?)`,
        [`RST-DOC-${sufijo}`, serie, ids.clienteA, ids.usuario, ids.usuario]
      )
    ).insertId;
    // acta de cierre antigua a nombre de otro cliente
    ids.actaCierre = (
      await q(
        `INSERT INTO actas_cierre_satisfaccion (numero_acta, proyecto_id, cliente_id, tipo_entrega, tipo_documento_referencia, objeto, responsable_entrega_id, receptor_cliente_nombre, fecha_elaboracion, created_by)
         VALUES (?, ?, ?, 'venta', 'contrato', 'Cierre', ?, 'Gerente', '2026-11-01', ?)`,
        [`ACS-DOC-${sufijo}`, ids.proyecto, ids.clienteB, ids.usuario, ids.usuario]
      )
    ).insertId;

    app = crearApp();
  });

  afterAll(async () => {
    const q = (sql, p) => pool.query(sql, p);
    await q("DELETE FROM auditoria WHERE usuario_id = ?", [ids.usuario]);
    await q("DELETE FROM notificaciones WHERE usuario_id = ?", [ids.usuario]);
    await q("DELETE FROM acta_items_verificados WHERE acta_id = ?", [ids.actaCierre]);
    await q("DELETE FROM actas_cierre_satisfaccion WHERE proyecto_id = ?", [ids.proyecto]);
    await q(
      "DELETE i FROM acta_entrega_items i JOIN actas_entrega_equipos a ON a.id = i.acta_id WHERE a.proyecto_id = ?",
      [ids.proyecto]
    );
    await q("DELETE FROM actas_entrega_equipos WHERE proyecto_id = ?", [ids.proyecto]);
    await q("DELETE FROM reportes_servicio_tecnico WHERE equipo_numero_serie = ?", [serie]);
    await q(
      "DELETE oci FROM orden_compra_items oci JOIN ordenes_compra oc ON oc.id = oci.orden_compra_id WHERE oc.requisicion_id = ?",
      [ids.requisicion]
    );
    await q("DELETE FROM ordenes_compra WHERE requisicion_id = ?", [ids.requisicion]);
    await q("DELETE FROM requisiciones WHERE id = ?", [ids.requisicion]);
    await q("DELETE FROM proveedores WHERE id = ?", [ids.proveedor]);
    await q("DELETE FROM expedientes_diseno WHERE id = ?", [ids.expediente]);
    await q("DELETE FROM proyectos WHERE id = ?", [ids.proyecto]);
    await q("DELETE FROM cotizacion_items WHERE cotizacion_id = ?", [ids.cotizacion]);
    await q("DELETE FROM cotizaciones WHERE id = ?", [ids.cotizacion]);
    await q("DELETE FROM clientes WHERE id IN (?, ?)", [ids.clienteA, ids.clienteB]);
    await q("DELETE FROM usuarios WHERE id = ?", [ids.usuario]);
    await pool.end();
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  test("responde 404 para un proyecto inexistente", async () => {
    const r = await request(app).get("/proyectos/999999999/documentos").set(auth());
    expect(r.status).toBe(404);
  });

  test("reúne los documentos de todos los módulos y marca los enlaces que no cuadran", async () => {
    const oc = await request(app)
      .post("/ordenes-compra")
      .set(auth())
      .send({
        requisicion_id: ids.requisicion,
        proveedor_id: ids.proveedor,
        items: [{ descripcion: "Válvulas", cantidad: 2, precio_unitario: 300 }],
      });
    expect(oc.status).toBe(201);
    ids.ocNueva = oc.body.orden;

    const reporte = await request(app)
      .post("/reportes-servicio-tecnico")
      .set(auth())
      .send({ equipo_numero_serie: serie, cliente_id: ids.clienteA, tipo_servicio: "instalacion" });
    expect(reporte.status).toBe(201);
    ids.reporteNuevo = reporte.body.reporte;

    const acta = await request(app)
      .post("/actas-entrega-equipos")
      .set(auth())
      .send({
        proyecto_id: ids.proyecto,
        cliente_id: ids.clienteA,
        objeto: "Entrega",
        receptor_nombre: "Receptor",
        items: [{ descripcion_equipo: "Planta", cantidad: 1, numero_serie: serie, cumple: "si" }],
      });
    expect(acta.status).toBe(201);
    ids.actaEntrega = acta.body.acta;

    const r = await request(app).get(`/proyectos/${ids.proyecto}/documentos`).set(auth());
    expect(r.status).toBe(200);
    const { documentos } = r.body;

    expect(documentos.cotizacion).toEqual(
      expect.objectContaining({ id: ids.cotizacion, estado: "aceptada", valor: 1000 })
    );
    expect(documentos.expedientes.map((e) => e.numero_serie)).toEqual([serie]);
    expect(documentos.requisiciones.map((x) => x.id)).toEqual([ids.requisicion]);
    expect(documentos.ordenes_compra).toHaveLength(2);
    expect(documentos.resumen).toEqual({
      valor_cotizado: 1000,
      comprometido_oc: 1000,
      pagado_oc: 400,
    });

    const nuevo = documentos.reportes_servicio.find((x) => x.id === ids.reporteNuevo.id);
    expect(nuevo.alertas).toEqual([]);
    const suelto = documentos.reportes_servicio.find((x) => x.id === ids.reporteSuelto);
    expect(suelto.alertas).toEqual(["Registrado sin proyecto; el equipo es de este proyecto"]);

    expect(documentos.actas_entrega[0]).toEqual(
      expect.objectContaining({ id: ids.actaEntrega.id, equipos: 1, alertas: [] })
    );
    expect(documentos.actas_cierre[0].alertas).toEqual(["Cliente distinto al del proyecto"]);
  });

  test("la línea de tiempo del proyecto incluye los documentos de otros módulos", async () => {
    const r = await request(app).get(`/proyectos/${ids.proyecto}/linea-tiempo`).set(auth());
    expect(r.status).toBe(200);
    const codigos = r.body.eventos
      .filter((e) => e.documento_codigo)
      .map((e) => `${e.tabla}:${e.documento_codigo}`);
    expect(codigos).toEqual(
      expect.arrayContaining([
        `ordenes_compra:${ids.ocNueva.numero_oc}`,
        `reportes_servicio_tecnico:${ids.reporteNuevo.numero_reporte}`,
        `actas_entrega_equipos:${ids.actaEntrega.numero_acta}`,
      ])
    );

    const aprobar = await request(app)
      .patch(`/ordenes-compra/${ids.ocNueva.id}/estado`)
      .set(auth())
      .send({ estado: "aprobada_pte_pago" });
    expect(aprobar.status).toBe(200);
    const despues = await request(app).get(`/proyectos/${ids.proyecto}/linea-tiempo`).set(auth());
    const cambio = despues.body.eventos.find(
      (e) => e.tabla === "ordenes_compra" && e.documento_cambio_estado
    );
    expect(cambio.documento_cambio_estado).toEqual({ de: "pte_aprobar", a: "aprobada_pte_pago" });
  });
});
