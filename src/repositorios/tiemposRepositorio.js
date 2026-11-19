// Consultas de "Tiempos y KPI": cuánto tarda cada fase, actividad y tarea
// frente a lo planeado. `desde` (Date o null) limita lo finalizado al periodo;
// lo abierto siempre se incluye (es lo que está pasando ahora).

const SIN_LIMITE = new Date("1000-01-01T00:00:00");

// Cambios de fase de los proyectos vigentes, en orden.
async function transicionesDeProyectos(pool) {
  const [filas] = await pool.query(
    `SELECT t.registro_id AS proyecto_id, t.estado_nuevo, t.created_at,
            p.codigo_pry, p.nombre_proyecto, p.estado AS estado_proyecto
       FROM transiciones_estado t
       JOIN proyectos p ON p.id = t.registro_id AND p.deleted_at IS NULL
      WHERE t.entidad = 'proyecto'
      ORDER BY t.registro_id, t.created_at, t.id`
  );
  return filas;
}

// Plan de cada fase de cada proyecto: de la primera fecha de inicio a la
// última fecha de fin de sus actividades.
async function planPorFase(pool) {
  const [filas] = await pool.query(
    `SELECT proyecto_id, fase, MIN(fecha_inicio) AS plan_inicio, MAX(fecha_fin) AS plan_fin
       FROM proyecto_actividades
      WHERE deleted_at IS NULL AND fecha_inicio IS NOT NULL AND fecha_fin IS NOT NULL
      GROUP BY proyecto_id, fase`
  );
  return filas;
}

// Actividades finalizadas en el periodo y abiertas de proyectos vigentes.
async function actividades(pool, desde) {
  const [filas] = await pool.query(
    `SELECT a.id, a.proyecto_id, a.fase, a.categoria, a.descripcion, a.estado,
            a.fecha_inicio, a.fecha_fin, a.iniciada_en, a.completada_en, p.codigo_pry
       FROM proyecto_actividades a
       JOIN proyectos p ON p.id = a.proyecto_id AND p.deleted_at IS NULL
      WHERE a.deleted_at IS NULL
        AND ((a.estado = 'completada' AND a.completada_en >= ?)
             OR (a.estado <> 'completada' AND p.estado NOT IN ('cerrado', 'cancelado')))`,
    [desde || SIN_LIMITE]
  );
  return filas;
}

// Tareas (fuera de proyectos) finalizadas en el periodo.
async function tareasFinalizadas(pool, desde) {
  const [filas] = await pool.query(
    `SELECT id, fecha_inicio, fecha_fin, created_at, iniciada_en, completada_en
       FROM tareas
      WHERE deleted_at IS NULL AND estado = 'completada' AND completada_en >= ?`,
    [desde || SIN_LIMITE]
  );
  return filas;
}

module.exports = { transicionesDeProyectos, planPorFase, actividades, tareasFinalizadas };
