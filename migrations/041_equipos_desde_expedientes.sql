-- Carga en el registro los equipos que ya tienen expediente con número de
-- serie. Incluye los expedientes eliminados (con su misma fecha de
-- eliminación): puede haber reportes de servicio que apunten a esos seriales.
INSERT INTO equipos
  (numero_serie, cliente_id, proyecto_id, expediente_id, descripcion, modelo, origen,
   created_by, created_at, deleted_at)
SELECT e.numero_serie, p.cliente_id, e.proyecto_id, e.id, e.producto_nombre, e.modelo,
       'expediente', e.created_by, e.created_at, e.deleted_at
FROM expedientes_diseno e
JOIN proyectos p ON p.id = e.proyecto_id
WHERE e.numero_serie IS NOT NULL AND e.numero_serie <> ''
  AND NOT EXISTS (SELECT 1 FROM equipos q WHERE q.numero_serie = e.numero_serie);
