const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { crearApp } = require("../../src/app");
const { crearPool } = require("../../src/config/db");
const { sufijoUnico } = require("../helpers/unico");

const hayBaseDeDatos = Boolean(process.env.DB_HOST);
const describirSiHayBD = hayBaseDeDatos ? describe : describe.skip;

// Un documento con enlaces no se elimina: se corrige con una nueva versión y la
// anterior queda en el historial, de solo lectura, con su vista previa.
describirSiHayBD("Bloqueo de eliminación y versiones de documentos (integración)", () => {
  let app;
  let pool;
  let token;
  const sufijo = sufijoUnico();
  const ids = {};
  const serie = `SN-VER-${sufijo}`;
  const codigoPry = `PRY-VE-${sufijo}`;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "secreto-de-pruebas";
    pool = crearPool();
    const q = (sql, p) => pool.query(sql, p).then(([r]) => r);
    const passwordHash = await bcrypt.hash("ClaveSegura123", 10);
    ids.usuario = (
      await q(
        "INSERT INTO usuarios (nombre, correo, password_hash, rol, activo) VALUES (?, ?, ?, 'tester', 1)",
        [`Versiones ${sufijo}`, `versiones-${sufijo}@speal.test`, passwordHash]
      )
    ).insertId;
    token = jwt.sign(
      { id: ids.usuario, correo: `versiones-${sufijo}@speal.test`, rol: "tester" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    const cliente = async (letra) =>
      (
        await q(
          `INSERT INTO clientes (nombre_razon_social, tipo_identificacion, numero_identificacion, created_by)
           VALUES (?, 'NIT', ?, ?)`,
          [`Cliente Versiones ${letra} ${sufijo}`, `VER-${letra}-${sufijo}`, ids.usuario]
        )
      ).insertId;
    ids.cliente = await cliente("A");
    ids.otroCliente = await cliente("B");
    ids.proyecto = (
      await q(
        `INSERT INTO proyectos (codigo_pry, cliente_id, nombre_proyecto, estado, responsable_id)
         VALUES (?, ?, 'Nombre original', 'instalacion', ?)`,
        [codigoPry, ids.cliente, ids.usuario]
      )
    ).insertId;
    ids.expediente = (
      await q(
        `INSERT INTO expedientes_diseno (codigo_expediente, proyecto_id, producto_nombre, numero_serie, responsable_diseno_id, estado_liberacion)
         VALUES (?, ?, 'Planta', ?, ?, 'aprobado')`,
        [`EXP-VE-${sufijo}`, ids.proyecto, serie, ids.usuario]
      )
    ).insertId;
    await q(
      `INSERT INTO equipos (numero_serie, cliente_id, proyecto_id, expediente_id, descripcion, origen)
       VALUES (?, ?, ?, ?, 'Planta', 'expediente')`,
      [serie, ids.cliente, ids.proyecto, ids.expediente]
    );
    ids.proveedor = (
      await q(
        `INSERT INTO proveedores (nit_cc, razon_social, tipo_persona, origen, clasificacion, created_by)
         VALUES (?, ?, 'juridica', 'nacional', 'productos', ?)`,
        [`PROV-VE-${sufijo}`, `Proveedor Versiones ${sufijo}`, ids.usuario]
      )
    ).insertId;
    ids.requisicion = (
      await q(
        `INSERT INTO requisiciones (numero_requisicion, proyecto_id, solicitante_id, procedencia, estado)
         VALUES (?, ?, ?, 'nacional', 'convertida_oc')`,
        [`REQ-VE-${sufijo}`, ids.proyecto, ids.usuario]
      )
    ).insertId;
    app = crearApp();
  });

  afterAll(async () => {
    const q = (sql, p) => pool.query(sql, p);
    await q("DELETE FROM documento_versiones WHERE reemplazada_por = ?", [ids.usuario]);
    await q("DELETE FROM auditoria WHERE usuario_id = ?", [ids.usuario]);
    await q("DELETE FROM notificaciones WHERE usuario_id = ?", [ids.usuario]);
    await q(
      "DELETE i FROM acta_items_verificados i JOIN actas_cierre_satisfaccion a ON a.id = i.acta_id WHERE a.proyecto_id = ?",
      [ids.proyecto]
    );
    await q("DELETE FROM actas_cierre_satisfaccion WHERE proyecto_id = ?", [ids.proyecto]);
    await q(
      "DELETE i FROM acta_entrega_items i JOIN actas_entrega_equipos a ON a.id = i.acta_id WHERE a.proyecto_id = ?",
      [ids.proyecto]
    );
    await q("DELETE FROM actas_entrega_equipos WHERE proyecto_id = ?", [ids.proyecto]);
    await q("DELETE FROM reportes_servicio_tecnico WHERE proyecto_id = ?", [ids.proyecto]);
    await q(
      "DELETE oci FROM orden_compra_items oci JOIN ordenes_compra oc ON oc.id = oci.orden_compra_id WHERE oc.requisicion_id = ?",
      [ids.requisicion]
    );
    await q("DELETE FROM ordenes_compra WHERE requisicion_id = ?", [ids.requisicion]);
    await q("DELETE FROM requisiciones WHERE id = ?", [ids.requisicion]);
    await q("DELETE FROM proveedores WHERE id = ?", [ids.proveedor]);
    await q("DELETE FROM equipos WHERE expediente_id = ?", [ids.expediente]);
    await q("DELETE FROM expedientes_diseno WHERE id = ?", [ids.expediente]);
    await q("UPDATE proyectos SET cotizacion_id = NULL WHERE id = ?", [ids.proyecto]);
    await q(
      "DELETE ci FROM cotizacion_items ci JOIN cotizaciones c ON c.id = ci.cotizacion_id WHERE c.cliente_id = ?",
      [ids.cliente]
    );
    await q("DELETE FROM cotizaciones WHERE cliente_id = ?", [ids.cliente]);
    await q("DELETE FROM proyectos WHERE id = ?", [ids.proyecto]);
    await q("DELETE FROM clientes WHERE id IN (?, ?)", [ids.cliente, ids.otroCliente]);
    await q("DELETE FROM usuarios WHERE id = ?", [ids.usuario]);
    await pool.end();
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });
  const get = (ruta) => request(app).get(ruta).set(auth());
  const post = (ruta, cuerpo) => request(app).post(ruta).set(auth()).send(cuerpo);
  const historial = async (tabla, id) => (await get(`/versiones/${tabla}/${id}`)).body;

  describe("Proyecto", () => {
    test("con documentos enlazados no se elimina y dice qué lo bloquea", async () => {
      const r = await request(app)
        .delete(`/proyectos/${ids.proyecto}`)
        .set(auth())
        .send({ password: "ClaveSegura123", justificacion: "Duplicado" });
      expect(r.status).toBe(409);
      expect(r.body.error).toContain(codigoPry);
      expect(r.body.detalle.documentos).toEqual(
        expect.objectContaining({ expedientes: 1, requisiciones: 1, equipos: 1 })
      );
    });

    test("se corrige con una nueva versión y la anterior queda en el historial", async () => {
      const sinMotivo = await post(`/proyectos/${ids.proyecto}/versiones`, {
        nombre_proyecto: "Nombre corregido",
      });
      expect(sinMotivo.status).toBe(400);

      const r = await post(`/proyectos/${ids.proyecto}/versiones`, {
        nombre_proyecto: "Nombre corregido",
        motivo: "El nombre no coincidía con el contrato",
      });
      expect(r.status).toBe(200);
      expect(r.body.proyecto.version).toBe(2);
      expect(r.body.proyecto.nombre_proyecto).toBe("Nombre corregido");

      const h = await historial("proyectos", ids.proyecto);
      expect(h.version_vigente).toBe(2);
      expect(h.anteriores).toHaveLength(1);
      expect(h.anteriores[0]).toEqual(
        expect.objectContaining({
          version: 1,
          motivo: "El nombre no coincidía con el contrato",
          reemplazada_por: `Versiones ${sufijo}`,
        })
      );
      expect(h.anteriores[0].instantanea.nombre_proyecto).toBe("Nombre original");
    });
  });

  describe("Orden de compra", () => {
    test("pendiente de aprobar se puede eliminar; aprobada no, y su versión vuelve a aprobación", async () => {
      const crear = (precio) =>
        post("/ordenes-compra", {
          requisicion_id: ids.requisicion,
          proveedor_id: ids.proveedor,
          items: [{ descripcion: "Compresor", cantidad: 1, precio_unitario: precio }],
        });

      const borrable = await crear(100);
      const eliminada = await request(app)
        .delete(`/ordenes-compra/${borrable.body.orden.id}`)
        .set(auth());
      expect(eliminada.status).toBe(204);

      const oc = (await crear(1000)).body.orden;
      const aprobar = await request(app)
        .patch(`/ordenes-compra/${oc.id}/estado`)
        .set(auth())
        .send({ estado: "aprobada_pte_pago" });
      expect(aprobar.status).toBe(200);

      const bloqueada = await request(app).delete(`/ordenes-compra/${oc.id}`).set(auth());
      expect(bloqueada.status).toBe(409);
      const edicion = await request(app)
        .put(`/ordenes-compra/${oc.id}`)
        .set(auth())
        .send({ items: [{ descripcion: "Compresor", cantidad: 1, precio_unitario: 1200 }] });
      expect(edicion.status).toBe(409);

      const version = await post(`/ordenes-compra/${oc.id}/versiones`, {
        motivo: "El proveedor actualizó el precio",
        items: [{ descripcion: "Compresor", cantidad: 1, precio_unitario: 1200 }],
      });
      expect(version.status).toBe(200);
      expect(version.body.orden).toEqual(
        expect.objectContaining({ version: 2, estado: "pte_aprobar", aprobado_por: null })
      );
      const h = await historial("ordenes_compra", oc.id);
      expect(h.anteriores[0].instantanea.estado).toBe("aprobada_pte_pago");
      expect(Number(h.anteriores[0].instantanea.items[0].precio_unitario)).toBe(1000);
    });
  });

  describe("Cotización", () => {
    test("la de origen de un proyecto no se elimina y se versiona aunque ya no esté en borrador", async () => {
      const creada = await post("/cotizaciones", {
        cliente_id: ids.cliente,
        asesor_comercial_id: ids.usuario,
        items: [{ descripcion: "Planta", cantidad: 1, valor_unitario: 5000 }],
      });
      expect(creada.status).toBe(201);
      const id = creada.body.cotizacion.id;
      for (const estado of ["revision", "aprobacion", "enviada", "aceptada"]) {
        const r = await request(app)
          .patch(`/cotizaciones/${id}/estado`)
          .set(auth())
          .send({ estado });
        expect(r.status).toBe(200);
      }
      await pool.query("UPDATE proyectos SET cotizacion_id = ? WHERE id = ?", [id, ids.proyecto]);

      const bloqueada = await request(app).delete(`/cotizaciones/${id}`).set(auth());
      expect(bloqueada.status).toBe(409);
      expect(bloqueada.body.error).toContain(codigoPry);

      const version = await post(`/cotizaciones/${id}/versiones`, {
        motivo: "Se corrige la vigencia acordada",
        fecha_validez: "2026-12-31",
      });
      expect(version.status).toBe(200);
      expect(version.body.cotizacion).toEqual(
        expect.objectContaining({ version: 2, estado: "aceptada" })
      );
    });
  });

  describe("Reportes y actas", () => {
    test("no se eliminan; la versión guarda la copia, y si la corrección no es válida no queda nada", async () => {
      const reporte = (
        await post("/reportes-servicio-tecnico", {
          equipo_numero_serie: serie,
          cliente_id: ids.cliente,
          tipo_servicio: "instalacion",
        })
      ).body.reporte;
      expect(
        (await request(app).delete(`/reportes-servicio-tecnico/${reporte.id}`).set(auth())).status
      ).toBe(409);

      const invalida = await post(`/reportes-servicio-tecnico/${reporte.id}/versiones`, {
        motivo: "Prueba de corrección inválida",
        cliente_id: ids.otroCliente,
      });
      expect(invalida.status).toBe(400);
      const sinCambios = await historial("reportes_servicio_tecnico", reporte.id);
      expect(sinCambios).toEqual({ version_vigente: 1, anteriores: [] });

      const valida = await post(`/reportes-servicio-tecnico/${reporte.id}/versiones`, {
        motivo: "Faltaban los hallazgos",
        hallazgos: "Fuga en la línea de salida",
      });
      expect(valida.status).toBe(200);
      expect(valida.body.reporte.version).toBe(2);

      const acta = (
        await post("/actas-entrega-equipos", {
          proyecto_id: ids.proyecto,
          cliente_id: ids.cliente,
          objeto: "Entrega",
          receptor_nombre: "Receptor",
          items: [{ descripcion_equipo: "Planta", cantidad: 1, numero_serie: serie, cumple: "si" }],
        })
      ).body.acta;
      expect(
        (await request(app).delete(`/actas-entrega-equipos/${acta.id}`).set(auth())).status
      ).toBe(409);
      const versionActa = await post(`/actas-entrega-equipos/${acta.id}/versiones`, {
        motivo: "Se corrige el nombre de quien recibe",
        receptor_nombre: "Ing. Camila Torres",
      });
      expect(versionActa.status).toBe(200);
      const h = await historial("actas_entrega_equipos", acta.id);
      expect(h.anteriores[0].instantanea.receptor_nombre).toBe("Receptor");
      expect(h.anteriores[0].instantanea.items).toHaveLength(1);

      const cierre = (
        await post("/actas-cierre-satisfaccion", {
          proyecto_id: ids.proyecto,
          cliente_id: ids.cliente,
          acta_entrega_id: acta.id,
          tipo_entrega: "venta",
          tipo_documento_referencia: "contrato",
          objeto: "Cierre",
          receptor_cliente_nombre: "Gerente",
          items: [{ elemento: "Planta", cantidad: 1, cumple: "si" }],
        })
      ).body.acta;
      expect(
        (await request(app).delete(`/actas-cierre-satisfaccion/${cierre.id}`).set(auth())).status
      ).toBe(409);
      const versionCierre = await post(`/actas-cierre-satisfaccion/${cierre.id}/versiones`, {
        motivo: "Se corrige el objeto",
        objeto: "Cierre a satisfacción de la planta PSA",
      });
      expect(versionCierre.status).toBe(200);
      expect(versionCierre.body.acta.version).toBe(2);
    });

    test("el historial solo existe para los documentos con versiones", async () => {
      expect((await get("/versiones/clientes/1")).status).toBe(400);
    });
  });
});
