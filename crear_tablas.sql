CREATE TABLE IF NOT EXISTS activos_fijos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS items_activos (
    id SERIAL PRIMARY KEY,
    id_activo INTEGER REFERENCES activos_fijos(id) ON DELETE CASCADE,
    codigo_inventario VARCHAR(50) UNIQUE NOT NULL,
    fecha_entrega DATE NULL,
    fecha_retiro DATE NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'buen_estado', -- 'buen_estado', 'regular', 'danado', 'en_mantenimiento'
    observaciones TEXT,
    precio NUMERIC(10, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contenedores_materiales (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    ubicacion VARCHAR(150) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS materiales_fungibles (
    id SERIAL PRIMARY KEY,
    id_contenedor INTEGER REFERENCES contenedores_materiales(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    categoria VARCHAR(50) NOT NULL,
    descripcion TEXT,
    unidad VARCHAR(20) NOT NULL, -- Ej. Litros, Piezas, Cajas
    stock_minimo INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lotes_materiales (
    id SERIAL PRIMARY KEY,
    id_material INTEGER REFERENCES materiales_fungibles(id) ON DELETE CASCADE,
    lote VARCHAR(50) NOT NULL,
    fecha_entrega DATE NULL,
    fecha_retiro DATE NULL,
    cantidad_disponible INTEGER DEFAULT 0,
    fecha_caducidad DATE NULL,
    precio NUMERIC(10, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS movimientos_materiales (
    id SERIAL PRIMARY KEY,
    id_lote INTEGER NOT NULL REFERENCES lotes_materiales(id) ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL,
    cantidad INTEGER NOT NULL,
    motivo TEXT NOT NULL,
    referencia VARCHAR(120) NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS estudiantes (
    id SERIAL PRIMARY KEY,
    carnet VARCHAR(30) UNIQUE NOT NULL,
    nombre VARCHAR(80) NOT NULL,
    apellido VARCHAR(80) NOT NULL,
    carrera VARCHAR(120) NOT NULL,
    semestre INTEGER NOT NULL,
    carnet_retenido BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS docentes (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(30) UNIQUE NOT NULL,
    nombre VARCHAR(80) NOT NULL,
    apellido VARCHAR(80) NOT NULL,
    materia VARCHAR(80) NOT NULL,
    carnet VARCHAR(30) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS prestamos (
    id SERIAL PRIMARY KEY,
    id_estudiante INTEGER NOT NULL REFERENCES estudiantes(id) ON DELETE RESTRICT,
    id_docente INTEGER NOT NULL REFERENCES docentes(id) ON DELETE RESTRICT,
    id_item_activo INTEGER NULL REFERENCES items_activos(id) ON DELETE SET NULL,
    codigo_herramienta VARCHAR(50) NOT NULL,
    fecha_prestamo TIMESTAMP NOT NULL,
    fecha_devolucion TIMESTAMP NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    observaciones TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auditoria_eventos (
    id SERIAL PRIMARY KEY,
    entidad VARCHAR(80) NOT NULL,
    entidad_id VARCHAR(80) NOT NULL,
    accion VARCHAR(20) NOT NULL,
    detalle JSONB NOT NULL,
    hash_previo VARCHAR(64) NULL,
    hash_actual VARCHAR(64) NOT NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE IF EXISTS prestamos
    ALTER COLUMN fecha_prestamo TYPE TIMESTAMP USING fecha_prestamo::timestamp,
    ALTER COLUMN fecha_devolucion TYPE TIMESTAMP USING fecha_devolucion::timestamp;

-- Migración segura para bases existentes
ALTER TABLE IF EXISTS items_activos
    ADD COLUMN IF NOT EXISTS fecha_entrega DATE NULL,
    ADD COLUMN IF NOT EXISTS fecha_retiro DATE NULL;

ALTER TABLE IF EXISTS lotes_materiales
    ADD COLUMN IF NOT EXISTS fecha_entrega DATE NULL,
    ADD COLUMN IF NOT EXISTS fecha_retiro DATE NULL;

ALTER TABLE IF EXISTS items_activos
    DROP CONSTRAINT IF EXISTS chk_items_activos_estado,
    ADD CONSTRAINT chk_items_activos_estado CHECK (
        estado IN (
            'buen_estado',
            'regular',
            'en_mantenimiento',
            'en_prestamo',
            'revision',
            'dado_de_baja',
            'danado'
        )
    );

CREATE OR REPLACE FUNCTION validar_transicion_estado_item_activo()
RETURNS trigger AS $$
BEGIN
    IF NEW.estado = OLD.estado THEN
        RETURN NEW;
    END IF;

    IF OLD.estado = 'dado_de_baja' THEN
        RAISE EXCEPTION 'No se permiten transiciones desde dado_de_baja';
    END IF;

    IF OLD.estado = 'en_prestamo' AND NEW.estado = 'dado_de_baja' THEN
        RAISE EXCEPTION 'Transicion no permitida: en_prestamo -> dado_de_baja sin revision';
    END IF;

    IF NEW.estado = 'dado_de_baja' AND NEW.fecha_retiro IS NULL THEN
        RAISE EXCEPTION 'Para estado dado_de_baja se requiere fecha_retiro';
    END IF;

    IF OLD.estado = 'buen_estado' AND NEW.estado NOT IN ('regular', 'en_mantenimiento', 'en_prestamo', 'revision') THEN
        RAISE EXCEPTION 'Transicion no permitida desde buen_estado a %', NEW.estado;
    ELSIF OLD.estado = 'regular' AND NEW.estado NOT IN ('buen_estado', 'en_mantenimiento', 'en_prestamo', 'revision') THEN
        RAISE EXCEPTION 'Transicion no permitida desde regular a %', NEW.estado;
    ELSIF OLD.estado = 'en_mantenimiento' AND NEW.estado NOT IN ('buen_estado', 'regular', 'revision') THEN
        RAISE EXCEPTION 'Transicion no permitida desde en_mantenimiento a %', NEW.estado;
    ELSIF OLD.estado = 'en_prestamo' AND NEW.estado NOT IN ('revision', 'buen_estado') THEN
        RAISE EXCEPTION 'Transicion no permitida desde en_prestamo a %', NEW.estado;
    ELSIF OLD.estado = 'revision' AND NEW.estado NOT IN ('buen_estado', 'regular', 'en_mantenimiento', 'dado_de_baja') THEN
        RAISE EXCEPTION 'Transicion no permitida desde revision a %', NEW.estado;
    ELSIF OLD.estado = 'danado' AND NEW.estado NOT IN ('revision', 'dado_de_baja') THEN
        RAISE EXCEPTION 'Transicion no permitida desde danado a %', NEW.estado;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validar_transicion_estado_item_activo ON items_activos;
CREATE TRIGGER trg_validar_transicion_estado_item_activo
BEFORE UPDATE OF estado, fecha_retiro ON items_activos
FOR EACH ROW
EXECUTE FUNCTION validar_transicion_estado_item_activo();

ALTER TABLE IF EXISTS estudiantes
    ADD COLUMN IF NOT EXISTS carnet_retenido BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_prestamos_estado_fecha_devolucion
    ON prestamos (estado, fecha_devolucion);

CREATE INDEX IF NOT EXISTS idx_prestamos_id_estudiante
    ON prestamos (id_estudiante);

CREATE INDEX IF NOT EXISTS idx_prestamos_codigo_herramienta
    ON prestamos (codigo_herramienta);

CREATE INDEX IF NOT EXISTS idx_estudiantes_carnet_retenido
    ON estudiantes (carnet_retenido);

CREATE INDEX IF NOT EXISTS idx_auditoria_entidad_entidad_id
    ON auditoria_eventos (entidad, entidad_id);

CREATE INDEX IF NOT EXISTS idx_auditoria_fecha
    ON auditoria_eventos (fecha);

CREATE INDEX IF NOT EXISTS idx_movimientos_materiales_lote_fecha
    ON movimientos_materiales (id_lote, fecha);

CREATE OR REPLACE FUNCTION bloquear_update_delete_auditoria_eventos()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'La tabla auditoria_eventos es inmutable: solo se permiten inserts';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bloquear_update_auditoria_eventos ON auditoria_eventos;
CREATE TRIGGER trg_bloquear_update_auditoria_eventos
BEFORE UPDATE ON auditoria_eventos
FOR EACH ROW
EXECUTE FUNCTION bloquear_update_delete_auditoria_eventos();

DROP TRIGGER IF EXISTS trg_bloquear_delete_auditoria_eventos ON auditoria_eventos;
CREATE TRIGGER trg_bloquear_delete_auditoria_eventos
BEFORE DELETE ON auditoria_eventos
FOR EACH ROW
EXECUTE FUNCTION bloquear_update_delete_auditoria_eventos();

-- Semillas mínimas de demostración (excepto usuarios)
INSERT INTO activos_fijos (nombre)
SELECT 'Taladro de prueba'
WHERE NOT EXISTS (
        SELECT 1 FROM activos_fijos WHERE nombre = 'Taladro de prueba'
);

INSERT INTO items_activos (id_activo, codigo_inventario, fecha_entrega, fecha_retiro, estado, observaciones, precio)
SELECT
        a.id,
        'ACT-TEST-001',
        DATE '2026-03-01',
        NULL,
        'buen_estado',
        'Item de prueba',
        1200.00
FROM activos_fijos a
WHERE a.nombre = 'Taladro de prueba'
    AND NOT EXISTS (
        SELECT 1 FROM items_activos WHERE codigo_inventario = 'ACT-TEST-001'
    );

INSERT INTO items_activos (id_activo, codigo_inventario, fecha_entrega, fecha_retiro, estado, observaciones, precio)
SELECT
        a.id,
        'ACT-TEST-002',
        DATE '2026-02-15',
        DATE '2026-03-09',
        'regular',
        'Item retirado para mantenimiento',
        980.00
FROM activos_fijos a
WHERE a.nombre = 'Taladro de prueba'
    AND NOT EXISTS (
        SELECT 1 FROM items_activos WHERE codigo_inventario = 'ACT-TEST-002'
    );

INSERT INTO contenedores_materiales (nombre, ubicacion)
SELECT 'Contenedor prueba', 'Laboratorio'
WHERE NOT EXISTS (
        SELECT 1 FROM contenedores_materiales WHERE nombre = 'Contenedor prueba' AND ubicacion = 'Laboratorio'
);

INSERT INTO materiales_fungibles (id_contenedor, nombre, categoria, descripcion, unidad, stock_minimo)
SELECT
        c.id,
        'Cable de prueba',
        'Material eléctrico',
        'Caja/material de prueba',
        'metros',
        5
FROM contenedores_materiales c
WHERE c.nombre = 'Contenedor prueba'
    AND c.ubicacion = 'Laboratorio'
    AND NOT EXISTS (
        SELECT 1 FROM materiales_fungibles WHERE nombre = 'Cable de prueba'
    );

INSERT INTO lotes_materiales (id_material, lote, fecha_entrega, fecha_retiro, cantidad_disponible, fecha_caducidad, precio)
SELECT
        m.id,
        'LOTE-TEST-001',
        DATE '2026-03-02',
        NULL,
        25,
        NULL,
        3.50
FROM materiales_fungibles m
WHERE m.nombre = 'Cable de prueba'
    AND NOT EXISTS (
        SELECT 1 FROM lotes_materiales WHERE lote = 'LOTE-TEST-001'
    );

INSERT INTO lotes_materiales (id_material, lote, fecha_entrega, fecha_retiro, cantidad_disponible, fecha_caducidad, precio)
SELECT
        m.id,
        'LOTE-TEST-002',
        DATE '2026-01-20',
        DATE '2026-03-06',
        8,
        DATE '2027-01-30',
        3.80
FROM materiales_fungibles m
WHERE m.nombre = 'Cable de prueba'
    AND NOT EXISTS (
        SELECT 1 FROM lotes_materiales WHERE lote = 'LOTE-TEST-002'
    );

INSERT INTO estudiantes (carnet, nombre, apellido, carrera, semestre)
SELECT '2021-15430', 'Carlos Eduardo', 'Mamani Quispe', 'Ing. Electronica', 6
WHERE NOT EXISTS (SELECT 1 FROM estudiantes WHERE carnet = '2021-15430');

INSERT INTO estudiantes (carnet, nombre, apellido, carrera, semestre)
SELECT '2022-08712', 'Lucia Fernanda', 'Torrez Mamani', 'Ing. Industrial', 4
WHERE NOT EXISTS (SELECT 1 FROM estudiantes WHERE carnet = '2022-08712');

INSERT INTO estudiantes (carnet, nombre, apellido, carrera, semestre)
SELECT '2020-33891', 'Rodrigo Andres', 'Vasquez Chavez', 'Ing. Mecanica', 8
WHERE NOT EXISTS (SELECT 1 FROM estudiantes WHERE carnet = '2020-33891');

INSERT INTO docentes (codigo, nombre, apellido, materia, carnet)
SELECT 'DOC-001', 'Alan', 'Brito', 'SIS245', '1234567'
WHERE NOT EXISTS (SELECT 1 FROM docentes WHERE codigo = 'DOC-001');

INSERT INTO docentes (codigo, nombre, apellido, materia, carnet)
SELECT 'DOC-002', 'Maria', 'Lopez', 'SIS104', '7654321'
WHERE NOT EXISTS (SELECT 1 FROM docentes WHERE codigo = 'DOC-002');

INSERT INTO docentes (codigo, nombre, apellido, materia, carnet)
SELECT 'DOC-003', 'Armando', 'Casas', 'SIS101', '3456789'
WHERE NOT EXISTS (SELECT 1 FROM docentes WHERE codigo = 'DOC-003');

INSERT INTO prestamos (id_estudiante, id_docente, id_item_activo, codigo_herramienta, fecha_prestamo, fecha_devolucion, estado, observaciones)
SELECT
        e.id,
        d.id,
        ia.id,
        'S01',
        TIMESTAMP '2026-03-01 08:00:00',
        NULL,
        'pendiente',
        'Para practica de automatizacion'
FROM estudiantes e
JOIN docentes d ON d.codigo = 'DOC-001'
LEFT JOIN items_activos ia ON ia.codigo_inventario = 'ACT-TEST-001'
WHERE e.carnet = '2021-15430'
    AND NOT EXISTS (SELECT 1 FROM prestamos WHERE codigo_herramienta = 'S01' AND fecha_prestamo = TIMESTAMP '2026-03-01 08:00:00');

INSERT INTO prestamos (id_estudiante, id_docente, id_item_activo, codigo_herramienta, fecha_prestamo, fecha_devolucion, estado, observaciones)
SELECT
        e.id,
        d.id,
        ia.id,
        'S03',
        TIMESTAMP '2026-02-25 09:30:00',
        NULL,
        'vencido',
        'No devolvio en fecha acordada'
FROM estudiantes e
JOIN docentes d ON d.codigo = 'DOC-003'
LEFT JOIN items_activos ia ON ia.codigo_inventario = 'ACT-TEST-002'
WHERE e.carnet = '2022-08712'
    AND NOT EXISTS (SELECT 1 FROM prestamos WHERE codigo_herramienta = 'S03' AND fecha_prestamo = TIMESTAMP '2026-02-25 09:30:00');
