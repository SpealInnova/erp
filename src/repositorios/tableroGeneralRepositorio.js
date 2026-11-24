// Consultas del tablero general: lo de cada usuario, de todos sus proyectos.

// Proyectos en los que participa: es su responsable, tiene actividades
// asignadas o está en el equipo. Con su avance.
async function proyectosDeUsuario(pool, usuarioId) {
  const [filas] = await pool.query(
    `SELECT p.id, p.codigo_pry, p.nombre_proyecto, p.estado,
            COUNT(a.id) AS actividades_total,
            COALESCE(SUM(a.estado = 'completada'), 0) AS actividades_finalizadas,
            COALESCE(SUM(a.estado <> 'completada' AND a.fecha_fin < CURDATE()), 0) AS vencidas,
            MAX(a.fecha_fin) AS plan_fin
       FROM proyectos p
       LEFT JOIN proyecto_actividades a ON a.proyecto_id = p.id AND a.deleted_at IS NULL
      WHERE p.deleted_at IS NULL AND p.estado NOT IN ('cerrado', 'cancelado')
        AND (p.responsable_id = ?
             OR EXISTS (SELECT 1 FROM proyecto_actividades x
                         WHERE x.proyecto_id = p.id AND x.deleted_at IS NULL AND x.responsable_id = ?)
             OR EXISTS (SELECT 1 FROM proyecto_equipo e
                         WHERE e.proyecto_id = p.id AND e.usuario_id = ? AND e.deleted_at IS NULL))
      GROUP BY p.id
      ORDER BY vencidas DESC, MAX(a.fecha_fin) IS NULL, MAX(a.fecha_fin), p.id DESC
      LIMIT 8`,
    [usuarioId, usuarioId, usuarioId]
  );
  return filas;
}

// Finalizadas este mes (actividades y tareas que eran del usuario) y cuántas
// a tiempo (finalizadas a más tardar en su fecha de fin).
async function cumplimientoDelMes(pool, usuarioId) {
  const [filas] = await pool.query(
    `SELECT COUNT(*) AS finalizadas,
            COALESCE(SUM(DATE(completada_en) <= fecha_fin), 0) AS a_tiempo,
            COALESCE(SUM(fecha_fin IS NOT NULL), 0) AS con_fecha
       FROM (
         SELECT completada_en, fecha_fin FROM proyecto_actividades
          WHERE deleted_at IS NULL AND estado = 'completada' AND completada_por = ?
            AND completada_en >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
         UNION ALL
         SELECT completada_en, fecha_fin FROM tareas
          WHERE deleted_at IS NULL AND estado = 'completada' AND responsable_id = ?
            AND completada_en >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
       ) x`,
    [usuarioId, usuarioId]
  );
  return filas[0];
}

// Lo finalizado por día en la semana en curso (lunes a domingo).
async function finalizadasDeLaSemana(pool, usuarioId) {
  const [filas] = await pool.query(
    `SELECT DATE(completada_en) AS dia, COUNT(*) AS n FROM (
       SELECT completada_en FROM proyecto_actividades
        WHERE deleted_at IS NULL AND estado = 'completada' AND completada_por = ?
       UNION ALL
       SELECT completada_en FROM tareas
        WHERE deleted_at IS NULL AND estado = 'completada' AND responsable_id = ?
     ) x
     WHERE completada_en >= CURDATE() - INTERVAL WEEKDAY(CURDATE()) DAY
     GROUP BY DATE(completada_en)`,
    [usuarioId, usuarioId]
  );
  return filas;
}

// Lo que espera la decisión del usuario según su cargo.
async function contarPorAprobar(pool, usuarioId) {
  const [[oc]] = await pool.query(
    `SELECT COALESCE(SUM(estado = 'pte_aprobar' AND (created_by IS NULL OR created_by <> ?)), 0) AS por_aprobar,
            COALESCE(SUM(estado = 'aprobada_pte_pago'), 0) AS por_pagar
       FROM ordenes_compra WHERE deleted_at IS NULL`,
    [usuarioId]
  );
  const [[cot]] = await pool.query(
    "SELECT COUNT(*) AS n FROM cotizaciones WHERE deleted_at IS NULL AND estado = 'aprobacion'"
  );
  const [[cambios]] = await pool.query(
    `SELECT COUNT(*) AS n FROM cambios_diseno cd
       JOIN expedientes_diseno e ON e.id = cd.expediente_id AND e.deleted_at IS NULL
      WHERE cd.deleted_at IS NULL AND cd.estado = 'pendiente'
        AND (cd.created_by IS NULL OR cd.created_by <> ?)`,
    [usuarioId]
  );
  return {
    oc_por_aprobar: Number(oc.por_aprobar),
    oc_por_pagar: Number(oc.por_pagar),
    cotizaciones_en_aprobacion: Number(cot.n),
    cambios_diseno_pendientes: Number(cambios.n),
  };
}

module.exports = {
  proyectosDeUsuario,
  cumplimientoDelMes,
  finalizadasDeLaSemana,
  contarPorAprobar,
};
