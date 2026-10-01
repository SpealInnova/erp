const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { crearApp } = require("../../src/app");
const { crearPool } = require("../../src/config/db");
const { sufijoUnico } = require("../helpers/unico");

const hayBaseDeDatos = Boolean(process.env.DB_HOST);
const describirSiHayBD = hayBaseDeDatos ? describe : describe.skip;

describirSiHayBD(
  "Verificaciones, Validaciones y Revisiones de diseño (integración contra BD real)",
  () => {
    let app;
    let pool;
    let usuarioId;
    let clienteId;
    let proyectoId;
    let expedienteId;
    let token;
    const correoUsuario = `bloque-c-test-${Date.now()}@speal.test`;

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
        ["Cliente para Bloque C", `BC-TEST-${Date.now()}`, usuarioId]
      );
      clienteId = cliente.insertId;

      const [proyecto] = await pool.query(
        `INSERT INTO proyectos (codigo_pry, cliente_id, nombre_proyecto, estado, responsable_id)
         VALUES (?, ?, 'Proyecto para Bloque C', 'prospecto', ?)`,
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
      await pool.query("DELETE FROM verificaciones WHERE expediente_id = ?", [expedienteId]);
      await pool.query("DELETE FROM validaciones WHERE expediente_id = ?", [expedienteId]);
      await pool.query("DELETE FROM revisiones_diseno WHERE expediente_id = ?", [expedienteId]);
      await pool.query("DELETE FROM expedientes_diseno WHERE id = ?", [expedienteId]);
      await pool.query("DELETE FROM proyectos WHERE id = ?", [proyectoId]);
      await pool.query("DELETE FROM clientes WHERE id = ?", [clienteId]);
      await pool.query("DELETE FROM usuarios WHERE id = ?", [usuarioId]);
      await pool.end();
    });

    const autorizacion = () => ({ Authorization: `Bearer ${token}` });

    test("crea una verificación y la lista", async () => {
      const crear = await request(app)
        .post(`/expedientes-diseno/${expedienteId}/verificaciones`)
        .set(autorizacion())
        .send({ requisito_verificado: "Caudal mínimo", metodo: "Medición en banco", resultado: "Cumple" });
      expect(crear.status).toBe(201);

      const listar = await request(app)
        .get(`/expedientes-diseno/${expedienteId}/verificaciones`)
        .set(autorizacion());
      expect(listar.status).toBe(200);
      expect(listar.body.verificaciones).toHaveLength(1);
    });

    test("crea una validación y la lista", async () => {
      const crear = await request(app)
        .post(`/expedientes-diseno/${expedienteId}/validaciones`)
        .set(autorizacion())
        .send({ aspecto_validado: "Uso en condiciones reales", resultado: "Satisfactorio" });
      expect(crear.status).toBe(201);

      const listar = await request(app)
        .get(`/expedientes-diseno/${expedienteId}/validaciones`)
        .set(autorizacion());
      expect(listar.status).toBe(200);
      expect(listar.body.validaciones).toHaveLength(1);
    });

    test("rechaza crear una revisión con un responsable inexistente", async () => {
      const respuesta = await request(app)
        .post(`/expedientes-diseno/${expedienteId}/revisiones-diseno`)
        .set(autorizacion())
        .send({ responsable_id: 999999999, hallazgos: "N/A" });
      expect(respuesta.status).toBe(400);
    });

    test("las revisiones se numeran automáticamente y en orden", async () => {
      const primera = await request(app)
        .post(`/expedientes-diseno/${expedienteId}/revisiones-diseno`)
        .set(autorizacion())
        .send({ responsable_id: usuarioId, hallazgos: "Falta cotizar un componente", cierre: "no" });
      expect(primera.status).toBe(201);
      expect(primera.body.revision.numero).toBe(1);

      const segunda = await request(app)
        .post(`/expedientes-diseno/${expedienteId}/revisiones-diseno`)
        .set(autorizacion())
        .send({ responsable_id: usuarioId, hallazgos: "Componente ya cotizado", cierre: "si" });
      expect(segunda.status).toBe(201);
      expect(segunda.body.revision.numero).toBe(2);
    });

    test("al liberar el expediente, ya no se pueden agregar verificaciones/validaciones/revisiones", async () => {
      await request(app)
        .patch(`/expedientes-diseno/${expedienteId}/estado`)
        .set(autorizacion())
        .send({ estado: "aprobado" });

      const verificacion = await request(app)
        .post(`/expedientes-diseno/${expedienteId}/verificaciones`)
        .set(autorizacion())
        .send({ requisito_verificado: "Otro" });
      expect(verificacion.status).toBe(409);

      const validacion = await request(app)
        .post(`/expedientes-diseno/${expedienteId}/validaciones`)
        .set(autorizacion())
        .send({ aspecto_validado: "Otro" });
      expect(validacion.status).toBe(409);

      const revision = await request(app)
        .post(`/expedientes-diseno/${expedienteId}/revisiones-diseno`)
        .set(autorizacion())
        .send({ responsable_id: usuarioId });
      expect(revision.status).toBe(409);
    });
  }
);
