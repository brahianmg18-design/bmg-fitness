from fastapi import FastAPI, HTTPException, Request, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Dict, Optional
from datetime import date, datetime, timedelta
import pandas as pd
import os
import psycopg2
from psycopg2.extras import Json, RealDictCursor, execute_values
import math
import re
import hashlib
import hmac
import secrets
import shutil

app = FastAPI(title="BMG Fitness API")


@app.exception_handler(Exception)
async def manejar_error_no_controlado(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": "Error interno del servidor. Inténtalo de nuevo más tarde."},
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_URL = os.environ.get("DATABASE_URL")
if os.getenv("VERCEL"):
    STORAGE_DIR = os.getenv("BMG_STORAGE_DIR", "/tmp/bmg-fitness")
else:
    STORAGE_DIR = os.getenv("BMG_STORAGE_DIR", BASE_DIR)
os.makedirs(STORAGE_DIR, exist_ok=True)
SEGUIMIENTO_FILE = os.path.join(STORAGE_DIR, "seguimiento.csv")
HISTORICO_CSV_MIGRADO = False

for nombre_archivo in ("seguimiento.csv",):
    origen = os.path.join(BASE_DIR, nombre_archivo)
    destino = os.path.join(STORAGE_DIR, nombre_archivo)
    if STORAGE_DIR != BASE_DIR and os.path.exists(origen) and not os.path.exists(destino):
        shutil.copyfile(origen, destino)
USER_COLUMNS = [
    "Usuario", "Contraseña", "Correo", "Edad", "Sexo", "Peso", "Estatura",
    "Actividad", "Objetivo", "NivelExperiencia", "ObjetivoNutricional",
    "ObjetivoEntrenamiento", "DiasEntrenamiento", "PesoInicial"
]
LEGACY_USER_COLUMNS = [
    "Usuario", "Contraseña", "Objetivo", "Edad", "Sexo", "Peso", "Estatura", "Actividad"
]
SEGUIMIENTO_COLUMNS = ["Usuario", "Fecha", "Peso"]
SESSION_TTL_SECONDS = int(os.environ.get("SESSION_TTL_SECONDS", 60 * 60 * 8))
ACTIVE_SESSIONS: Dict[str, Dict[str, str]] = {}
EXERCISE_IMAGE_URLS = {
    "Sentadilla con barra": "https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=600&q=80",
    "Peso muerto rumano": "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=600&q=80",
    "Prensa de pierna": "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=600&q=80",
    "Extensión de cuádriceps": "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=600&q=80",
    "Elevación de gemelos": "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=600&q=80",
}
EXERCISE_INSTRUCTIONS = {
    "Press de banca con barra": "Apoya los pies y mantén las escápulas firmes contra el banco. Baja la barra con control hacia el pecho y empújala sin despegar la espalda.",
    "Press inclinado con mancuernas": "Mantén los hombros apoyados y las muñecas alineadas con los codos. Baja las mancuernas a los lados del pecho y súbelas sin chocar entre sí.",
    "Fondos en paralelas": "Desciende flexionando los codos y manteniendo el tronco estable. Empuja las barras hasta extender los brazos sin bloquearlos con fuerza.",
    "Extensión de tríceps en polea": "Fija los codos junto al torso y extiende los antebrazos hacia abajo. Regresa lentamente sin mover los hombros.",
    "Jalón al pecho": "Sujeta la barra algo más abierta que los hombros y lleva el pecho hacia ella. Tira con los codos hacia abajo sin balancear el torso.",
    "Remo con barra": "Inclina la cadera con la espalda neutra y las rodillas ligeramente flexionadas. Lleva la barra hacia el abdomen y baja con control.",
    "Remo con mancuerna unilateral": "Apoya una mano y mantén la espalda estable. Lleva la mancuerna hacia la cadera con el codo cerca del cuerpo y desciende lentamente.",
    "Curl de bíceps con barra Z": "Mantén los codos pegados al torso y las muñecas neutras. Flexiona los brazos sin impulso y baja la barra de forma controlada.",
    "Sentadilla libre": "Mantén el pecho erguido y la espalda neutra. Desciende flexionando caderas y rodillas, y empuja el suelo con todo el pie para subir.",
    "Prensa 45°": "Apoya toda la espalda en el respaldo y coloca los pies al ancho de caderas. Baja la plataforma sin despegar la pelvis y empuja sin bloquear las rodillas.",
    "Peso muerto rumano": "Lleva la cadera hacia atrás con una ligera flexión de rodillas y espalda neutra. Desliza la carga cerca de las piernas y vuelve extendiendo la cadera.",
    "Press militar con barra": "Activa el abdomen y mantén las costillas controladas. Empuja la barra sobre la cabeza y bájala frente al rostro sin arquear la zona lumbar.",
    "Elevaciones laterales": "Con los codos ligeramente flexionados, eleva las mancuernas hasta la altura de los hombros. Evita impulsarte y desciende lentamente.",
    "Sentadilla con copa (Goblet)": "Sostén una mancuerna frente al pecho y mantén el torso erguido. Flexiona caderas y rodillas, y sube empujando el suelo con los pies.",
    "Press de pecho con mancuernas": "Mantén los pies firmes y las escápulas apoyadas. Baja las mancuernas junto al pecho y empuja hacia arriba con control.",
    "Remo en máquina": "Ajusta el asiento para alcanzar las asas sin encorvarte. Lleva los codos hacia atrás y regresa lentamente sin despegar el pecho del apoyo.",
    "Burpees": "Desde de pie, apoya las manos y lleva los pies atrás hasta una plancha estable. Regresa los pies y termina extendiéndote con un salto controlado.",
    "Mountain climbers": "Colócate en plancha con hombros sobre las muñecas y abdomen firme. Alterna llevando las rodillas al pecho sin elevar ni hundir la cadera.",
    "Zancadas alternadas": "Da un paso al frente y baja hasta que ambas rodillas estén flexionadas con control. Empuja con el pie delantero para volver y alterna las piernas.",
    "Press militar con mancuernas": "Sujeta las mancuernas a la altura de los hombros y mantén el abdomen activo. Empuja sobre la cabeza y baja sin arquear la espalda.",
    "Kettlebell swings": "Inicia el movimiento llevando la cadera atrás, con la espalda neutra. Impulsa la pesa extendiendo la cadera; los brazos solo acompañan el balanceo.",
    "Zancadas con salto": "Baja a una zancada estable y salta para cambiar la posición de las piernas. Aterriza suavemente con las rodillas alineadas; usa zancadas sin salto si lo necesitas.",
    "Plancha abdominal": "Apoya antebrazos y puntas de los pies, formando una línea recta con el cuerpo. Mantén el abdomen y los glúteos activos sin hundir la espalda.",
    "Peso muerto rumano ligero": "Mantén una carga cómoda, espalda neutra y rodillas ligeramente flexionadas. Lleva la cadera atrás y vuelve apretando los glúteos, sin redondear la espalda.",
    "Flexiones de pecho": "Coloca las manos algo más abiertas que los hombros y alinea el cuerpo. Baja el pecho con los codos controlados y empuja el suelo para subir.",
    "Escaladores": "Adopta una plancha alta y estabiliza el tronco. Lleva una rodilla hacia el pecho y alterna con ritmo controlado, evitando que la cadera rebote.",
    "Crunch abdominal": "Túmbate con las rodillas flexionadas y eleva ligeramente los hombros contrayendo el abdomen. Mantén el cuello relajado y baja sin dejarte caer.",
    "Salto a la cuerda": "Mantén los codos cerca del torso y gira la cuerda principalmente con las muñecas. Salta bajo sobre ambos pies y aterriza suavemente.",
    "Press de banca": "Apoya los pies y estabiliza los hombros contra el banco. Baja la barra al pecho con control y empuja hacia arriba manteniendo las muñecas alineadas.",
    "Remo horizontal": "Siéntate erguido y sujeta el abdomen para no balancearte. Lleva las asas hacia el torso juntando suavemente las escápulas y vuelve despacio.",
    "Press de hombros sentado": "Apoya la espalda y mantén las mancuernas a la altura de los hombros. Empuja hacia arriba sin arquear la zona lumbar y baja con control.",
    "Flexiones": "Alinea cabeza, cadera y talones con las manos bajo los hombros. Baja el pecho con control y empuja el suelo manteniendo el cuerpo firme.",
    "Sentadilla en máquina / Multipower": "Coloca los pies estables y la espalda apoyada, manteniendo las rodillas alineadas con ellos. Desciende hasta un rango cómodo y empuja para volver sin bloquear las rodillas.",
    "Extensión de cuádriceps": "Ajusta el rodillo sobre la parte baja de las piernas y sujeta el asiento. Extiende las rodillas sin impulso y regresa lentamente.",
    "Curl femoral tumbado": "Alinea las rodillas con el eje de la máquina y mantén la cadera apoyada. Flexiona las rodillas acercando los talones y vuelve lentamente.",
    "Plancha lateral": "Apoya el antebrazo bajo el hombro y eleva la cadera formando una línea recta. Mantén el abdomen activo y evita girar el tronco.",
}
RECIPE_CATALOG = [
    ("BRK-001", "Avena con yogur y frutos rojos", "Desayuno"),
    ("BRK-002", "Huevos con pan integral y aguacate", "Desayuno"),
    ("BRK-003", "Bowl de queso cottage y granola", "Desayuno"),
    ("BRK-004", "Tortitas de avena y plátano", "Desayuno"),
    ("LUN-001", "Pollo, arroz integral y brócoli", "Almuerzo"),
    ("LUN-002", "Merluza con quinoa y ensalada", "Almuerzo"),
    ("LUN-003", "Pavo con camote y vegetales", "Almuerzo"),
    ("LUN-004", "Tofu con arroz y verduras salteadas", "Almuerzo"),
    ("LUN-005", "Ensalada de lentejas y atún", "Almuerzo"),
    ("SNK-001", "Yogur con manzana y almendras", "Merienda"),
    ("SNK-002", "Queso cottage con piña y avena", "Merienda"),
    ("SNK-003", "Hummus con zanahoria y pan pita", "Merienda"),
    ("SNK-004", "Yogur alto en proteína con plátano", "Merienda"),
    ("DIN-001", "Pollo con papa y verduras", "Cena"),
    ("DIN-002", "Pescado blanco con cuscús y calabacín", "Cena"),
    ("DIN-003", "Tortilla de claras con ensalada", "Cena"),
    ("DIN-004", "Wrap integral de pavo y vegetales", "Cena"),
    ("DIN-005", "Ternera magra con camote y espinacas", "Cena"),
    ("DIN-006", "Bowl de garbanzos con pollo", "Cena"),
    ("DIN-007", "Tofu con arroz y verduras", "Cena"),
]
RECIPE_IDS_BY_NAME = {nombre: receta_id for receta_id, nombre, _ in RECIPE_CATALOG}


def normalizar_csv_usuarios(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame(columns=USER_COLUMNS)

    df = df.copy()
    df.columns = [str(col).strip() for col in df.columns]

    renombrar = {
        "usuario": "Usuario",
        "contraseña": "Contraseña",
        "contrasena": "Contraseña",
        "correo": "Correo",
        "email": "Correo",
        "edad": "Edad",
        "sexo": "Sexo",
        "peso": "Peso",
        "estatura": "Estatura",
        "actividad": "Actividad",
        "objetivo": "Objetivo",
        "nivel_experiencia": "NivelExperiencia",
        "objetivo_nutricional": "ObjetivoNutricional",
        "objetivo_entrenamiento": "ObjetivoEntrenamiento",
        "diasentrenamiento": "DiasEntrenamiento",
        "dias_entrenamiento": "DiasEntrenamiento",
    }

    df.rename(columns=renombrar, inplace=True)

    for column in USER_COLUMNS:
        if column not in df.columns:
            df[column] = ""

    if list(df.columns[:len(LEGACY_USER_COLUMNS)]) == LEGACY_USER_COLUMNS:
        df = df[LEGACY_USER_COLUMNS + [c for c in USER_COLUMNS if c not in LEGACY_USER_COLUMNS]]

    extra = [c for c in df.columns if c not in USER_COLUMNS]
    if extra:
        df = df.drop(columns=extra)

    df = df[USER_COLUMNS]
    for column in ["Edad", "Peso", "Estatura", "Actividad", "DiasEntrenamiento"]:
        df[column] = df[column].apply(lambda value: "" if pd.isna(value) or str(value).strip().lower() in ["nan", "none", "null"] else value)
    df["Estatura"] = df["Estatura"].apply(
        lambda value: round(float(value) / 100, 2) if str(value).strip() not in ["", "nan"] and float(value) > 3 else value
    )
    df["PesoInicial"] = df.apply(
        lambda row: row["Peso"] if str(row["PesoInicial"]).strip().lower() in ["", "nan", "none", "null"] else row["PesoInicial"],
        axis=1,
    )
    return df


PASSWORD_PREFIX = "pbkdf2_sha256"
PASSWORD_ITERATIONS = 310000


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), PASSWORD_ITERATIONS
    ).hex()
    return f"{PASSWORD_PREFIX}${PASSWORD_ITERATIONS}${salt}${digest}"


