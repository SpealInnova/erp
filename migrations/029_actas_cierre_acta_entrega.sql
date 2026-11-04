ALTER TABLE actas_cierre_satisfaccion
  ADD COLUMN acta_entrega_id INT UNSIGNED NULL AFTER cliente_id,
  ADD CONSTRAINT fk_actas_cierre_acta_entrega FOREIGN KEY (acta_entrega_id)
    REFERENCES actas_entrega_equipos(id);
