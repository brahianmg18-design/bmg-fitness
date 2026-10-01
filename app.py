from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
import pandas as pd
import os
import psycopg2
from psycopg2.extras import RealDictCursor
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

for nombre_archivo in ("seguimiento.csv",):
    origen = os.path.join(BASE_DIR, nombre_archivo)
    destino = os.path.join(STORAGE_DIR, nombre_archivo)
    if STORAGE_DIR != BASE_DIR and os.path.exists(origen) and not os.path.exists(destino):
        shutil.copyfile(origen, destino)
USER_COLUMNS = [
    "Usuario", "Contraseña", "Correo", "Edad", "Sexo", "Peso", "Estatura",
    "Actividad", "Objetivo", "DiasEntrenamiento", "PesoInicial"
]
LEGACY_USER_COLUMNS = [
    "Usuario", "Contraseña", "Objetivo", "Edad", "Sexo", "Peso", "Estatura", "Actividad"
]
SEGUIMIENTO_COLUMNS = ["Usuario", "Fecha", "Peso"]
EXERCISE_IMAGE_URLS = {
    "Sentadilla con barra": "https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=600&q=80",
    "Peso muerto rumano": "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=600&q=80",
    "Prensa de pierna": "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=600&q=80",
    "Extensión de cuádriceps": "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=600&q=80",
    "Elevación de gemelos": "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=600&q=80",
}


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
    objetivo: str = "Ganar masa muscular"
    dias_entrenamiento: int = 4


class UsuarioPerfilUpdate(BaseModel):
    edad: Optional[int] = None
    sexo: Optional[str] = None
    peso: Optional[float] = None
    estatura: Optional[float] = None
    actividad: Optional[float] = None
    objetivo: Optional[str] = None
    dias_entrenamiento: Optional[int] = None
    email: Optional[str] = None


class UsuarioLogin(BaseModel):
    usuario: str
    contrasena: str


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
    objetivo: str
    dias: int
    email: str


class SeguimientoRegistro(BaseModel):
    fecha: str
    peso: float


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


def obtener_conexion():
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
        conn.commit()
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
                   objetivo AS "Objetivo", dias_entrenamiento AS "DiasEntrenamiento",
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
    df = cargar_seguimiento()
    usuarios = cargar_usuarios()
    usuario_match = usuarios[usuarios["Usuario"].str.strip().str.lower() == usuario.strip().lower()]
    peso_base = None
    if not usuario_match.empty:
        valor_base = usuario_match.iloc[0].get("PesoInicial", "")
        if str(valor_base).strip() not in ["", "nan", "None"]:
            peso_base = round(float(valor_base), 1)

    if df.empty:
        return {
            "usuario": usuario,
            "registros": [],
            "progreso": "Progreso: aún no hay registros previos.",
            "ultimo_peso": None,
            "peso_base": peso_base,
            "diferencia_total": 0,
        }

    df_usuario = df[df["Usuario"].str.strip().str.lower() == usuario.strip().lower()].copy()
    if df_usuario.empty:
        return {
            "usuario": usuario,
            "registros": [],
            "progreso": "Progreso: aún no hay registros previos.",
            "ultimo_peso": None,
            "peso_base": peso_base,
            "diferencia_total": 0,
        }

    df_usuario = df_usuario.sort_values("Fecha", ascending=True, kind="mergesort").reset_index(drop=True)
    registros = [
        {"fecha": str(row["Fecha"]), "peso": round(float(row["Peso"]), 1)}
        for _, row in df_usuario.iterrows()
    ]

    ultimo_peso = registros[-1]["peso"]
    if peso_base is None:
        peso_base = registros[0]["peso"]

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


def crear_rutina(objetivo: str, dias: int, peso: float = 70):
    objetivo_lower = str(objetivo).lower()
    if "masa" in objetivo_lower:
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
    elif "grasa" in objetivo_lower or "adelgaz" in objetivo_lower or "perder peso" in objetivo_lower:
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
    if "masa" in objetivo_lower:
        return {"proteinas": 30, "carbohidratos": 50, "grasas": 20}
    if "grasa" in objetivo_lower or "adelgaz" in objetivo_lower or "perder peso" in objetivo_lower:
        return {"proteinas": 40, "carbohidratos": 30, "grasas": 30}
    return {"proteinas": 30, "carbohidratos": 40, "grasas": 30}