def verificar_password(password: str, stored_password: str) -> bool:
    if not stored_password.startswith(f"{PASSWORD_PREFIX}$"):
        return hmac.compare_digest(password, stored_password)

    try:
        _, iterations, salt, expected_digest = stored_password.split("$", 3)
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), salt.encode("utf-8"), int(iterations)
        ).hex()
        return hmac.compare_digest(digest, expected_digest)
    except (TypeError, ValueError):
        return False


def normalizar_csv_seguimiento(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame(columns=SEGUIMIENTO_COLUMNS)

    df = df.copy()
    df.columns = [str(col).strip() for col in df.columns]

    renombrar = {
        "usuario": "Usuario",
        "fecha": "Fecha",
        "peso": "Peso",
        "peso_actual": "Peso",
    }
    df.rename(columns=renombrar, inplace=True)

    for column in SEGUIMIENTO_COLUMNS:
        if column not in df.columns:
            df[column] = ""

    extra = [c for c in df.columns if c not in SEGUIMIENTO_COLUMNS]
    if extra:
        df = df.drop(columns=extra)

    df = df[SEGUIMIENTO_COLUMNS]
    df["Fecha"] = df["Fecha"].apply(lambda value: str(value).strip() if not pd.isna(value) else "")
    df["Peso"] = pd.to_numeric(df["Peso"], errors="coerce").fillna(0)
    return df


class UsuarioRegistro(BaseModel):
    usuario: str
    contrasena: str
    email: str
    edad: int = 30
    sexo: str = "masculino"
    peso: float = 70.0
    estatura: float = 170.0
    actividad: float = 1.55
    nivel_experiencia: str
    objetivo_nutricional: str = "Mantenimiento"
    objetivo_entrenamiento: str = "Hipertrofia (Masa)"
    dias_entrenamiento: int = 4


class UsuarioPerfilUpdate(BaseModel):
    edad: Optional[int] = None
    sexo: Optional[str] = None
    peso: Optional[float] = None
    estatura: Optional[float] = None
    actividad: Optional[float] = None
    nivel_experiencia: Optional[str] = None
    objetivo_nutricional: Optional[str] = None
    objetivo_entrenamiento: Optional[str] = None
    dias_entrenamiento: Optional[int] = None
    email: Optional[str] = None


class UsuarioLogin(BaseModel):
    usuario: str
    contrasena: str


class NutritionModuleRequest(BaseModel):
    weight: float
    height: float
    age: int
    gender: str
    goal: str
    available_foods: list[str] = Field(default_factory=list)
    preferences: list[str] = Field(default_factory=list)
    meal_frequency: int = 4


class SolicitudResetPassword(BaseModel):
    usuario: str
    correo: str
    nueva_contrasena: Optional[str] = None
    confirmar_contrasena: Optional[str] = None


class PerfilFrontendUpdate(BaseModel):
    username: str
    edad: int
    sexo: str
    peso: float
    estatura: float
    actividad: float
    nivel_experiencia: str
    dias: int
    email: str


class SeguimientoRegistro(BaseModel):
    fecha: date
    peso: float
    medidas: Optional[Dict[str, float]] = None


def crear_sesion_usuario(usuario: str):
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(seconds=SESSION_TTL_SECONDS)
    ACTIVE_SESSIONS[token] = {
        "usuario": usuario,
        "expires_at": expires_at.isoformat(timespec="seconds"),
    }
    return token, ACTIVE_SESSIONS[token]["expires_at"]


def limpiar_sesion_token(token: Optional[str]):
    if token:
        ACTIVE_SESSIONS.pop(token, None)


def obtener_token_sesion(request: Request) -> Optional[str]:
    header = request.headers.get("x-session-token")
    if header:
        return header.strip()

    authorization = request.headers.get("authorization")
    if authorization and authorization.lower().startswith("bearer "):
        return authorization.split(" ", 1)[1].strip()

    return None


def validar_sesion_requerida(request: Request, usuario: str):
    token = obtener_token_sesion(request)
    if not token:
        raise HTTPException(status_code=401, detail="Sesión no válida.")

    sesion = ACTIVE_SESSIONS.get(token)
    if not sesion:
        raise HTTPException(status_code=401, detail="Sesión no válida.")

    expires_at = datetime.fromisoformat(sesion["expires_at"])
    if expires_at < datetime.utcnow():
        ACTIVE_SESSIONS.pop(token, None)
        raise HTTPException(status_code=401, detail="La sesión ha expirado.")

    if sesion["usuario"].strip().lower() != usuario.strip().lower():
        raise HTTPException(status_code=403, detail="No tienes permisos para acceder a esta sesión.")

    return sesion["usuario"]


def validar_seguridad(usuario: str, contrasena: str):
    if not re.match(r"^[a-zA-Z0-9]{6,15}$", usuario):
        raise HTTPException(
            status_code=400,
            detail="El usuario debe tener entre 6 y 15 caracteres y contener solo letras y números (sin espacios)."
        )

    pattern_pass = r"^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.#\-_])[A-Za-z\d@$!%*?&.#\-_]{8,}$"
    if not re.match(pattern_pass, contrasena):
        raise HTTPException(
            status_code=400,
            detail="La contraseña debe tener mínimo 8 caracteres, incluir al menos 1 letra mayúscula, 1 número y 1 carácter especial (@, #, $, !, etc.)."
        )


def validar_correo(correo: str):
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", correo):
        raise HTTPException(status_code=400, detail="Introduce un correo electrónico válido.")

def validar_opciones_perfil(nivel_experiencia=None, objetivo_nutricional=None, objetivo_entrenamiento=None):
    opciones = {
        "nivel_experiencia": {"Principiante", "Intermedio", "Avanzado"},
        "objetivo_nutricional": {
            "Perder Grasa (Déficit)",
            "Ganar Peso/Músculo (Superávit)",
            "Mantenimiento",
        },
        "objetivo_entrenamiento": {
            "Hipertrofia (Masa)",
            "Fuerza/Definición",
            "Acondicionamiento General",
        },
    }
    valores = {
        "nivel_experiencia": nivel_experiencia,
        "objetivo_nutricional": objetivo_nutricional,
        "objetivo_entrenamiento": objetivo_entrenamiento,
    }
    for campo, valor in valores.items():
        if valor is not None and valor not in opciones[campo]:
            raise HTTPException(status_code=400, detail=f"El valor de {campo} no es válido.")


def migrar_historico_csv(cursor):
    global HISTORICO_CSV_MIGRADO
    if HISTORICO_CSV_MIGRADO or not os.path.exists(SEGUIMIENTO_FILE):
        return False

    try:
        df = pd.read_csv(SEGUIMIENTO_FILE, dtype=str)
    except pd.errors.EmptyDataError:
        return True

    df = normalizar_csv_seguimiento(df)
    cursor.execute("SELECT usuario FROM usuarios")
    usuarios = {str(row["usuario"]).strip().lower(): str(row["usuario"]) for row in cursor.fetchall()}

    for _, row in df.iterrows():
        usuario = usuarios.get(str(row["Usuario"]).strip().lower())
        try:
            fecha_registro = date.fromisoformat(str(row["Fecha"]).strip())
            peso = float(row["Peso"])
        except (TypeError, ValueError):
            continue
        if not usuario or not math.isfinite(peso) or peso <= 0:
            continue

        cursor.execute(
            """
            INSERT INTO historico_progreso (usuario, fecha, peso, medidas, objetivo_momento)
            VALUES (%s, %s, %s, %s, NULL)
            ON CONFLICT (usuario, fecha) DO NOTHING
            """,
            (usuario, fecha_registro, peso, Json({})),
        )
    return True


def obtener_conexion():
    global HISTORICO_CSV_MIGRADO
    if not DATABASE_URL:
        raise ValueError("La variable DATABASE_URL no está configurada en el entorno.")
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    cursor = conn.cursor()
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS usuarios (
                usuario TEXT PRIMARY KEY,
                password TEXT NOT NULL,
                email TEXT NOT NULL,
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
                dias_entrenamiento INTEGER NOT NULL DEFAULT 4,
                peso_inicial DOUBLE PRECISION
            )
        """)
        cursor.execute("""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = current_schema()
                      AND table_name = 'usuarios'
                      AND column_name = 'contrasena'
                ) AND NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = current_schema()
                      AND table_name = 'usuarios'
                      AND column_name = 'password'
                ) THEN
                    ALTER TABLE usuarios RENAME COLUMN contrasena TO password;
                END IF;
            END $$
        """)
        cursor.execute("""
            ALTER TABLE usuarios
            ADD COLUMN IF NOT EXISTS peso_inicial DOUBLE PRECISION
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
            ALTER COLUMN objetivo_entrenamiento SET NOT NULL,
            ALTER COLUMN nivel_experiencia SET NOT NULL
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS historico_progreso (
                id BIGSERIAL PRIMARY KEY,
                usuario TEXT NOT NULL REFERENCES usuarios(usuario) ON DELETE CASCADE,
                fecha DATE NOT NULL,
                peso DOUBLE PRECISION NOT NULL CHECK (peso > 0),
                medidas JSONB NOT NULL DEFAULT '{}'::jsonb,
                objetivo_momento TEXT,
                creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (usuario, fecha)
            )
        """)
        cursor.execute("""
            ALTER TABLE historico_progreso
            ADD COLUMN IF NOT EXISTS medidas JSONB NOT NULL DEFAULT '{}'::jsonb,
            ADD COLUMN IF NOT EXISTS objetivo_momento TEXT
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS historico_progreso_fecha_idx
            ON historico_progreso (usuario, fecha DESC)
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS recetas (
                receta_id TEXT PRIMARY KEY,
                nombre TEXT NOT NULL,
                tipo_comida TEXT NOT NULL
            )
        """)
        cursor.execute("SELECT receta_id, nombre, tipo_comida FROM recetas")
        recetas_registradas = {
            row["receta_id"]: (row["nombre"], row["tipo_comida"])
            for row in cursor.fetchall()
        }
        recetas_pendientes = [
            receta for receta in RECIPE_CATALOG
            if recetas_registradas.get(receta[0]) != receta[1:]
        ]
        if recetas_pendientes:
            execute_values(cursor, """
                INSERT INTO recetas (receta_id, nombre, tipo_comida)
                VALUES %s
                ON CONFLICT (receta_id) DO UPDATE SET
                    nombre = EXCLUDED.nombre,
                    tipo_comida = EXCLUDED.tipo_comida
            """, recetas_pendientes)
        migrar_csv_pendiente = (
            not HISTORICO_CSV_MIGRADO and migrar_historico_csv(cursor)
        )
        conn.commit()
        if migrar_csv_pendiente:
            HISTORICO_CSV_MIGRADO = True
    except Exception:
        conn.rollback()
        conn.close()
        raise
    finally:
        cursor.close()
    return conn


def cargar_usuarios():
    conn = obtener_conexion()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT usuario AS "Usuario", password AS "Contraseña",
                   email AS "Correo", edad AS "Edad", sexo AS "Sexo",
                   peso AS "Peso", estatura AS "Estatura", actividad AS "Actividad",
                   objetivo AS "Objetivo", nivel_experiencia AS "NivelExperiencia",
                   objetivo_nutricional AS "ObjetivoNutricional",
                   objetivo_entrenamiento AS "ObjetivoEntrenamiento",
                   dias_entrenamiento AS "DiasEntrenamiento",
                   peso_inicial AS "PesoInicial"
            FROM usuarios
        """)
        rows = cursor.fetchall()
        conn.commit()
        return pd.DataFrame(rows, columns=USER_COLUMNS)
    finally:
        cursor.close()
        conn.close()


