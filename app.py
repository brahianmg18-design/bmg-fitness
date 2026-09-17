from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional
import pandas as pd
import os
import re

app = FastAPI(title="BMG Fitness API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
USERS_FILE = os.path.join(BASE_DIR, "usuarios.csv")
SEGUIMIENTO_FILE = os.path.join(BASE_DIR, "seguimiento.csv")
USER_COLUMNS = [
    "Usuario", "Contraseña", "Correo", "Edad", "Sexo", "Peso", "Estatura",
    "Actividad", "Objetivo", "DiasEntrenamiento"
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
    return df


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


def cargar_usuarios():
    if os.path.exists(USERS_FILE):
        df = pd.read_csv(USERS_FILE, dtype=str)
        df = normalizar_csv_usuarios(df)
        df.to_csv(USERS_FILE, index=False)
        return df
    return pd.DataFrame(columns=USER_COLUMNS)


def cargar_seguimiento():
    if os.path.exists(SEGUIMIENTO_FILE):
        df = pd.read_csv(SEGUIMIENTO_FILE, dtype=str)
        df = normalizar_csv_seguimiento(df)
        df.to_csv(SEGUIMIENTO_FILE, index=False)
        return df
    return pd.DataFrame(columns=SEGUIMIENTO_COLUMNS)


def construir_resumen_seguimiento(usuario: str):
    df = cargar_seguimiento()
    if df.empty:
        return {
            "usuario": usuario,
            "registros": [],
            "progreso": "Progreso: aún no hay registros previos.",
            "ultimo_peso": None,
        }

    df_usuario = df[df["Usuario"].str.strip().str.lower() == usuario.strip().lower()].copy()
    if df_usuario.empty:
        return {
            "usuario": usuario,
            "registros": [],
            "progreso": "Progreso: aún no hay registros previos.",
            "ultimo_peso": None,
        }

    df_usuario = df_usuario.sort_values("Fecha", ascending=False, kind="mergesort").reset_index(drop=True)
    registros = [
        {"fecha": str(row["Fecha"]), "peso": round(float(row["Peso"]), 1)}
        for _, row in df_usuario.iterrows()
    ]

    if len(registros) > 1:
        ultimo_peso = registros[0]["peso"]
        anterior_peso = registros[1]["peso"]
        diferencia = round(ultimo_peso - anterior_peso, 1)
        progreso = f"Progreso: {diferencia:+.1f} kg comparado con el registro previo"
    else:
        progreso = "Progreso: aún no hay comparación previa."

    return {
        "usuario": usuario,
        "registros": registros,
        "progreso": progreso,
        "ultimo_peso": registros[0]["peso"] if registros else None,
    }


def crear_rutina(objetivo: str, dias: int):
    if "masa" in objetivo.lower():
        ejercicios = [
            ("Tren inferior", [("Sentadilla con barra", "4 x 8-10", "Cuadriceps y glúteos"), ("Peso muerto rumano", "4 x 8-10", "Cadena posterior"), ("Prensa de pierna", "3 x 10-12", "Fuerza de piernas"), ("Elevación de gemelos", "4 x 12-15", "Pantorrillas"), ("Extensión de cuádriceps", "3 x 12-15", "Aislamiento de piernas")]),
            ("Pecho y tríceps", [("Press de banca", "4 x 8-10", "Pectoral y tríceps"), ("Press inclinado", "3 x 10-12", "Pecho superior"), ("Aperturas con mancuernas", "3 x 12", "Control del pectoral"), ("Extensión de tríceps", "3 x 10-12", "Tríceps"), ("Fondos asistidos", "3 x 10-12", "Pecho y tríceps")]),
            ("Espalda y bíceps", [("Remo con barra", "4 x 8-10", "Espalda media"), ("Jalón al pecho", "4 x 10-12", "Dorsales"), ("Remo unilateral", "3 x 10-12", "Control de la espalda"), ("Curl con mancuernas", "3 x 10-12", "Bíceps"), ("Pájaros con mancuernas", "3 x 12-15", "Deltoides posteriores")]),
            ("Hombros y core", [("Press militar", "4 x 8-10", "Hombros"), ("Elevaciones laterales", "4 x 12-15", "Deltoides laterales"), ("Face pull", "3 x 12-15", "Salud del hombro"), ("Plancha abdominal", "4 x 40 seg", "Zona media"), ("Elevaciones de piernas", "3 x 12", "Core inferior")]),
        ]
    elif "grasa" in objetivo.lower() or "peso" in objetivo.lower():
        ejercicios = [
            ("Piernas y acondicionamiento", [("Sentadilla goblet", "4 x 12", "Piernas"), ("Zancadas", "3 x 12 por pierna", "Estabilidad"), ("Puente de glúteos", "3 x 15", "Glúteos"), ("Bicicleta", "4 x 30 seg", "Acondicionamiento"), ("Salto de cuerda", "4 x 45 seg", "Cardio")]),
            ("Empuje", [("Flexiones", "4 x 10-15", "Pecho"), ("Press de hombros", "3 x 12", "Hombros"), ("Fondos asistidos", "3 x 10-12", "Tríceps"), ("Escaladores", "4 x 30 seg", "Core y cardio"), ("Burpees", "3 x 10", "Acondicionamiento")]),
            ("Tracción", [("Jalón al pecho", "4 x 10-12", "Espalda"), ("Remo en polea", "3 x 12", "Espalda media"), ("Curl de bíceps", "3 x 12", "Bíceps"), ("Caminata inclinada", "15 min", "Gasto energético"), ("Face pull", "3 x 15", "Salud del hombro")]),
            ("Circuito completo", [("Peso muerto con mancuerna", "3 x 12", "Cadena posterior"), ("Sentadilla con press", "3 x 12", "Trabajo global"), ("Kettlebell swing", "4 x 15", "Potencia"), ("Plancha lateral", "3 x 30 seg", "Core"), ("Jumping jacks", "4 x 40 seg", "Resistencia")]),
        ]
    else:
        ejercicios = [
            ("Fuerza general", [("Sentadilla búlgara", "3 x 10-12", "Piernas"), ("Press inclinado", "3 x 10", "Pecho"), ("Remo unilateral", "3 x 12", "Espalda"), ("Plancha", "3 x 45 seg", "Core"), ("Paseo del granjero", "3 x 40 m", "Estabilidad")]),
            ("Tren superior", [("Press de banca", "3 x 10", "Pecho"), ("Jalón al pecho", "3 x 12", "Espalda"), ("Press militar", "3 x 10", "Hombros"), ("Curl de bíceps", "3 x 12", "Brazos"), ("Extensión de tríceps", "3 x 12", "Tríceps")]),
            ("Tren inferior", [("Prensa de pierna", "3 x 12", "Piernas"), ("Peso muerto rumano", "3 x 10", "Cadena posterior"), ("Zancadas", "3 x 10", "Estabilidad"), ("Gemelos", "3 x 15", "Pantorrillas"), ("Puente de glúteos", "3 x 15", "Glúteos")]),
            ("Movilidad y core", [("Puente de glúteos", "3 x 15", "Glúteos"), ("Bird-dog", "3 x 10", "Estabilidad"), ("Paseo del granjero", "3 x 40 m", "Core"), ("Movilidad de cadera", "10 min", "Movilidad"), ("Plancha lateral", "3 x 30 seg", "Core")]),
        ]

    return [
        {"dia": index + 1, "nombre": ejercicios[index % len(ejercicios)][0], "ejercicios": [
            {
                "ejercicio": nombre,
                "series": series,
                "enfoque": enfoque,
                "imagen_url": EXERCISE_IMAGE_URLS.get(nombre),
            }
            for nombre, series, enfoque in ejercicios[index % len(ejercicios)][1]
        ]}
        for index in range(max(1, min(dias, 7)))
    ]


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
        proteinas = round(peso * 2.0)
        grasas = round(peso * 1.0)
        explicacion_nutricional = "Para hipertrofia muscular necesitas un superávit calórico controlado (+400 kcal) con alta ingesta proteica para la síntesis muscular."
    elif "grasa" in objetivo_lower or "peso" in objetivo_lower:
        calorias = round(gasto_total - 400)
        proteinas = round(peso * 2.2)
        grasas = round(peso * 0.8)
        explicacion_nutricional = "Para reducir porcentaje de grasa aplicamos un déficit calórico (-400 kcal) protegiendo tu masa magra mediante proteína elevada."
    else:
        calorias = round(gasto_total)
        proteinas = round(peso * 1.8)
        grasas = round(peso * 1.0)
        explicacion_nutricional = "Mantendrás tu gasto energético de mantenimiento (normocalórica) optimizando el rendimiento y la definición muscular."

    carbos = round((calorias - (proteinas * 4 + grasas * 9)) / 4)
    return {
        "imc": imc,
        "calorias": calorias,
        "proteinas": proteinas,
        "carbos": carbos,
        "grasas": grasas,
        "explicacion_nutricional": explicacion_nutricional,
        "rutina": crear_rutina(objetivo, dias_entrenamiento),
    }


@app.post("/api/registro")
def registrar(datos: UsuarioRegistro):
    validar_seguridad(datos.usuario.strip(), datos.contrasena.strip())
    validar_correo(datos.email.strip())

    df = cargar_usuarios()
    u_clean = datos.usuario.strip().lower()

    if not df.empty and u_clean in df["Usuario"].str.strip().str.lower().values:
        raise HTTPException(status_code=400, detail="El nombre de usuario ya se encuentra registrado.")

    nuevo_reg = pd.DataFrame([{
        "Usuario": datos.usuario.strip(),
        "Contraseña": datos.contrasena.strip(),
        "Correo": datos.email.strip().lower(),
        "Edad": datos.edad,
        "Sexo": datos.sexo,
        "Peso": datos.peso,
        "Estatura": datos.estatura,
        "Actividad": datos.actividad,
        "Objetivo": datos.objetivo,
        "DiasEntrenamiento": int(datos.dias_entrenamiento or 4)
    }])

    df_final = pd.concat([df, nuevo_reg], ignore_index=True)
    df_final = normalizar_csv_usuarios(df_final)
    df_final.to_csv(USERS_FILE, index=False)
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

    return {
        "usuario": user_row["Usuario"],
        "email": valor_o_default("Correo", ""),
        "edad": valor_o_default("Edad", 30),
        "sexo": valor_o_default("Sexo", "masculino"),
        "peso": valor_o_default("Peso", 70),
        "estatura": valor_o_default("Estatura", 170),
        "actividad": valor_o_default("Actividad", 1.55),
        "objetivo": valor_o_default("Objetivo", "Ganar masa muscular"),
        "dias_entrenamiento": valor_o_default("DiasEntrenamiento", 4),
    }


@app.put("/api/perfil/{usuario}")
def actualizar_perfil(usuario: str, datos: UsuarioPerfilUpdate):
    if datos.email is not None:
        validar_correo(datos.email.strip())

    df = cargar_usuarios()
    match = df[df["Usuario"].str.strip().str.lower() == usuario.strip().lower()]

    if match.empty:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    idx = match.index[0]
    campos = {
        "Edad": datos.edad,
        "Sexo": datos.sexo,
        "Peso": datos.peso,
        "Estatura": datos.estatura,
        "Actividad": datos.actividad,
        "Objetivo": datos.objetivo,
        "DiasEntrenamiento": datos.dias_entrenamiento,
        "Correo": datos.email.strip().lower() if datos.email is not None else None,
    }

    for campo, valor in campos.items():
        if valor is not None:
            df.loc[idx, campo] = valor

    df = normalizar_csv_usuarios(df)
    df.to_csv(USERS_FILE, index=False)
    perfil = obtener_perfil(usuario)
    resumen = calcular_resumen(
        perfil["edad"], perfil["sexo"], perfil["peso"], perfil["estatura"],
        perfil["actividad"], perfil["objetivo"], perfil["dias_entrenamiento"]
    )
    return {"mensaje": "Perfil actualizado correctamente.", **perfil, **resumen}


@app.post("/api/login")
def login(datos: UsuarioLogin):
    df = cargar_usuarios()
    if df.empty:
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos.")

    u_clean = datos.usuario.strip().lower()
    p_clean = datos.contrasena.strip()

    coincidencia = df[(df["Usuario"].str.strip().str.lower() == u_clean) & (df["Contraseña"].str.strip() == p_clean)]

    if coincidencia.empty:
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos.")

    user_row = coincidencia.iloc[0]

    edad = int(float(user_row["Edad"])) if str(user_row.get("Edad", "")).strip() not in ["", "nan"] else 30
    sexo = str(user_row.get("Sexo", "masculino"))
    peso = float(user_row.get("Peso", 70.0)) if str(user_row.get("Peso", "")).strip() not in ["", "nan"] else 70.0
    estatura = float(user_row.get("Estatura", 170.0)) if str(user_row.get("Estatura", "")).strip() not in ["", "nan"] else 170.0
    actividad = float(user_row.get("Actividad", 1.55)) if str(user_row.get("Actividad", "")).strip() not in ["", "nan"] else 1.55
    objetivo = str(user_row.get("Objetivo", "Ganar masa muscular"))
    dias_entrenamiento = int(user_row.get("DiasEntrenamiento", 4) or 4)

    estatura_m = estatura
    imc = round(peso / (estatura_m ** 2), 1)

    if sexo == "masculino":
        tmb = (10 * peso) + (6.25 * estatura_m * 100) - (5 * edad) + 5
    else:
        tmb = (10 * peso) + (6.25 * estatura_m * 100) - (5 * edad) - 161

    gasto_total = tmb * actividad

    if objetivo == "Ganar masa muscular" or "masa" in objetivo.lower():
        calorias = round(gasto_total + 400)
        proteinas = round(peso * 2.0)
        grasas = round(peso * 1.0)
        carbos = round((calorias - (proteinas * 4 + grasas * 9)) / 4)
        explicacion_nutricional = "Para hipertrofia muscular necesitas un superávit calórico controlado (+400 kcal) con alta ingesta proteica para la síntesis muscular."
        rutina = [
            {"ejercicio": "Sentadilla Libre / Prensa de Pierna", "series": "4 series x 8-10 reps", "enfoque": "Tensión mecánica sobre cuadriceps y glúteos."},
            {"ejercicio": "Press de Banca Plano con Barra", "series": "4 series x 8-10 reps", "enfoque": "Desarrollo del pectoral mayor y tríceps."},
            {"ejercicio": "Remo con Barra o Polea Baja", "series": "4 series x 10-12 reps", "enfoque": "Hipertrofia de dorsal ancho y corrección postural."},
            {"ejercicio": "Press Militar con Mancuernas", "series": "3 series x 10-12 reps", "enfoque": "Construcción de hombros (deltoides anterior y lateral)."}
        ]
    elif objetivo == "Perder grasa" or "grasa" in objetivo.lower():
        calorias = round(gasto_total - 400)
        proteinas = round(peso * 2.2)
        grasas = round(peso * 0.8)
        carbos = round((calorias - (proteinas * 4 + grasas * 9)) / 4)
        explicacion_nutricional = "Para reducir porcentaje de grasa aplicamos un déficit calórico (-400 kcal) protegiendo tu masa magra mediante proteína elevada."
        rutina = [
            {"ejercicio": "Peso Muerto Rumano", "series": "4 series x 10-12 reps", "enfoque": "Estímulo de cadena posterior y alto gasto energético."},
            {"ejercicio": "Flexiones de Pecho / Push-ups", "series": "4 series al fallo técnico", "enfoque": "Mantenimiento de fuerza en empujes."},
            {"ejercicio": "Dominadas Asistidas o Jalón al Pecho", "series": "4 series x 10-12 reps", "enfoque": "Trabajo de tracción para espalda alta."},
            {"ejercicio": "Zancadas / Búlgaras con Mancuernas", "series": "3 series x 12 reps por pierna", "enfoque": "Densidad de entrenamiento y quema calórica."}
        ]
    else:
        calorias = round(gasto_total)
        proteinas = round(peso * 1.8)
        grasas = round(peso * 1.0)
        carbos = round((calorias - (proteinas * 4 + grasas * 9)) / 4)
        explicacion_nutricional = "Mantendrás tu gasto energético de mantenimiento (normocalórica) optimizando el rendimiento y la definición muscular."
        rutina = [
            {"ejercicio": "Sentadilla Búlgara", "series": "3 series x 10-12 reps", "enfoque": "Especialización y estabilidad de tren inferior."},
            {"ejercicio": "Press Inclinado con Mancuernas", "series": "4 series x 10 reps", "enfoque": "Enfoque en porción superior del pectoral."},
            {"ejercicio": "Remo Unilateral con Mancuerna", "series": "4 series x 12 reps", "enfoque": "Control neuromuscular y trabajo de espalda."},
            {"ejercicio": "Plancha Abdominal + Paseo del Granjero", "series": "4 series x 45 seg", "enfoque": "Fortalecimiento de la zona media (Core)."}
        ]

    rutina = crear_rutina(objetivo, dias_entrenamiento)

    return {
        "mensaje": "Acceso concedido",
        "usuario": user_row["Usuario"],
        "objetivo": objetivo,
        "dias_entrenamiento": dias_entrenamiento,
        "email": "" if pd.isna(user_row.get("Correo", "")) else str(user_row.get("Correo", "") or ""),
        "imc": imc,
        "calorias": calorias,
        "proteinas": proteinas,
        "carbos": carbos,
        "grasas": grasas,
        "explicacion_nutricional": explicacion_nutricional,
        "rutina": rutina,
    }


@app.post("/api/reset-password")
def solicitar_reset_password(datos: SolicitudResetPassword):
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

    return {"mensaje": "Si los datos coinciden, recibirás instrucciones para recuperar tu contraseña."}


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