def construir_plan_alimenticio(objetivo: str, calorias: int, macros_diarios: dict):
    objetivo_lower = str(objetivo).lower()
    distribucion_macros = distribucion_macros_por_objetivo(objetivo)
    if "masa" in objetivo_lower:
        ajuste_por_grupo = {"proteinas": 1.1, "carbohidratos": 1.2, "grasas": 1.0, "vegetales": 1.0, "frutas": 1.0}
    elif "grasa" in objetivo_lower or "adelgaz" in objetivo_lower or "perder peso" in objetivo_lower:
        ajuste_por_grupo = {"proteinas": 1.15, "carbohidratos": 0.75, "grasas": 0.85, "vegetales": 1.25, "frutas": 1.0}
    else:
        ajuste_por_grupo = {"proteinas": 1.0, "carbohidratos": 1.0, "grasas": 1.0, "vegetales": 1.0, "frutas": 1.0}

    imagenes_comida = {
        "Desayuno": "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=900&q=80",
        "Almuerzo": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80",
        "Merienda": "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",
        "Cena": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80",
    }
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
    dias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
    orden_comidas = ["Desayuno", "Almuerzo", "Merienda", "Cena"]
    porcentajes_comida = {"Desayuno": 25, "Almuerzo": 35, "Merienda": 15, "Cena": 25}
    escala_calorias = max(0, float(calorias)) / 2000
    menu_semanal = []

    for indice_dia, dia in enumerate(dias):
        comidas_dia = []
        for indice_comida, nombre_comida in enumerate(orden_comidas):
            recetas_comida = recetas[nombre_comida]
            receta = recetas_comida[(indice_dia + indice_comida) % len(recetas_comida)]
            porciones = []
            for nombre, cantidad, unidad, grupo in receta["alimentos"]:
                cantidad_ajustada = cantidad * escala_calorias * ajuste_por_grupo[grupo]
                if unidad.startswith("unidad"):
                    cantidad_ajustada = max(1, round(cantidad_ajustada))
                else:
                    cantidad_ajustada = max(5, round(cantidad_ajustada / 5) * 5)
                porciones.append({"nombre": nombre, "cantidad": cantidad_ajustada, "unidad": unidad})

            porcentaje = porcentajes_comida[nombre_comida] / 100
            macros_comida = {macro: round(cantidad * porcentaje) for macro, cantidad in macros_diarios.items()}
            comidas_dia.append({
                "comida": nombre_comida,
                "plato": receta["plato"],
                "imagen": imagenes_comida[nombre_comida],
                "calorias": round(calorias * porcentaje),
                "macros": macros_comida,
                "alimentos": porciones,
            })

        menu_semanal.append({
            "dia": dia,
            "calorias": calorias,
            "macros": macros_diarios,
            "comidas": comidas_dia,
        })

    return {"distribucion_macros": distribucion_macros, "menu_alimenticio": menu_semanal}


def calcular_resumen(edad, sexo, peso, estatura, actividad, objetivo, dias_entrenamiento):
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

    gasto_total = tmb * actividad
    objetivo_lower = objetivo.lower()
    if "masa" in objetivo_lower:
        calorias = round(gasto_total + 400)
        explicacion_nutricional = "Para hipertrofia muscular necesitas un superávit calórico controlado (+400 kcal) con alta ingesta proteica para la síntesis muscular."
    elif "grasa" in objetivo_lower or "peso" in objetivo_lower:
        calorias = round(gasto_total - 400)
        explicacion_nutricional = "Para reducir porcentaje de grasa aplicamos un déficit calórico (-400 kcal) protegiendo tu masa magra mediante proteína elevada."
    else:
        calorias = round(gasto_total)
        explicacion_nutricional = "Mantendrás tu gasto energético de mantenimiento (normocalórica) optimizando el rendimiento y la definición muscular."

    distribucion_macros = distribucion_macros_por_objetivo(objetivo)
    proteinas = round(calorias * distribucion_macros["proteinas"] / 100 / 4)
    carbos = round(calorias * distribucion_macros["carbohidratos"] / 100 / 4)
    grasas = round(calorias * distribucion_macros["grasas"] / 100 / 9)
    macros_diarios = {"proteinas": proteinas, "carbohidratos": carbos, "grasas": grasas}
    plan_alimenticio = construir_plan_alimenticio(objetivo, calorias, macros_diarios)
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
        "rutina": crear_rutina(objetivo, dias_entrenamiento, peso),
    }


@app.post("/api/registro")
def registrar(datos: UsuarioRegistro):
    validar_seguridad(datos.usuario.strip(), datos.contrasena.strip())
    validar_correo(datos.email.strip())

    conn = obtener_conexion()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO usuarios (
                usuario, password, email, edad, sexo, peso, estatura,
                actividad, objetivo, dias_entrenamiento, peso_inicial
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            datos.usuario.strip(),
            hash_password(datos.contrasena.strip()),
            datos.email.strip().lower(),
            datos.edad,
            datos.sexo,
            datos.peso,
            datos.estatura / 100 if datos.estatura > 3 else datos.estatura,
            datos.actividad,
            datos.objetivo,
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
def obtener_perfil(usuario: str):
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
        "objetivo": str(valor_o_default("Objetivo", "Ganar masa muscular")),
        "dias_entrenamiento": dias_entrenamiento,
        "peso_inicial": peso_inicial,
    }