def cargar_seguimiento():
    if os.path.exists(SEGUIMIENTO_FILE):
        df = pd.read_csv(SEGUIMIENTO_FILE, dtype=str)
        df = normalizar_csv_seguimiento(df)
        df.to_csv(SEGUIMIENTO_FILE, index=False)
        return df
    return pd.DataFrame(columns=SEGUIMIENTO_COLUMNS)


def construir_resumen_seguimiento(usuario: str):
    conn = obtener_conexion()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT peso_inicial
            FROM usuarios
            WHERE LOWER(usuario) = LOWER(%s)
            """,
            (usuario.strip(),),
        )
        usuario_row = cursor.fetchone()
        peso_base = round(float(usuario_row["peso_inicial"]), 1) if usuario_row and usuario_row.get("peso_inicial") is not None else None

        cursor.execute(
            """
            SELECT fecha, peso, medidas, objetivo_momento
            FROM historico_progreso
            WHERE LOWER(usuario) = LOWER(%s)
            ORDER BY fecha DESC, id DESC
            """,
            (usuario.strip(),),
        )
        rows = cursor.fetchall()
    finally:
        cursor.close()
        conn.close()

    registros = [
        {
            "fecha": row["fecha"].isoformat(),
            "peso": round(float(row["peso"]), 1),
            "medidas": row.get("medidas") or {},
            "objetivo_momento": row.get("objetivo_momento"),
        }
        for row in rows
    ]
    if not registros:
        return {
            "usuario": usuario,
            "registros": [],
            "progreso": "Progreso: aún no hay registros previos.",
            "ultimo_peso": None,
            "peso_base": peso_base,
            "diferencia_total": 0,
        }

    ultimo_peso = registros[0]["peso"]
    if peso_base is None:
        peso_base = registros[-1]["peso"]

    diferencia = round(ultimo_peso - peso_base, 1)
    if len(registros) > 1 or peso_base != ultimo_peso:
        progreso = f"Progreso: {diferencia:+.1f} kg desde el peso base inicial"
    else:
        progreso = "Progreso: aún no hay comparación previa."

    return {
        "usuario": usuario,
        "registros": registros,
        "progreso": progreso,
        "ultimo_peso": ultimo_peso,
        "peso_base": peso_base,
        "diferencia_total": diferencia,
    }


def crear_rutina(
    objetivo_entrenamiento: str, dias: int, peso: float = 70,
    nivel_experiencia: str = "Principiante",
):
    objetivo_lower = str(objetivo_entrenamiento).lower()
    experiencia_lower = str(nivel_experiencia).lower()
    if "hipertrofia" in objetivo_lower or "masa" in objetivo_lower:
        factor_carga = 0.6
        series = "4 series x 8-10 reps"
        descanso = "90 s"
        metodo = "Hipertrofia"
        plantillas = [
            ("Pecho y tríceps", [
                ("Press de banca con barra", "Pecho y tríceps", True),
                ("Press inclinado con mancuernas", "Pecho superior", True),
                ("Fondos en paralelas", "Pecho y tríceps", False),
                ("Extensión de tríceps en polea", "Tríceps", True),
            ]),
            ("Espalda y bíceps", [
                ("Jalón al pecho", "Dorsales", True),
                ("Remo con barra", "Espalda media", True),
                ("Remo con mancuerna unilateral", "Espalda", True),
                ("Curl de bíceps con barra Z", "Bíceps", True),
            ]),
            ("Pierna y hombro", [
                ("Sentadilla libre", "Cuádriceps y glúteos", True),
                ("Prensa 45°", "Piernas", True),
                ("Peso muerto rumano", "Cadena posterior", True),
                ("Press militar con barra", "Hombros", True),
                ("Elevaciones laterales", "Deltoides laterales", True),
            ]),
            ("Torso, volumen", [
                ("Press de banca con barra", "Pectoral", True),
                ("Remo con barra", "Espalda", True),
                ("Press inclinado con mancuernas", "Pecho superior", True),
                ("Jalón al pecho", "Dorsales", True),
            ]),
            ("Pierna y brazos, volumen", [
                ("Sentadilla libre", "Piernas", True),
                ("Peso muerto rumano", "Cadena posterior", True),
                ("Curl de bíceps con barra Z", "Bíceps", True),
                ("Extensión de tríceps en polea", "Tríceps", True),
            ]),
        ]
    elif "acondicionamiento" in objetivo_lower:
        factor_carga = 0.4
        series = "3-4 series x 12-15 reps"
        descanso = "45-60 s"
        metodo = "Circuito / superserie"
        plantillas = [
            ("Fullbody A", [
                ("Sentadilla con copa (Goblet)", "Piernas y glúteos", True),
                ("Press de pecho con mancuernas", "Pecho", True),
                ("Remo en máquina", "Espalda", True),
                ("Burpees", "Acondicionamiento", False),
                ("Mountain climbers", "Core y cardio", False),
            ]),
            ("Fullbody B", [
                ("Zancadas alternadas", "Piernas y estabilidad", True),
                ("Press militar con mancuernas", "Hombros", True),
                ("Kettlebell swings", "Potencia y cadena posterior", True),
                ("Zancadas con salto", "Acondicionamiento", False),
                ("Plancha abdominal", "Core", False, "3 series x 30-45 s"),
            ]),
            ("Cardio y core", [
                ("Peso muerto rumano ligero", "Cadena posterior", True),
                ("Flexiones de pecho", "Pecho y brazos", False),
                ("Escaladores", "Core y cardio", False),
                ("Crunch abdominal", "Core", False),
                ("Salto a la cuerda", "Resistencia cardiovascular", False, "3-4 series x 45 s"),
            ]),
        ]
    else:
        factor_carga = 0.5
        series = "3 series x 10-12 reps"
        descanso = "60-75 s"
        metodo = "Fuerza y resistencia balanceada"
        plantillas = [
            ("Torso", [
                ("Press de banca", "Pecho y tríceps", True),
                ("Remo horizontal", "Espalda", True),
                ("Press de hombros sentado", "Hombros", True),
                ("Flexiones", "Pecho y brazos", False),
            ]),
            ("Pierna y core", [
                ("Sentadilla en máquina / Multipower", "Piernas y glúteos", True),
                ("Extensión de cuádriceps", "Cuádriceps", True),
                ("Curl femoral tumbado", "Isquiotibiales", True),
                ("Plancha lateral", "Core", False, "3 series x 30-45 s"),
            ]),
            ("Torso, segunda sesión", [
                ("Press de banca", "Pecho y tríceps", True),
                ("Remo horizontal", "Espalda", True),
                ("Flexiones", "Pecho y brazos", False),
            ]),
            ("Pierna y core, segunda sesión", [
                ("Sentadilla en máquina / Multipower", "Piernas y glúteos", True),
                ("Curl femoral tumbado", "Isquiotibiales", True),
                ("Plancha lateral", "Core", False, "3 series x 30-45 s"),
            ]),
        ]

    if experiencia_lower == "principiante":
        factor_experiencia = 0.85
        if "hipertrofia" in objetivo_lower or "masa" in objetivo_lower:
            series, descanso = "3 series x 10-12 reps", "90 s"
        elif "acondicionamiento" in objetivo_lower:
            series, descanso = "2-3 circuitos x 10-15 reps", "60 s"
        else:
            series, descanso = "3 series x 8-10 reps", "120 s"
    elif experiencia_lower == "avanzado":
        factor_experiencia = 1.1
        if "hipertrofia" in objetivo_lower or "masa" in objetivo_lower:
            series, descanso = "4-5 series x 6-10 reps", "120 s"
        elif "acondicionamiento" in objetivo_lower:
            series, descanso = "4 circuitos x 12-15 reps", "45-60 s"
        else:
            series, descanso = "5 series x 3-6 reps", "150 s"
    else:
        factor_experiencia = 1.0

    factor_carga *= factor_experiencia
    carga_inicio = round(float(peso) * factor_carga, 1)
    rutina = []
    for index in range(max(1, min(int(dias or 4), 7))):
        nombre_dia, ejercicios = plantillas[index % len(plantillas)]
        ejercicios_dia = []
        for item in ejercicios:
            ejercicio, enfoque, usa_carga = item[:3]
            prescripcion = item[3] if len(item) > 3 else series
            ejercicios_dia.append({
                "ejercicio": ejercicio,
                "series": prescripcion,
                "enfoque": enfoque,
                "descanso": descanso,
                "instrucciones": EXERCISE_INSTRUCTIONS.get(ejercicio, "Mantén una postura estable, controla el recorrido y realiza cada repetición sin impulso ni dolor."),
                "peso_inicio_kg": carga_inicio if usa_carga else None,
                "imagen_url": EXERCISE_IMAGE_URLS.get(ejercicio),
            })
        rutina.append({
            "dia": index + 1,
            "nombre": nombre_dia,
            "metodo": metodo,
            "ejercicios": ejercicios_dia,
        })
    return rutina


def distribucion_macros_por_objetivo(objetivo: str):
    objetivo_lower = str(objetivo).lower()
    if any(term in objetivo_lower for term in ("masa", "músculo", "musculo", "superávit", "superavit", "surplus")):
        return {"proteinas": 30, "carbohidratos": 50, "grasas": 20}
    if any(term in objetivo_lower for term in ("grasa", "adelgaz", "perder peso", "déficit", "deficit")):
        return {"proteinas": 40, "carbohidratos": 30, "grasas": 30}
    return {"proteinas": 30, "carbohidratos": 40, "grasas": 30}


IMAGENES_COMIDA = {
    "Desayuno": [
        {"url": "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=900&q=80", "tags": ["avena", "fruta", "yogur", "huevo", "plátano", "aguacate"]},
        {"url": "https://images.unsplash.com/photo-1511690743698-d9d85f2fbf38?auto=format&fit=crop&w=900&q=80", "tags": ["huevo", "aguacate", "pan", "desayuno", "proteina"]},
        {"url": "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=900&q=80", "tags": ["yogur", "fruta", "granola", "fresa", "plátano"]},
    ],
    "Almuerzo": [
        {"url": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80", "tags": ["pollo", "arroz", "ensalada", "verduras", "quinoa", "lentejas", "salad"]},
        {"url": "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80", "tags": ["pescado", "salmon", "merluza", "quinoa", "verduras", "ensalada"]},
        {"url": "https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=900&q=80", "tags": ["pollo", "camote", "atún", "brócoli", "tofu", "verduras"]},
    ],
    "Merienda": [
        {"url": "https://images.unsplash.com/photo-1490885578174-acda8905c2c6?auto=format&fit=crop&w=900&q=80", "tags": ["yogur", "fruta", "almendra", "manzana", "plátano", "avena"]},
        {"url": "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?auto=format&fit=crop&w=900&q=80", "tags": ["fruta", "batido", "pina", "hummus", "vegetal"]},
        {"url": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?auto=format&fit=crop&w=900&q=80", "tags": ["queso", "yogur", "fruta", "proteina", "avena"]},
    ],
    "Cena": [
        {"url": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80", "tags": ["pollo", "pescado", "verduras", "cena", "camote", "espinaca"]},
        {"url": "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=900&q=80", "tags": ["pescado", "salmon", "quinoa", "calabacin", "verduras", "cena"]},
        {"url": "https://images.unsplash.com/photo-1529042410759-befb1204b468?auto=format&fit=crop&w=900&q=80", "tags": ["ensalada", "pollo", "wrap", "pavo", "verduras", "tofu", "brócoli"]},
    ],
}


def seleccionar_imagen_comida(categoria_comida: str, preferencias: Optional[list[str]], dia_numero: int, indice_comida: int) -> str:
    opciones = IMAGENES_COMIDA.get(categoria_comida, [])
    if not opciones:
        return ""

    preferencias_normalizadas = [str(pref).strip().casefold() for pref in (preferencias or []) if str(pref).strip()]
    candidatos = []
    for opcion in opciones:
        etiquetas = [str(etiqueta).strip().casefold() for etiqueta in opcion.get("tags", []) if str(etiqueta).strip()]
        if preferencias_normalizadas and any(pref in etiquetas or any(pref in etiqueta for etiqueta in etiquetas) for pref in preferencias_normalizadas):
            candidatos.append(opcion["url"])
            continue
        if not preferencias_normalizadas:
            candidatos.append(opcion["url"])

    if not candidatos:
        candidatos = [opcion["url"] for opcion in opciones]

    semilla = hashlib.sha256(
        f"{categoria_comida}|{dia_numero}|{indice_comida}|{'|'.join(preferencias_normalizadas)}".encode("utf-8")
    ).hexdigest()
    indice_seleccionado = int(semilla, 16) % len(candidatos)
    return candidatos[indice_seleccionado]


def construir_plan_alimenticio(
    objetivo: str,
    calorias: int,
    macros_diarios: dict,
    meal_frequency: int = 4,
    available_foods: Optional[list[str]] = None,
):
    objetivo_lower = str(objetivo).lower()
    distribucion_macros = distribucion_macros_por_objetivo(objetivo)
    if any(term in objetivo_lower for term in ("masa", "músculo", "musculo", "superávit", "superavit")):
        ajuste_por_grupo = {"proteinas": 1.1, "carbohidratos": 1.2, "grasas": 1.0, "vegetales": 1.0, "frutas": 1.0}
    elif any(term in objetivo_lower for term in ("grasa", "adelgaz", "perder peso", "déficit", "deficit")):
        ajuste_por_grupo = {"proteinas": 1.15, "carbohidratos": 0.75, "grasas": 0.85, "vegetales": 1.25, "frutas": 1.0}
    else:
        ajuste_por_grupo = {"proteinas": 1.0, "carbohidratos": 1.0, "grasas": 1.0, "vegetales": 1.0, "frutas": 1.0}

    recetas = {
        "Desayuno": [
            {"plato": "Avena con yogur y frutos rojos", "alimentos": [
                ("Avena integral", 60, "g", "carbohidratos"), ("Yogur griego natural", 170, "g", "proteinas"),
                ("Frutos rojos", 100, "g", "frutas"), ("Semillas de chía", 10, "g", "grasas"),
            ]},
            {"plato": "Huevos con pan integral y aguacate", "alimentos": [
                ("Huevos", 2, "unidades", "proteinas"), ("Pan integral", 60, "g", "carbohidratos"),
                ("Tomate", 100, "g", "vegetales"), ("Aguacate", 30, "g", "grasas"),
            ]},
            {"plato": "Bowl de queso cottage y granola", "alimentos": [
                ("Queso cottage", 150, "g", "proteinas"), ("Granola integral", 40, "g", "carbohidratos"),
                ("Fresas", 120, "g", "frutas"), ("Semillas de calabaza", 10, "g", "grasas"),
            ]},
            {"plato": "Tortitas de avena y plátano", "alimentos": [
                ("Avena integral", 50, "g", "carbohidratos"), ("Huevo", 1, "unidad", "proteinas"),
                ("Claras de huevo", 100, "g", "proteinas"), ("Plátano", 80, "g", "frutas"),
            ]},
        ],
        "Almuerzo": [
            {"plato": "Pollo, arroz integral y brócoli", "alimentos": [
                ("Pechuga de pollo", 160, "g", "proteinas"), ("Arroz integral cocido", 150, "g", "carbohidratos"),
                ("Brócoli", 180, "g", "vegetales"), ("Aceite de oliva", 5, "ml", "grasas"),
            ]},
            {"plato": "Merluza con quinoa y ensalada", "alimentos": [
                ("Filete de merluza", 180, "g", "proteinas"), ("Quinoa cocida", 140, "g", "carbohidratos"),
                ("Ensalada de hojas y tomate", 180, "g", "vegetales"), ("Aguacate", 30, "g", "grasas"),
            ]},
            {"plato": "Pavo con camote y vegetales", "alimentos": [
                ("Pechuga de pavo", 160, "g", "proteinas"), ("Camote asado", 180, "g", "carbohidratos"),
                ("Calabacín y pimiento", 180, "g", "vegetales"), ("Aceite de oliva", 5, "ml", "grasas"),
            ]},
            {"plato": "Tofu con arroz y verduras salteadas", "alimentos": [
                ("Tofu firme", 170, "g", "proteinas"), ("Arroz integral cocido", 140, "g", "carbohidratos"),
                ("Verduras salteadas", 180, "g", "vegetales"), ("Aceite de sésamo", 5, "ml", "grasas"),
            ]},
            {"plato": "Ensalada de lentejas y atún", "alimentos": [
                ("Atún al natural escurrido", 100, "g", "proteinas"), ("Lentejas cocidas", 130, "g", "carbohidratos"),
                ("Pepino, tomate y hojas verdes", 200, "g", "vegetales"), ("Aceite de oliva", 5, "ml", "grasas"),
            ]},
        ],
        "Merienda": [
            {"plato": "Yogur con manzana y almendras", "alimentos": [
                ("Yogur griego natural", 150, "g", "proteinas"), ("Manzana", 120, "g", "frutas"),
                ("Almendras", 10, "g", "grasas"),
            ]},
            {"plato": "Queso cottage con piña y avena", "alimentos": [
                ("Queso cottage", 120, "g", "proteinas"), ("Piña", 100, "g", "frutas"),
                ("Avena integral", 20, "g", "carbohidratos"),
            ]},
            {"plato": "Hummus con zanahoria y pan pita", "alimentos": [
                ("Hummus", 35, "g", "proteinas"), ("Zanahoria", 100, "g", "vegetales"),
                ("Pan pita integral", 35, "g", "carbohidratos"),
            ]},
            {"plato": "Yogur alto en proteína con plátano", "alimentos": [
                ("Yogur alto en proteína", 160, "g", "proteinas"), ("Plátano", 90, "g", "frutas"),
                ("Avena integral", 15, "g", "carbohidratos"),
            ]},
        ],
        "Cena": [
            {"plato": "Pollo con papa y verduras", "alimentos": [
                ("Pechuga de pollo", 150, "g", "proteinas"), ("Papa cocida", 150, "g", "carbohidratos"),
                ("Verduras al vapor", 180, "g", "vegetales"), ("Aceite de oliva", 5, "ml", "grasas"),
            ]},
            {"plato": "Pescado blanco con cuscús y calabacín", "alimentos": [
                ("Pescado blanco", 160, "g", "proteinas"), ("Cuscús integral cocido", 130, "g", "carbohidratos"),
                ("Calabacín y espárragos", 180, "g", "vegetales"), ("Aceite de oliva", 5, "ml", "grasas"),
            ]},
            {"plato": "Tortilla de claras con ensalada", "alimentos": [
                ("Huevo", 1, "unidad", "proteinas"), ("Claras de huevo", 150, "g", "proteinas"),
                ("Ensalada de espinaca y tomate", 180, "g", "vegetales"), ("Pan integral", 40, "g", "carbohidratos"),
            ]},
            {"plato": "Wrap integral de pavo y vegetales", "alimentos": [
                ("Pechuga de pavo", 130, "g", "proteinas"), ("Tortilla integral", 60, "g", "carbohidratos"),
                ("Lechuga y tomate", 120, "g", "vegetales"), ("Yogur natural", 30, "g", "grasas"),
            ]},
            {"plato": "Ternera magra con camote y espinacas", "alimentos": [
                ("Ternera magra", 140, "g", "proteinas"), ("Camote asado", 130, "g", "carbohidratos"),
                ("Espinacas salteadas", 150, "g", "vegetales"), ("Aceite de oliva", 5, "ml", "grasas"),
            ]},
            {"plato": "Bowl de garbanzos con pollo", "alimentos": [
                ("Pechuga de pollo", 120, "g", "proteinas"), ("Garbanzos cocidos", 100, "g", "carbohidratos"),
                ("Pepino, tomate y perejil", 180, "g", "vegetales"), ("Aceite de oliva", 5, "ml", "grasas"),
            ]},
            {"plato": "Tofu con arroz y verduras", "alimentos": [
                ("Tofu firme", 150, "g", "proteinas"), ("Arroz integral cocido", 100, "g", "carbohidratos"),
                ("Brócoli y zanahoria", 180, "g", "vegetales"), ("Semillas de sésamo", 5, "g", "grasas"),
            ]},
        ],
    }
    if meal_frequency == 2:
        comidas_plan = [("Desayuno", "Desayuno"), ("Cena", "Cena")]
    elif meal_frequency == 3:
        comidas_plan = [("Desayuno", "Desayuno"), ("Almuerzo", "Almuerzo"), ("Cena", "Cena")]
    else:
        comidas_plan = [("Desayuno", "Desayuno"), ("Almuerzo", "Almuerzo")]
        comidas_plan.extend(("Merienda", f"Merienda {indice}") for indice in range(1, meal_frequency - 2))
        comidas_plan.append(("Cena", "Cena"))
    preferencias = [str(alimento).strip().casefold() for alimento in (available_foods or []) if str(alimento).strip()]
    porcentaje_comida = 100 / meal_frequency
    escala_calorias = max(0, float(calorias)) / 2000
    menu_semanal = []

    for indice_dia in range(28):
        dia = f"Día {indice_dia + 1}"
        comidas_dia = []
        for indice_comida, (categoria_comida, nombre_comida) in enumerate(comidas_plan):
            recetas_comida = recetas[categoria_comida]
            recetas_preferidas = [
                receta_candidata for receta_candidata in recetas_comida
                if any(
                    preferencia in receta_candidata["plato"].casefold()
                    or any(preferencia in alimento[0].casefold() for alimento in receta_candidata["alimentos"])
                    for preferencia in preferencias
                )
            ]
            opciones_receta = recetas_preferidas or recetas_comida
            receta = opciones_receta[(indice_dia + indice_comida) % len(opciones_receta)]
            porciones = []
            for nombre, cantidad, unidad, grupo in receta["alimentos"]:
                cantidad_ajustada = cantidad * escala_calorias * ajuste_por_grupo[grupo]
                if unidad.startswith("unidad"):
                    cantidad_ajustada = max(1, round(cantidad_ajustada))
                else:
                    cantidad_ajustada = max(5, round(cantidad_ajustada / 5) * 5)
                porciones.append({"nombre": nombre, "cantidad": cantidad_ajustada, "unidad": unidad})

            porcentaje = (
                {"Desayuno": 25, "Almuerzo": 35, "Merienda": 15, "Cena": 25}[categoria_comida] / 100
                if meal_frequency == 4
                else porcentaje_comida / 100
            )
            macros_comida = {macro: round(cantidad * porcentaje) for macro, cantidad in macros_diarios.items()}
            receta_id = RECIPE_IDS_BY_NAME.get(receta["plato"])
            if not receta_id:
                raise ValueError(f"La receta '{receta['plato']}' no tiene un ID registrado en el catálogo.")
            comidas_dia.append({
                "receta_id": receta_id,
                "comida": nombre_comida,
                "plato": receta["plato"],
                "imagen": seleccionar_imagen_comida(categoria_comida, preferencias, indice_dia + 1, indice_comida),
                "calorias": round(calorias * porcentaje),
                "macros": macros_comida,
                "alimentos": porciones,
            })

        menu_semanal.append({
            "dia": dia,
            "dia_numero": indice_dia + 1,
            "calorias": calorias,
            "macros": macros_diarios,
            "comidas": comidas_dia,
        })

    return {"distribucion_macros": distribucion_macros, "menu_alimenticio": menu_semanal}


def generar_plan_nutricional(data: NutritionModuleRequest):
    ajustes_objetivo = {"deficit": -400, "maintenance": 0, "surplus": 300}
    goal = str(data.goal).strip().lower()
    if goal not in ajustes_objetivo:
        raise HTTPException(status_code=422, detail="El objetivo debe ser deficit, maintenance o surplus.")
    if data.meal_frequency < 2 or data.meal_frequency > 8:
        raise HTTPException(status_code=422, detail="La frecuencia debe estar entre 2 y 8 comidas diarias.")

    gender = str(data.gender).strip().lower()
    if gender not in {"m", "male", "masculino", "hombre", "f", "female", "femenino", "mujer"}:
        raise HTTPException(status_code=422, detail="El sexo debe ser masculino o femenino.")
    altura_cm = float(data.height) * 100 if float(data.height) <= 3 else float(data.height)
    weight = float(data.weight)
    age = int(data.age)
    if not 30 <= weight <= 350 or not 120 <= altura_cm <= 230 or not 14 <= age <= 100:
        raise HTTPException(status_code=422, detail="Revisa el peso, la estatura y la edad del perfil.")

    es_hombre = gender in {"m", "male", "masculino", "hombre"}
    tmb = (10 * weight) + (6.25 * altura_cm) - (5 * age) + (5 if es_hombre else -161)
    tdee = tmb * 1.2
    calorias = round(tdee + ajustes_objetivo[goal])
    objetivo_texto = {"deficit": "Déficit", "maintenance": "Mantenimiento", "surplus": "Superávit"}[goal]
    distribucion = distribucion_macros_por_objetivo(goal)
    proteinas = round(calorias * distribucion["proteinas"] / 100 / 4)
    carbos = round(calorias * distribucion["carbohidratos"] / 100 / 4)
    grasas = round(calorias * distribucion["grasas"] / 100 / 9)
    alimentos = list(dict.fromkeys(data.available_foods + data.preferences))
    plan = construir_plan_alimenticio(
        objetivo_texto,
        calorias,
        {"proteinas": proteinas, "carbohidratos": carbos, "grasas": grasas},
        data.meal_frequency,
        alimentos,
    )
    return {
        "title": "Plan de Nutrición Personalizado",
        "goal": goal,
        "meals_per_day": data.meal_frequency,
        "available_foods": alimentos,
        "imc": round(weight / ((altura_cm / 100) ** 2), 1),
        "tmb": round(tmb),
        "tdee": round(tdee),
        "target_calories": calorias,
        "calorias": calorias,
        "proteinas": proteinas,
        "carbos": carbos,
        "grasas": grasas,
        "explicacion_nutricional": "Plan calculado con tus datos biológicos y parámetros nutricionales, sin usar datos de entrenamiento.",
        **plan,
    }


def calcular_resumen(
    edad, sexo, peso, estatura, actividad, objetivo_nutricional,
    dias_entrenamiento, nivel_experiencia="Principiante",
    objetivo_entrenamiento="Hipertrofia (Masa)",
):
    estatura_m = float(estatura)
    peso = float(peso)
    edad = int(edad)
    actividad = float(actividad)
    dias_entrenamiento = int(dias_entrenamiento or 4)
    imc = round(peso / (estatura_m ** 2), 1)

    if sexo == "masculino":
        tmb = (10 * peso) + (6.25 * estatura_m * 100) - (5 * edad) + 5
    else:
        tmb = (10 * peso) + (6.25 * estatura_m * 100) - (5 * edad) - 161

    factores_experiencia = {"principiante": 1.0, "intermedio": 1.05, "avanzado": 1.10}
    factor_experiencia = factores_experiencia.get(str(nivel_experiencia).lower(), 1.0)
    gasto_total = tmb * actividad * factor_experiencia
    objetivo_lower = str(objetivo_nutricional).lower()
    if "superávit" in objetivo_lower or "superavit" in objetivo_lower:
        calorias = round(gasto_total + 400)
        explicacion_nutricional = "Para hipertrofia muscular necesitas un superávit calórico controlado (+400 kcal) con alta ingesta proteica para la síntesis muscular."
    elif "déficit" in objetivo_lower or "deficit" in objetivo_lower:
        calorias = round(gasto_total - 400)
        explicacion_nutricional = "Para reducir porcentaje de grasa aplicamos un déficit calórico (-400 kcal) protegiendo tu masa magra mediante proteína elevada."
    else:
        calorias = round(gasto_total)
        explicacion_nutricional = "Mantendrás tu gasto energético de mantenimiento (normocalórica) optimizando el rendimiento y la definición muscular."

    distribucion_macros = distribucion_macros_por_objetivo(objetivo_nutricional)
    proteinas = round(calorias * distribucion_macros["proteinas"] / 100 / 4)
    carbos = round(calorias * distribucion_macros["carbohidratos"] / 100 / 4)
    grasas = round(calorias * distribucion_macros["grasas"] / 100 / 9)
    macros_diarios = {"proteinas": proteinas, "carbohidratos": carbos, "grasas": grasas}
    plan_alimenticio = construir_plan_alimenticio(objetivo_nutricional, calorias, macros_diarios)
    return {
        "imc": float(imc),
        "tmb": int(round(tmb)),
        "tdee": int(round(gasto_total)),
        "calorias": int(calorias),
        "proteinas": int(proteinas),
        "carbos": int(carbos),
        "grasas": int(grasas),
        "explicacion_nutricional": explicacion_nutricional,
        **plan_alimenticio,
        "rutina": crear_rutina(
            objetivo_entrenamiento, dias_entrenamiento, peso, nivel_experiencia
        ),
    }


@app.post("/api/registro")
def registrar(datos: UsuarioRegistro):
    validar_seguridad(datos.usuario.strip(), datos.contrasena.strip())
    validar_correo(datos.email.strip())
    validar_opciones_perfil(datos.nivel_experiencia, datos.objetivo_nutricional, datos.objetivo_entrenamiento)

    conn = obtener_conexion()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO usuarios (
                usuario, password, email, edad, sexo, peso, estatura,
                actividad, objetivo, nivel_experiencia, objetivo_nutricional,
                objetivo_entrenamiento, dias_entrenamiento, peso_inicial
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            datos.usuario.strip(),
            hash_password(datos.contrasena.strip()),
            datos.email.strip().lower(),
            datos.edad,
            datos.sexo,
            datos.peso,
            datos.estatura / 100 if datos.estatura > 3 else datos.estatura,
            datos.actividad,
            datos.objetivo_nutricional,
            datos.nivel_experiencia,
            datos.objetivo_nutricional,
            datos.objetivo_entrenamiento,
            int(datos.dias_entrenamiento or 4),
            datos.peso,
        ))
        conn.commit()
    except psycopg2.errors.UniqueViolation:
        conn.rollback()
        raise HTTPException(status_code=400, detail="El nombre de usuario ya se encuentra registrado.")
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Error al registrar usuario: {str(e)}")
    finally:
        cursor.close()
        conn.close()

    return {"mensaje": "Usuario registrado exitosamente."}


@app.get("/api/perfil/{usuario}")
def obtener_perfil(usuario: str, request: Request):
    validar_sesion_requerida(request, usuario)
    df = cargar_usuarios()
    match = df[df["Usuario"].str.strip().str.lower() == usuario.strip().lower()]

    if match.empty:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    user_row = match.iloc[0]

    def valor_o_default(column, default):
        value = user_row.get(column, default)
        return default if pd.isna(value) or str(value).strip() == "" else value

    edad = int(valor_o_default("Edad", 30))
    peso = float(valor_o_default("Peso", 70))
    peso_inicial = float(valor_o_default("PesoInicial", peso))
    estatura = float(valor_o_default("Estatura", 170))
    actividad = float(valor_o_default("Actividad", 1.55))
    dias_entrenamiento = int(valor_o_default("DiasEntrenamiento", 4))

    return {
        "usuario": str(user_row["Usuario"]),
        "email": str(valor_o_default("Correo", "")),
        "edad": edad,
        "sexo": str(valor_o_default("Sexo", "masculino")),
        "peso": peso,
        "estatura": estatura,
        "actividad": actividad,
        "objetivo": str(valor_o_default("ObjetivoNutricional", "Mantenimiento")),
        "nivel_experiencia": str(valor_o_default("NivelExperiencia", "Principiante")),
        "objetivo_nutricional": str(valor_o_default("ObjetivoNutricional", "Mantenimiento")),
        "objetivo_entrenamiento": str(valor_o_default("ObjetivoEntrenamiento", "Hipertrofia (Masa)")),
        "dias_entrenamiento": dias_entrenamiento,
        "peso_inicial": peso_inicial,
    }


@app.put("/api/perfil/{usuario}")
def actualizar_perfil(usuario: str, datos: UsuarioPerfilUpdate, request: Request):
    validar_sesion_requerida(request, usuario)
    if datos.email is not None:
        validar_correo(datos.email.strip())
    validar_opciones_perfil(datos.nivel_experiencia, datos.objetivo_nutricional, datos.objetivo_entrenamiento)

    campos = {
        "email": datos.email.strip().lower() if datos.email is not None else None,
        "edad": datos.edad,
        "sexo": datos.sexo,
        "peso": datos.peso,
        "estatura": datos.estatura / 100 if datos.estatura is not None and datos.estatura > 3 else datos.estatura,
        "actividad": datos.actividad,
        "nivel_experiencia": datos.nivel_experiencia,
        "objetivo_nutricional": datos.objetivo_nutricional,
        "objetivo_entrenamiento": datos.objetivo_entrenamiento,
        "dias_entrenamiento": datos.dias_entrenamiento,
    }
    campos = {campo: valor for campo, valor in campos.items() if valor is not None}
    if not campos:
        raise HTTPException(status_code=400, detail="No hay datos para actualizar.")

    conn = obtener_conexion()
    cursor = conn.cursor()
    try:
        asignaciones = ", ".join(f"{campo} = %s" for campo in campos)
        cursor.execute(
            f"UPDATE usuarios SET {asignaciones} WHERE LOWER(usuario) = LOWER(%s)",
            (*campos.values(), usuario.strip()),
        )
        if cursor.rowcount == 0:
            conn.rollback()
            raise HTTPException(status_code=404, detail="Usuario no encontrado.")
        conn.commit()
    except Exception as e:
        conn.rollback()
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=f"Error al actualizar: {str(e)}")
    finally:
        cursor.close()
        conn.close()

    perfil = obtener_perfil(usuario)
    resumen = calcular_resumen(
        perfil["edad"], perfil["sexo"], perfil["peso"], perfil["estatura"],
        perfil["actividad"], perfil["objetivo_nutricional"], perfil["dias_entrenamiento"],
        perfil["nivel_experiencia"], perfil["objetivo_entrenamiento"]
    )
    return {"mensaje": "Perfil actualizado correctamente.", **perfil, **resumen}


@app.get("/api/get-profile")
def obtener_perfil_frontend(username: str, request: Request):
    validar_sesion_requerida(request, username)
    return obtener_perfil(username, request)


@app.post("/api/update-profile")
def actualizar_perfil_frontend(datos: PerfilFrontendUpdate):
    datos_perfil = UsuarioPerfilUpdate(
        edad=datos.edad,
        sexo=datos.sexo,
        peso=datos.peso,
        estatura=datos.estatura,
        actividad=datos.actividad,
        nivel_experiencia=datos.nivel_experiencia,
        dias_entrenamiento=datos.dias,
        email=datos.email,
    )
    return actualizar_perfil(datos.username, datos_perfil)


@app.post("/api/login")
def login(payload: UsuarioLogin = Body(...)):
    usuario = payload.usuario.strip()
    contrasena = payload.contrasena.strip()
    print(f"[LOGIN_DEBUG] usuario={usuario!r} | contrasena_longitud={len(contrasena)}")

    conn = obtener_conexion()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT usuario AS "Usuario", password AS "Contraseña",
                   email AS "Correo", edad AS "Edad", sexo AS "Sexo",
                   peso AS "Peso", estatura AS "Estatura", actividad AS "Actividad",
                   objetivo AS "Objetivo", nivel_experiencia AS "NivelExperiencia",
                   objetivo_nutricional AS "ObjetivoNutricional",
                   objetivo_entrenamiento AS "ObjetivoEntrenamiento",
                   dias_entrenamiento AS "DiasEntrenamiento",
                   peso_inicial AS "PesoInicial"
            FROM usuarios
            WHERE LOWER(usuario) = LOWER(%s)
            """,
            (usuario,),
        )
        user_row = cursor.fetchone()
        print(f"[LOGIN_DEBUG] user_row_encontrado={user_row is not None}")

        if user_row is None:
            raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos.")

        stored_password = str(user_row["Contraseña"]).strip()
        if not verificar_password(contrasena, stored_password):
            raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos.")

        if not stored_password.startswith(f"{PASSWORD_PREFIX}$"):
            cursor.execute(
                "UPDATE usuarios SET password = %s WHERE usuario = %s",
                (hash_password(contrasena), user_row["Usuario"]),
            )
        conn.commit()
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Error al iniciar sesión: {str(e)}")
    finally:
        cursor.close()
        conn.close()

    edad = int(float(user_row.get("Edad", 30) or 30))
    sexo = str(user_row.get("Sexo", "masculino"))
    peso = float(user_row.get("Peso", 70.0) or 70.0)
    estatura = float(user_row.get("Estatura", 1.70) or 1.70)
    actividad = float(user_row.get("Actividad", 1.55) or 1.55)
    nivel_experiencia = str(user_row.get("NivelExperiencia", "Principiante"))
    objetivo_nutricional = str(user_row.get("ObjetivoNutricional", "Mantenimiento"))
    objetivo_entrenamiento = str(user_row.get("ObjetivoEntrenamiento", "Hipertrofia (Masa)"))
    dias_entrenamiento = int(user_row.get("DiasEntrenamiento", 4) or 4)
    resumen = calcular_resumen(
        edad, sexo, peso, estatura, actividad, objetivo_nutricional,
        dias_entrenamiento, nivel_experiencia, objetivo_entrenamiento,
    )
    session_token, expires_at = crear_sesion_usuario(user_row["Usuario"])

    return {
        "mensaje": "Acceso concedido",
        "usuario": user_row["Usuario"],
        "session_token": session_token,
        "session_expires_at": expires_at,
        "edad": edad,
        "sexo": sexo,
        "peso": peso,
        "estatura": estatura,
        "actividad": actividad,
        "objetivo": objetivo_nutricional,
        "nivel_experiencia": nivel_experiencia,
        "objetivo_nutricional": objetivo_nutricional,
        "objetivo_entrenamiento": objetivo_entrenamiento,
        "dias_entrenamiento": dias_entrenamiento,
        "email": "" if pd.isna(user_row.get("Correo", "")) else str(user_row.get("Correo", "") or ""),
        "peso_inicial": user_row.get("PesoInicial", peso),
        **resumen,
    }


