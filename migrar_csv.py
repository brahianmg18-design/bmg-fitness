import csv
import os

import psycopg2
from psycopg2.extras import RealDictCursor


DATABASE_URL = os.getenv("DATABASE_URL")
CSV_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "usuarios.csv")


def valor_fila(row, *keys, default=""):
    for key in keys:
        value = row.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return default


def valor_numerico(row, keys, default, convertir=float):
    value = valor_fila(row, *keys)
    return convertir(value) if value else default


def migrar():
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    cursor = conn.cursor()
    registros = 0

    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS usuarios (
                usuario TEXT PRIMARY KEY,
                email TEXT NOT NULL,
                password TEXT NOT NULL,
                rol TEXT NOT NULL DEFAULT 'usuario',
                edad INTEGER NOT NULL DEFAULT 30,
                sexo TEXT NOT NULL DEFAULT 'masculino',
                peso DOUBLE PRECISION NOT NULL DEFAULT 70,
                estatura DOUBLE PRECISION NOT NULL DEFAULT 1.70,
                actividad DOUBLE PRECISION NOT NULL DEFAULT 1.55,
                objetivo TEXT NOT NULL DEFAULT 'Ganar masa muscular',
                nivel_experiencia TEXT NOT NULL DEFAULT 'Principiante',
                objetivo_nutricional TEXT NOT NULL DEFAULT 'Mantenimiento',
                objetivo_entrenamiento TEXT NOT NULL DEFAULT 'Hipertrofia (Masa)',
                dias_entrenamiento INTEGER NOT NULL DEFAULT 4
            )
        """)
        cursor.execute("""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'usuarios' AND column_name = 'contrasena'
                ) AND NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'usuarios' AND column_name = 'password'
                ) THEN
                    ALTER TABLE usuarios RENAME COLUMN contrasena TO password;
                END IF;
            END $$
        """)
        cursor.execute("""
            ALTER TABLE usuarios
            ADD COLUMN IF NOT EXISTS rol TEXT NOT NULL DEFAULT 'usuario'
        """)
        cursor.execute("""
            ALTER TABLE usuarios
            ADD COLUMN IF NOT EXISTS nivel_experiencia TEXT NOT NULL DEFAULT 'Principiante',
            ADD COLUMN IF NOT EXISTS objetivo_nutricional TEXT,
            ADD COLUMN IF NOT EXISTS objetivo_entrenamiento TEXT
        """)
        cursor.execute("""
            UPDATE usuarios
            SET objetivo_nutricional = CASE
                    WHEN LOWER(objetivo) LIKE '%grasa%' THEN 'Perder Grasa (Déficit)'
                    WHEN LOWER(objetivo) LIKE '%masa%' THEN 'Ganar Peso/Músculo (Superávit)'
                    ELSE 'Mantenimiento'
                END
            WHERE objetivo_nutricional IS NULL
        """)
        cursor.execute("""
            UPDATE usuarios
            SET objetivo_entrenamiento = CASE
                    WHEN LOWER(objetivo) LIKE '%masa%' THEN 'Hipertrofia (Masa)'
                    WHEN LOWER(objetivo) LIKE '%grasa%' OR LOWER(objetivo) LIKE '%defin%' THEN 'Fuerza/Definición'
                    ELSE 'Acondicionamiento General'
                END
            WHERE objetivo_entrenamiento IS NULL
        """)
        cursor.execute("""
            ALTER TABLE usuarios
            ALTER COLUMN objetivo_nutricional SET DEFAULT 'Mantenimiento',
            ALTER COLUMN objetivo_nutricional SET NOT NULL,
            ALTER COLUMN objetivo_entrenamiento SET DEFAULT 'Hipertrofia (Masa)',
            ALTER COLUMN objetivo_entrenamiento SET NOT NULL
        """)

        with open(CSV_FILE, mode="r", encoding="utf-8-sig", newline="") as file:
            reader = csv.DictReader(file)
            for row in reader:
                if not any(str(value or "").strip() for value in row.values()):
                    continue

                usuario = valor_fila(row, "usuario", "Usuario")
                password = valor_fila(row, "password", "contrasena", "contraseña", "Contraseña")
                if not usuario or not password:
                    raise ValueError("Cada registro debe incluir usuario y contraseña.")

                edad = valor_numerico(row, ("edad", "Edad"), 30, int)
                peso = valor_numerico(row, ("peso", "Peso"), 70.0)
                estatura = valor_numerico(row, ("estatura", "Estatura"), 1.70)
                if estatura > 3:
                    estatura /= 100
                objetivo = valor_fila(row, "objetivo", "Objetivo", default="Mantenimiento y Definición")
                objetivo_nutricional = valor_fila(row, "objetivo_nutricional", "ObjetivoNutricional")
                if not objetivo_nutricional:
                    objetivo_nutricional = (
                        "Perder Grasa (Déficit)" if "grasa" in objetivo.lower()
                        else "Ganar Peso/Músculo (Superávit)" if "masa" in objetivo.lower()
                        else "Mantenimiento"
                    )
                objetivo_entrenamiento = valor_fila(row, "objetivo_entrenamiento", "ObjetivoEntrenamiento")
                if not objetivo_entrenamiento:
                    objetivo_entrenamiento = (
                        "Hipertrofia (Masa)" if "masa" in objetivo.lower()
                        else "Fuerza/Definición" if "grasa" in objetivo.lower() or "defin" in objetivo.lower()
                        else "Acondicionamiento General"
                    )

                cursor.execute("""
                    INSERT INTO usuarios (
                        usuario, email, password, rol, edad, sexo, peso, estatura,
                        actividad, objetivo, nivel_experiencia, objetivo_nutricional,
                        objetivo_entrenamiento, dias_entrenamiento
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (usuario) DO NOTHING
                """, (
                    usuario,
                    valor_fila(row, "email", "Correo", "correo"),
                    password,
                    valor_fila(row, "rol", "Rol", default="usuario"),
                    edad,
                    valor_fila(row, "sexo", "Sexo", default="masculino"),
                    peso,
                    estatura,
                    valor_numerico(row, ("actividad", "Actividad"), 1.55),
                    objetivo,
                    valor_fila(row, "nivel_experiencia", "NivelExperiencia", default="Principiante"),
                    objetivo_nutricional,
                    objetivo_entrenamiento,
                    valor_numerico(row, ("dias_entrenamiento", "DiasEntrenamiento"), 4, int),
                ))
                registros += cursor.rowcount

        conn.commit()
        print(f"Migración exitosa: {registros} registros insertados en Neon.")
    except Exception as error:
        conn.rollback()
        print(f"Error en la migración: {error}")
        raise
    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    migrar()