@app.put("/api/perfil/{usuario}")
def actualizar_perfil(usuario: str, datos: UsuarioPerfilUpdate):
    if datos.email is not None:
        validar_correo(datos.email.strip())

    campos = {
        "email": datos.email.strip().lower() if datos.email is not None else None,
        "edad": datos.edad,
        "sexo": datos.sexo,
        "peso": datos.peso,
        "estatura": datos.estatura / 100 if datos.estatura is not None and datos.estatura > 3 else datos.estatura,
        "actividad": datos.actividad,
        "objetivo": datos.objetivo,
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
        perfil["actividad"], perfil["objetivo"], perfil["dias_entrenamiento"]
    )
    return {"mensaje": "Perfil actualizado correctamente.", **perfil, **resumen}


@app.get("/api/get-profile")
def obtener_perfil_frontend(username: str):
    return obtener_perfil(username)


@app.post("/api/update-profile")
def actualizar_perfil_frontend(datos: PerfilFrontendUpdate):
    datos_perfil = UsuarioPerfilUpdate(
        edad=datos.edad,
        sexo=datos.sexo,
        peso=datos.peso,
        estatura=datos.estatura,
        actividad=datos.actividad,
        objetivo=datos.objetivo,
        dias_entrenamiento=datos.dias,
        email=datos.email,
    )
    return actualizar_perfil(datos.username, datos_perfil)


@app.post("/api/login")
def login(datos: UsuarioLogin):
    p_clean = datos.contrasena.strip()
    conn = obtener_conexion()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT usuario AS "Usuario", password AS "Contraseña",
                   email AS "Correo", edad AS "Edad", sexo AS "Sexo",
                   peso AS "Peso", estatura AS "Estatura", actividad AS "Actividad",
                   objetivo AS "Objetivo", dias_entrenamiento AS "DiasEntrenamiento",
                   peso_inicial AS "PesoInicial"
            FROM usuarios
            WHERE LOWER(usuario) = LOWER(%s)
            """,
            (datos.usuario.strip(),),
        )
        user_row = cursor.fetchone()
        if user_row is None or not verificar_password(p_clean, str(user_row["Contraseña"]).strip()):
            raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos.")

        stored_password = str(user_row["Contraseña"]).strip()
        if not stored_password.startswith(f"{PASSWORD_PREFIX}$"):
            cursor.execute(
                "UPDATE usuarios SET password = %s WHERE usuario = %s",
                (hash_password(p_clean), user_row["Usuario"]),
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
    objetivo = str(user_row.get("Objetivo", "Ganar masa muscular"))
    dias_entrenamiento = int(user_row.get("DiasEntrenamiento", 4) or 4)
    resumen = calcular_resumen(edad, sexo, peso, estatura, actividad, objetivo, dias_entrenamiento)

    return {
        "mensaje": "Acceso concedido",
        "usuario": user_row["Usuario"],
        "edad": edad,
        "sexo": sexo,
        "peso": peso,
        "estatura": estatura,
        "actividad": actividad,
        "objetivo": objetivo,
        "dias_entrenamiento": dias_entrenamiento,
        "email": "" if pd.isna(user_row.get("Correo", "")) else str(user_row.get("Correo", "") or ""),
        "peso_inicial": user_row.get("PesoInicial", peso),
        **resumen,
    }


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
def obtener_seguimiento(usuario: str):
    return construir_resumen_seguimiento(usuario)


@app.post("/api/seguimiento/{usuario}")
def registrar_seguimiento(usuario: str, datos: SeguimientoRegistro):
    if not usuario.strip():
        raise HTTPException(status_code=400, detail="Usuario no válido.")

    try:
        peso = float(datos.peso)
    except ValueError:
        raise HTTPException(status_code=400, detail="El peso debe ser un número válido.")

    if peso <= 0:
        raise HTTPException(status_code=400, detail="El peso debe ser mayor a 0.")

    if not datos.fecha:
        raise HTTPException(status_code=400, detail="La fecha es obligatoria.")

    df = cargar_seguimiento()
    nuevo_registro = pd.DataFrame([{"Usuario": usuario.strip(), "Fecha": datos.fecha.strip(), "Peso": peso}])

    match = df[(df["Usuario"].str.strip().str.lower() == usuario.strip().lower()) & (df["Fecha"].str.strip() == datos.fecha.strip())]
    if not match.empty:
        df.loc[match.index, "Peso"] = peso
    else:
        df = pd.concat([df, nuevo_registro], ignore_index=True)

    df = normalizar_csv_seguimiento(df)
    df = df.sort_values("Fecha", ascending=False, kind="mergesort").reset_index(drop=True)
    df.to_csv(SEGUIMIENTO_FILE, index=False)

    return {"mensaje": "Registro guardado correctamente.", **construir_resumen_seguimiento(usuario)}


app.mount("/", StaticFiles(directory=BASE_DIR, html=True), name="frontend")