@app.get("/api/session/validate")
@app.post("/api/session/validate")
def validar_sesion(request: Request):
    token = obtener_token_sesion(request)
    if not token:
        raise HTTPException(status_code=401, detail="Sesión no válida.")

    sesion = ACTIVE_SESSIONS.get(token)
    if not sesion:
        raise HTTPException(status_code=401, detail="Sesión no válida.")

    expires_at = datetime.fromisoformat(sesion["expires_at"])
    if expires_at < datetime.utcnow():
        ACTIVE_SESSIONS.pop(token, None)
        raise HTTPException(status_code=401, detail="La sesión ha expirado.")

    return {
        "valid": True,
        "usuario": sesion["usuario"],
        "expires_at": sesion["expires_at"],
    }


@app.post("/api/session/logout")
def cerrar_sesion(request: Request):
    token = obtener_token_sesion(request)
    limpiar_sesion_token(token)
    return {"mensaje": "Sesión cerrada."}


@app.post("/api/nutricion/plan")
def crear_plan_nutricional(datos: NutritionModuleRequest):
    return generar_plan_nutricional(datos)


def buscar_usuario_reset(datos: SolicitudResetPassword):
    usuario = datos.usuario.strip().lower()
    correo = datos.correo.strip().lower()

    if not usuario or not correo:
        raise HTTPException(status_code=400, detail="El usuario y el correo son obligatorios.")

    df = cargar_usuarios()
    coincidencia = df[
        (df["Usuario"].fillna("").str.strip().str.lower() == usuario)
        & (df["Correo"].fillna("").str.strip().str.lower() == correo)
    ]

    if coincidencia.empty:
        raise HTTPException(status_code=404, detail="No encontramos una cuenta con esos datos.")

    return df, coincidencia


