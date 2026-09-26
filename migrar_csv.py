import csv
import os

import psycopg2
from psycopg2.extras import RealDictCursor


DATABASE_URL = os.environ.get("DATABASE_URL") or (
    "postgresql://neondb_owner:npg_nzMfe7AXi9Pw@"
    "ep-sweet-block-b5v3e9mv-pooler.c-7.us-east-2.aws.neon.tech/"
    "neondb?sslmode=require"
)
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

                cursor.execute("""
                    INSERT INTO usuarios (
                        usuario, email, password, rol, edad, sexo, peso, estatura,
                        actividad, objetivo, dias_entrenamiento
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
                    valor_fila(row, "objetivo", "Objetivo", default="Ganar masa muscular"),
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