@app.post("/api/verificar-usuario")
def verificar_usuario_reset(datos: SolicitudResetPassword):
    buscar_usuario_reset(datos)
    return {"mensaje": "Datos verificados. Define tu nueva contraseña."}


@app.post("/api/restablecer-password")
def restablecer_password(datos: SolicitudResetPassword):
    if not datos.nueva_contrasena or not datos.confirmar_contrasena:
        raise HTTPException(status_code=400, detail="La nueva contraseña y su confirmación son obligatorias.")
    if datos.nueva_contrasena != datos.confirmar_contrasena:
        raise HTTPException(status_code=400, detail="Las contraseñas no coinciden.")

    df, coincidencia = buscar_usuario_reset(datos)
    validar_seguridad(datos.usuario.strip(), datos.nueva_contrasena.strip())
    usuario_guardado = coincidencia.iloc[0]["Usuario"]
    conn = obtener_conexion()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "UPDATE usuarios SET password = %s WHERE usuario = %s",
            (hash_password(datos.nueva_contrasena.strip()), usuario_guardado),
        )
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Error al restablecer la contraseña: {str(e)}")
    finally:
        cursor.close()
        conn.close()
    return {"mensaje": "Contraseña actualizada correctamente. Ya puedes iniciar sesión."}


@app.post("/api/reset-password")
def solicitar_reset_password(datos: SolicitudResetPassword):
    if datos.nueva_contrasena is not None or datos.confirmar_contrasena is not None:
        return restablecer_password(datos)

    buscar_usuario_reset(datos)
    return {"mensaje": "Datos verificados. Define tu nueva contraseña."}


@app.get("/api/seguimiento/{usuario}")
def obtener_seguimiento(usuario: str, request: Request):
    validar_sesion_requerida(request, usuario)
    return construir_resumen_seguimiento(usuario)


@app.post("/api/seguimiento/{usuario}")
def registrar_seguimiento(usuario: str, datos: SeguimientoRegistro, request: Request):
    validar_sesion_requerida(request, usuario)
    if not usuario.strip():
        raise HTTPException(status_code=400, detail="Usuario no válido.")
    peso = float(datos.peso)
    if not math.isfinite(peso) or peso <= 0:
        raise HTTPException(status_code=400, detail="El peso debe ser mayor a 0.")
    medidas = {
        str(nombre): float(valor)
        for nombre, valor in (datos.medidas or {}).items()
        if valor is not None and math.isfinite(float(valor)) and float(valor) > 0
    }

    conn = obtener_conexion()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
                 SELECT usuario, email, edad, sexo, estatura, actividad,
                     nivel_experiencia, objetivo_nutricional, objetivo_entrenamiento,
                     dias_entrenamiento, peso_inicial
            FROM usuarios
            WHERE LOWER(usuario) = LOWER(%s)
            FOR UPDATE
            """,
            (usuario.strip(),),
        )
        perfil = cursor.fetchone()
        if perfil is None:
            raise HTTPException(status_code=404, detail="Usuario no encontrado.")

        cursor.execute(
            """
            INSERT INTO historico_progreso (usuario, fecha, peso, medidas, objetivo_momento)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (usuario, fecha) DO UPDATE SET
                peso = EXCLUDED.peso,
                medidas = EXCLUDED.medidas,
                objetivo_momento = EXCLUDED.objetivo_momento
            """,
            (perfil["usuario"], datos.fecha, peso, Json(medidas), perfil["objetivo_nutricional"]),
        )
        cursor.execute(
            "UPDATE usuarios SET peso = %s WHERE usuario = %s",
            (peso, perfil["usuario"]),
        )
        conn.commit()
    except HTTPException:
        conn.rollback()
        raise
    except Exception as error:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"No se pudo guardar el histórico: {error}")
    finally:
        cursor.close()
        conn.close()

    perfil["peso"] = peso
    resumen = calcular_resumen(
        perfil["edad"], perfil["sexo"], peso, perfil["estatura"],
        perfil["actividad"], perfil["objetivo_nutricional"], perfil["dias_entrenamiento"],
        perfil["nivel_experiencia"], perfil["objetivo_entrenamiento"],
    )
    historico = construir_resumen_seguimiento(perfil["usuario"])
    return {"mensaje": "Registro guardado correctamente.", **perfil, **resumen, **historico}


app.mount("/", StaticFiles(directory=BASE_DIR, html=True), name="frontend")
