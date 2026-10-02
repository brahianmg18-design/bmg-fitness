const API_URL = window.location.protocol === "file:"
    ? "http://127.0.0.1:8000/api"
    : "/api";
const SESSION_KEY = "sessionUser";
const INACTIVITY_TIMEOUT = 4 * 60 * 1000;
const IMAGENES_EJERCICIOS = {
    "Sentadilla con barra": "https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=900&q=85",
    "Peso muerto rumano": "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=900&q=85",
    "Prensa de pierna": "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=900&q=85",
    "Extensión de cuádriceps": "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=900&q=85",
    "Elevación de gemelos": "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=900&q=85"
};
let usuarioActual = "";
let inactivityTimer = null;
let plantillaRutinaActiva = null;
let matrizNutricional = null;
let planNutricionalActivo = [];

async function leerRespuesta(respuesta, mensajePorDefecto) {
    const texto = await respuesta.text();
    let datos = {};

    if (texto) {
        try {
            datos = JSON.parse(texto);
        } catch (error) {
            if (!respuesta.ok) {
                throw new Error(`${mensajePorDefecto} (HTTP ${respuesta.status})`);
            }
            throw new Error("El servidor devolvió una respuesta no válida.");
        }
    }

    if (!respuesta.ok) {
        throw new Error(datos.detail || datos.message || `${mensajePorDefecto} (HTTP ${respuesta.status})`);
    }

    return datos;
}

function limpiarFormulariosAutenticacion() {
    document.querySelectorAll("#auth-box input").forEach((input) => {
        if (!["button", "submit", "reset", "hidden"].includes(input.type)) {
            input.value = "";
        }
    });
}

function inicializarSelectoresEstatura() {
    const selectores = [
        document.getElementById("reg-estatura"),
        document.getElementById("profile-estatura")
    ];

    selectores.forEach((selector) => {
        if (!selector) return;

        const placeholder = selector.querySelector('option[value=""]');
        const opciones = [];
        for (let centimetros = 120; centimetros <= 220; centimetros += 1) {
            const metros = (centimetros / 100).toFixed(2);
            opciones.push(new Option(`${metros} m`, metros));
        }

        selector.replaceChildren(...(placeholder ? [placeholder] : []), ...opciones);
    });
}

function mostrarTab(tab) {
    limpiarFormulariosAutenticacion();
    const formLogin = document.getElementById("form-login");
    const formRegister = document.getElementById("form-register");
    const formReset = document.getElementById("form-reset");
    const tabLogin = document.getElementById("tab-login");
    const tabRegister = document.getElementById("tab-register");
    const alertMsg = document.getElementById("alert-msg");

    alertMsg.innerText = "";
    document.getElementById("reset-password-fields").classList.add("hidden");
    document.getElementById("reset-new-password").required = false;
    document.getElementById("reset-confirm-password").required = false;
    document.getElementById("reset-submit").innerText = "Verificar datos";

    if (tab === 'login') {
        formLogin.classList.remove("hidden");
        formRegister.classList.add("hidden");
        formReset.classList.add("hidden");
        tabLogin.classList.add("active");
        tabRegister.classList.remove("active");
    } else {
        formLogin.classList.add("hidden");
        formRegister.classList.remove("hidden");
        formReset.classList.add("hidden");
        tabLogin.classList.remove("active");
        tabRegister.classList.add("active");
    }
}

function mostrarRecuperacion() {
    limpiarFormulariosAutenticacion();
    document.getElementById("form-login").classList.add("hidden");
    document.getElementById("form-register").classList.add("hidden");
    document.getElementById("form-reset").classList.remove("hidden");
    document.getElementById("reset-password-fields").classList.add("hidden");
    document.getElementById("reset-new-password").required = false;
    document.getElementById("reset-confirm-password").required = false;
    document.getElementById("reset-submit").innerText = "Verificar datos";
    document.getElementById("alert-msg").innerText = "";
}

async function ejecutarRegistro(e) {
    e.preventDefault();
    const alertMsg = document.getElementById("alert-msg");
    
    const usuario = document.getElementById("reg-user").value;
    const contrasena = document.getElementById("reg-pass").value;
    const email = document.getElementById("reg-email").value;
    const edad = parseInt(document.getElementById("reg-edad").value);
    const sexo = document.getElementById("reg-sexo").value;
    const peso = parseFloat(document.getElementById("reg-peso").value);
    const estatura = parseFloat(document.getElementById("reg-estatura").value);
    const actividad = parseFloat(document.getElementById("reg-actividad").value);
    const nivel_experiencia = document.getElementById("reg-nivel-experiencia").value;

    alertMsg.style.color = "#00e676";
    alertMsg.innerText = "Procesando registro...";

    try {
        const respuesta = await fetch(`${API_URL}/registro`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usuario, contrasena, email, edad, sexo, peso, estatura, actividad, nivel_experiencia })
        });

        const data = await leerRespuesta(respuesta, "No se pudo completar el registro.");

        if (respuesta.ok) {
            alertMsg.style.color = "#00e676";
            alertMsg.innerText = "¡Cuenta creada con éxito! Ya puedes iniciar sesión";
            document.getElementById("form-register").reset();
            setTimeout(() => mostrarTab('login'), 1200);
        } else {
            alertMsg.style.color = "#ff5252";
            alertMsg.innerText = data.detail;
        }
    } catch (error) {
        alertMsg.style.color = "#ff5252";
        alertMsg.innerText = "Error al conectar con el servidor backend.";
    }
}

async function ejecutarLogin(e) {
    e.preventDefault();
    const alertMsg = document.getElementById("alert-msg");
    
    const usuario = document.getElementById("login-user").value;
    const contrasena = document.getElementById("login-pass").value;

    try {
        const respuesta = await fetch(`${API_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usuario, contrasena })
        });

        const data = await leerRespuesta(respuesta, "No se pudo iniciar sesión.");

        if (respuesta.ok) {
            usuarioActual = data.usuario;
            limpiarFormulariosAutenticacion();
            localStorage.setItem(SESSION_KEY, JSON.stringify({
                username: usuarioActual,
                userData: data
            }));
            document.getElementById("auth-box").classList.add("hidden");
            document.getElementById("dashboard").classList.remove("hidden");
            
            document.getElementById("welcome-title").innerText = `Bienvenido, ${data.usuario}`;
            await actualizarDashboard(data);
            mostrarSeccion('inicio');

        } else {
            alertMsg.style.color = "#ff5252";
            alertMsg.innerText = data.detail;
        }
    } catch (error) {
        alertMsg.style.color = "#ff5252";
        alertMsg.innerText = "Error al conectar con el servidor backend.";
    }
}

async function solicitarRecuperacion(e) {
    e.preventDefault();
    const alertMsg = document.getElementById("alert-msg");
    const usuario = document.getElementById("reset-user").value.trim();
    const correo = document.getElementById("reset-correo").value.trim();
    const passwordFields = document.getElementById("reset-password-fields");
    const nuevaContrasena = document.getElementById("reset-new-password").value;
    const confirmarContrasena = document.getElementById("reset-confirm-password").value;

    alertMsg.style.color = "#94a3b8";
    alertMsg.innerText = "Enviando solicitud...";

    try {
        if (!passwordFields.classList.contains("hidden")) {
            if (!nuevaContrasena || !confirmarContrasena) {
                throw new Error("Introduce y confirma la nueva contraseña.");
            }
            if (nuevaContrasena !== confirmarContrasena) {
                throw new Error("Las contraseñas no coinciden.");
            }
        }

        const segundoPaso = !passwordFields.classList.contains("hidden");
        const datos = { usuario, correo };
        if (segundoPaso) {
            datos.nueva_contrasena = nuevaContrasena;
            datos.confirmar_contrasena = confirmarContrasena;
        }

        const endpoint = segundoPaso ? "/restablecer-password" : "/verificar-usuario";
        const respuesta = await fetch(`${API_URL}${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(datos)
        });
        const data = await leerRespuesta(respuesta, "No se pudo solicitar la recuperación.");

        if (!segundoPaso) {
            passwordFields.classList.remove("hidden");
            document.getElementById("reset-new-password").required = true;
            document.getElementById("reset-confirm-password").required = true;
            document.getElementById("reset-submit").innerText = "Guardar nueva contraseña";
            alertMsg.style.color = "#00e676";
            alertMsg.innerText = "Datos verificados. Define tu nueva contraseña.";
        } else {
            window.alert("Contraseña actualizada correctamente. Ya puedes iniciar sesión");
            document.getElementById("form-reset").reset();
            passwordFields.classList.add("hidden");
            document.getElementById("reset-new-password").required = false;
            document.getElementById("reset-confirm-password").required = false;
            document.getElementById("reset-submit").innerText = "Verificar datos";
            mostrarTab("login");
        }
    } catch (error) {
        alertMsg.style.color = "#ff5252";
        alertMsg.innerText = error.message;
    }
}

function renderizarPlanAlimenticio(menu) {
    planNutricionalActivo = Array.isArray(menu) ? menu : [];
    const selectorDia = document.getElementById("nutrition-day");
    const diaGuardado = localStorage.getItem("nutritionSelectedDay") || "1";
    selectorDia.replaceChildren(...planNutricionalActivo.map((dia, indice) => {
        const numeroDia = Number(dia.dia_numero ?? indice + 1);
        return new Option(`Día ${numeroDia}`, numeroDia);
    }));
    selectorDia.value = planNutricionalActivo.some((dia, indice) => Number(dia.dia_numero ?? indice + 1) === Number(diaGuardado))
        ? diaGuardado
        : "1";
    mostrarDiaNutricional();
}

function mostrarDiaNutricional() {
    const contenedor = document.getElementById("menu-alimenticio");
    if (!planNutricionalActivo.length) {
        contenedor.innerHTML = "";
        return;
    }

    try {
        const selectorDia = document.getElementById("nutrition-day");
        const dia = window.NutritionalScalingEngine.obtenerMenuDia(planNutricionalActivo, selectorDia.value);
        localStorage.setItem("nutritionSelectedDay", selectorDia.value);
        contenedor.innerHTML = renderizarTarjetaDiaAlimenticio(dia);
    } catch (error) {
        contenedor.textContent = error.message;
    }
}

function renderizarTarjetaDiaAlimenticio(dia) {
        const macrosDia = dia.total_dia || dia.macros || {};
        const comidas = Array.isArray(dia.comidas) ? dia.comidas : [];
        const comidasHtml = comidas.map((comida) => {
            const macrosComida = comida.macros || {};
            const alimentos = (comida.alimentos || []).map((alimento) => {
                if (typeof alimento === "string") {
                    return `<li>${escaparHtml(alimento)}</li>`;
                }

                return `<li><span>${escaparHtml(alimento.nombre)}</span><strong>${escaparHtml(alimento.cantidad)} ${escaparHtml(alimento.unidad)}</strong></li>`;
            }).join("");

            return `
                <article class="meal-plan-meal">
                    <img src="${escaparHtml(comida.imagen)}" alt="${escaparHtml(comida.plato || comida.comida)}" loading="lazy" decoding="async">
                    <div class="meal-plan-meal-heading">
                        <h5>${escaparHtml(comida.comida)}</h5>
                        <span>${escaparHtml(comida.calorias)} kcal aprox.</span>
                    </div>
                    <p class="meal-plan-dish">${escaparHtml(comida.plato)}</p>
                    <p class="meal-plan-meal-macros">P ${escaparHtml(macrosComida.proteinas)} g · C ${escaparHtml(macrosComida.carbohidratos)} g · G ${escaparHtml(macrosComida.grasas)} g</p>
                    <ul class="meal-plan-foods">${alimentos}</ul>
                </article>
            `;
        }).join("");

        return `
            <section class="meal-plan-day">
                <header class="meal-plan-day-heading">
                    <h4>${escaparHtml(dia.dia)}</h4>
                    <strong>${escaparHtml(dia.calorias)} kcal objetivo diario</strong>
                </header>
                <p class="meal-plan-day-macros">Proteínas ${escaparHtml(macrosDia.proteinas)} g · Carbohidratos ${escaparHtml(macrosDia.carbohidratos)} g · Grasas ${escaparHtml(macrosDia.grasas)} g</p>
                <div class="meal-plan-day-meals">${comidasHtml}</div>
            </section>
        `;
}

async function cargarMatrizNutricional() {
    try {
        const respuesta = await fetch("nutrition-prototype-matrix.json");
        const documento = await leerRespuesta(respuesta, "No se pudo cargar la matriz nutricional.");
        window.NutritionalScalingEngine.validarMatriz(documento);
        matrizNutricional = documento;
    } catch (error) {
        document.getElementById("nutrition-warnings").textContent = error.message;
    }
}

function actualizarEncabezadoRutina(objetivo) {
    const mensajes = {
        "Hipertrofia (Masa)": "Rutina enfocada en el desarrollo muscular y la progresión del volumen.",
        "Fuerza/Definición": "Rutina de fuerza con trabajo equilibrado para sostener el rendimiento.",
        "Acondicionamiento General": "Rutina orientada a la capacidad cardiovascular y al acondicionamiento global."
    };
    const titulo = objetivo || "Sin definir";
    const mensaje = mensajes[objetivo] || "";

    document.getElementById("routine-goal-title").innerText = `Objetivo: ${titulo}`;
    document.getElementById("routine-goal-message").innerText = mensaje;
}

async function actualizarDashboard(data) {
    let datosNutricionales = data;
    if (matrizNutricional && Array.isArray(data.menu_alimenticio) && data.menu_alimenticio.length) {
        try {
            const planAdaptado = window.NutritionalScalingEngine.adaptarMenu(
                matrizNutricional,
                data.menu_alimenticio,
                data,
                data.calorias
            );
            const objetivos = planAdaptado.objetivos;
            const totalCaloriasMacros = objetivos.proteinas * 4 + objetivos.carbohidratos * 4 + objetivos.grasas * 9;
            datosNutricionales = {
                ...data,
                tmb: objetivos.tmb,
                tdee: objetivos.tdee,
                calorias: objetivos.calorias,
                proteinas: objetivos.proteinas,
                carbos: objetivos.carbohidratos,
                grasas: objetivos.grasas,
                menu_alimenticio: planAdaptado.menu,
                metadatos_nutricionales: planAdaptado.metadatos,
                explicacion_nutricional: `Prototipo ${objetivos.prototipo_id}; objetivo ajustado a ${objetivos.calorias} kcal con tus datos reales.`,
                distribucion_macros: {
                    proteinas: Math.round(objetivos.proteinas * 4 / totalCaloriasMacros * 100),
                    carbohidratos: Math.round(objetivos.carbohidratos * 4 / totalCaloriasMacros * 100),
                    grasas: Math.round(objetivos.grasas * 9 / totalCaloriasMacros * 100)
                }
            };
            document.getElementById("nutrition-reference").textContent = `Prototipo de referencia: ${objetivos.prototipo_id} · ${objetivos.perfil_prototipo} · Factor de actividad ${objetivos.factor_actividad} · Experiencia ${objetivos.factor_experiencia}`;
            document.getElementById("nutrition-warnings").textContent = planAdaptado.advertencias.join(" ");
        } catch (error) {
            document.getElementById("nutrition-warnings").textContent = error.message;
        }
    }
    data = datosNutricionales;

    document.getElementById("res-imc").innerText = data.imc;
    document.getElementById("res-tmb").innerText = `${data.tmb} kcal`;
    document.getElementById("res-tdee").innerText = `${data.tdee} kcal`;
    document.getElementById("res-calorias").innerText = `${data.calorias} kcal`;
    document.getElementById("res-proteinas").innerText = `${data.proteinas} g`;
    document.getElementById("res-carbos").innerText = `${data.carbos} g`;
    document.getElementById("res-grasas").innerText = `${data.grasas} g`;
    document.getElementById("nutrition-goal").value = data.objetivo_nutricional || "Mantenimiento";
    document.getElementById("training-goal").value = data.objetivo_entrenamiento || "Hipertrofia (Masa)";
    document.getElementById("res-explicacion").innerText = data.explicacion_nutricional;
    const distribucion = data.distribucion_macros || {};
    document.getElementById("res-distribucion").innerText =
        `Distribución orientativa: ${distribucion.carbohidratos ?? "-"}% carbohidratos, ${distribucion.proteinas ?? "-"}% proteína y ${distribucion.grasas ?? "-"}% grasas.`;
    renderizarPlanAlimenticio(data.menu_alimenticio || []);
    document.getElementById("home-imc").innerText = data.imc;
    document.getElementById("home-calorias").innerText = `${data.calorias} kcal`;
    document.getElementById("home-objetivo").innerText = data.objetivo_nutricional || "-";
    actualizarEncabezadoRutina(data.objetivo_entrenamiento);
    mostrarPerfil(data);
    renderizarRutina(data.rutina);
    await cargarSeguimiento();
    return datosNutricionales;
}

function mostrarSeccion(seccion) {
    document.querySelectorAll(".dashboard-section").forEach((panel) => {
        panel.classList.toggle("hidden", panel.id !== `section-${seccion}`);
    });
    document.querySelectorAll(".dashboard-tab").forEach((tab) => {
        tab.classList.toggle("active", tab.dataset.section === seccion);
    });

    if (seccion === "seguimiento" && usuarioActual) {
        cargarSeguimiento();
    }
    if (seccion === "perfil" && usuarioActual) {
        cargarPerfil();
    }
}

async function cargarPerfil() {
    if (!usuarioActual) return;

    const profileMsg = document.getElementById("profile-msg");
    try {
        const respuesta = await fetch(`${API_URL}/perfil/${encodeURIComponent(usuarioActual)}`);
        const perfil = await leerRespuesta(respuesta, "No se pudo cargar el perfil.");
        mostrarPerfil(perfil);
    } catch (error) {
        profileMsg.style.color = "#ff5252";
        profileMsg.innerText = error.message;
    }
}

function actualizarIndicadorIMC(perfil) {
    const tarjeta = document.getElementById("current-imc-card");
    const valor = document.getElementById("current-imc");
    const estado = document.getElementById("current-imc-status");
    const peso = Number(perfil.peso);
    let estatura = Number(perfil.estatura);
    if (estatura > 3) estatura /= 100;

    const imcInformado = Number(perfil.imc);
    const imc = Number.isFinite(imcInformado) && imcInformado > 0
        ? imcInformado
        : peso > 0 && estatura > 0 ? peso / (estatura ** 2) : NaN;

    tarjeta.classList.remove("imc-underweight", "imc-normal", "imc-overweight", "imc-obesity", "imc-unknown");
    if (!Number.isFinite(imc)) {
        tarjeta.classList.add("imc-unknown");
        valor.innerText = "-";
        estado.innerText = "Sin datos";
        return;
    }

    valor.innerText = imc.toFixed(1);
    if (imc < 18.5) {
        tarjeta.classList.add("imc-underweight");
        estado.innerText = "Bajo peso";
    } else if (imc < 25) {
        tarjeta.classList.add("imc-normal");
        estado.innerText = "Normal";
    } else if (imc < 30) {
        tarjeta.classList.add("imc-overweight");
        estado.innerText = "Sobrepeso";
    } else {
        tarjeta.classList.add("imc-obesity");
        estado.innerText = "Obesidad";
    }
}

function mostrarPerfil(perfil) {
    document.getElementById("profile-email").value = perfil.email || "";
    document.getElementById("profile-edad").value = perfil.edad ?? "";
    document.getElementById("profile-sexo").value = perfil.sexo || "masculino";
    document.getElementById("profile-peso").value = perfil.peso ?? "";
    document.getElementById("profile-estatura").value = perfil.estatura ?? "";
    document.getElementById("profile-actividad").value = perfil.actividad ?? 1.55;
    document.getElementById("profile-nivel-experiencia").value = perfil.nivel_experiencia || "Principiante";
    document.getElementById("profile-dias").value = perfil.dias_entrenamiento ?? 4;
    document.getElementById("current-edad").innerText = `${perfil.edad ?? "-"} años`;
    document.getElementById("current-sexo").innerText = perfil.sexo || "-";
    document.getElementById("current-peso").innerText = `${perfil.peso ?? "-"} kg`;
    document.getElementById("current-estatura").innerText = `${perfil.estatura ?? "-"} m`;
    document.getElementById("current-actividad").innerText = nombreActividad(perfil.actividad);
    document.getElementById("current-experiencia").innerText = perfil.nivel_experiencia || "-";
    document.getElementById("current-dias").innerText = `${perfil.dias_entrenamiento ?? "-"} días`;
    document.getElementById("current-email").innerText = perfil.email || "-";
    actualizarIndicadorIMC(perfil);
}

function nombreActividad(valor) {
    const actividades = {
        "1.2": "Sedentario",
        "1.375": "Ligeramente activo",
        "1.55": "Moderadamente activo",
        "1.725": "Muy activo",
        "1.9": "Hiperactivo / Atleta"
    };
    return actividades[String(valor)] || `${valor} factor`;
}

async function guardarPerfil(e) {
    e.preventDefault();
    const profileMsg = document.getElementById("profile-msg");

    const usuarioActivo =
        localStorage.getItem("usuarioActual") ||
        localStorage.getItem("usuario") ||
        localStorage.getItem("currentUser") ||
        localStorage.getItem("user") ||
        sessionStorage.getItem("usuarioActual") ||
        sessionStorage.getItem("usuario") ||
        (typeof usuarioActual !== "undefined" && usuarioActual ? usuarioActual : null) ||
        (typeof usuarioLogueado !== "undefined" ? usuarioLogueado : null);

    if (!usuarioActivo) {
        if (profileMsg) profileMsg.textContent = "Error: No se pudo identificar el usuario activo. Por favor vuelve a iniciar sesión.";
        return;
    }

    const edadVal = parseInt(document.getElementById("profile-edad").value);
    const pesoVal = parseFloat(document.getElementById("profile-peso").value);
    const estaturaVal = parseFloat(document.getElementById("profile-estatura").value);
    const actividadVal = parseFloat(document.getElementById("profile-actividad").value);
    const diasVal = parseInt(document.getElementById("profile-dias").value);
    const emailInput = document.getElementById("profile-email");

    const datos = {
        edad: isNaN(edadVal) ? null : edadVal,
        sexo: document.getElementById("profile-sexo").value,
        peso: isNaN(pesoVal) ? null : pesoVal,
        estatura: isNaN(estaturaVal) ? null : estaturaVal,
        actividad: isNaN(actividadVal) ? null : actividadVal,
        nivel_experiencia: document.getElementById("profile-nivel-experiencia").value,
        dias_entrenamiento: isNaN(diasVal) ? null : diasVal,
        email: emailInput && emailInput.value ? emailInput.value.trim() : null
    };

    try {
        if (profileMsg) profileMsg.textContent = "Guardando cambios...";

        const response = await fetch(`${API_URL}/perfil/${encodeURIComponent(usuarioActivo)}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(datos)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.detail || result.mensaje || "Error al actualizar el perfil.");
        }

        if (profileMsg) profileMsg.textContent = "¡Perfil actualizado correctamente!";

        const sesionGuardada = localStorage.getItem(SESSION_KEY);
        if (sesionGuardada) {
            const sesion = JSON.parse(sesionGuardada);
            sesion.userData = { ...(sesion.userData || {}), ...result };
            localStorage.setItem(SESSION_KEY, JSON.stringify(sesion));
        }
        await actualizarDashboard(result);
    } catch (error) {
        console.error("Error en guardarPerfil:", error);
        if (profileMsg) profileMsg.textContent = error.message || "No ha sido posible conectarse con el servidor.";
    }
}

function escaparHtml(valor) {
    return String(valor ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function crearTarjetaEjercicio(nombreEjercicio, imagenUrl) {
    const nombreSeguro = escaparHtml(nombreEjercicio);
    const imagenSegura = escaparHtml(imagenUrl || IMAGENES_EJERCICIOS[nombreEjercicio] || "");
    const tieneImagen = Boolean(imagenSegura);
    return `<div class="exercise-visual" aria-label="${nombreSeguro}">
        ${tieneImagen ? `<img src="${imagenSegura}" alt="Demostración de ${nombreSeguro}" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.classList.remove('hidden')">` : ""}
        <div class="exercise-fallback${tieneImagen ? " hidden" : ""}" aria-hidden="true">
            <svg viewBox="0 0 64 64" role="img" focusable="false">
                <path d="M16 26v12M11 29v6M21 22v20M43 22v20M48 26v12M53 29v6M21 32h22" />
            </svg>
        </div>
        <strong>${nombreSeguro}</strong>
    </div>`;
}

function renderizarRutina(rutina) {
    if (plantillaRutinaActiva) {
        actualizarVistaRutina();
        return;
    }

    const routineContainer = document.getElementById("routine-container");
    routineContainer.innerHTML = rutina.map((dia) => `
        <section class="day-plan">
            <h4>Día ${dia.dia}: ${dia.nombre}</h4>
            ${dia.metodo ? `<p class="enfoque">${escaparHtml(dia.metodo)}</p>` : ""}
            ${dia.ejercicios.map((item) => {
                return `
                <div class="exercise-card">
                    ${crearTarjetaEjercicio(item.ejercicio, item.imagen_url)}
                    <h5>${escaparHtml(item.ejercicio)}</h5>
                    <p class="exercise-instructions">${escaparHtml(item.instrucciones || "Mantén una postura estable y controla cada repetición durante todo el recorrido.")}</p>
                    <p class="series">${escaparHtml(item.series)}</p>
                    <p class="enfoque"><strong>Enfoque:</strong> ${escaparHtml(item.enfoque)}</p>
                    <p class="enfoque"><strong>Descanso:</strong> ${escaparHtml(item.descanso)}</p>
                    ${item.peso_inicio_kg != null ? `<p class="enfoque"><strong>Carga inicial orientativa:</strong> ${Number(item.peso_inicio_kg).toFixed(1)} kg</p>` : ""}
                </div>
            `;
            }).join("")}
        </section>
    `).join("");
}

function cargarPlantillaRutina() {
    const mensaje = document.getElementById("routine-template-msg");
    try {
        const texto = document.getElementById("routine-template-json").value;
        const plantilla = JSON.parse(texto);
        window.RutinaEngine.validarPlantilla(plantilla);
        plantillaRutinaActiva = plantilla;
        localStorage.setItem("routineTemplate", JSON.stringify(plantilla));

        const semanas = document.getElementById("routine-week");
        semanas.replaceChildren(...plantilla.semanas.map((semana) => new Option(`Semana ${semana.semana}`, semana.semana)));
        semanas.disabled = false;
        semanas.value = String(plantilla.semanas[0].semana);
        actualizarDiasRutina();
        actualizarVistaRutina();
        mensaje.style.color = "#00e676";
        mensaje.textContent = `Plantilla ${plantilla.plantilla_id} cargada.`;
    } catch (error) {
        mensaje.style.color = "#ff5252";
        mensaje.textContent = error.message || "No se pudo cargar la plantilla JSON.";
    }
}

function actualizarDiasRutina() {
    const semanas = document.getElementById("routine-week");
    const dias = document.getElementById("routine-day");
    if (!plantillaRutinaActiva) return;

    const semana = plantillaRutinaActiva.semanas.find((item) => item.semana === Number(semanas.value));
    if (!semana) return;
    dias.replaceChildren(...semana.dias.map((dia) => new Option(`Día ${dia.dia}${dia.rutina ? ` · ${dia.rutina}` : ""}`, dia.dia)));
    dias.disabled = false;
}

function cambiarSemanaRutina() {
    actualizarDiasRutina();
    actualizarVistaRutina();
}

function actualizarVistaRutina() {
    if (!plantillaRutinaActiva) return;

    const semana = Number(document.getElementById("routine-week").value);
    const dia = Number(document.getElementById("routine-day").value);
    const mensaje = document.getElementById("routine-template-msg");
    try {
        const desglose = window.RutinaEngine.generarDesglose(plantillaRutinaActiva, semana, dia);
        const fase = desglose.instruccion_fase;
        const resumenFase = document.getElementById("routine-phase-summary");
        resumenFase.innerHTML = `
            <strong>Semana ${desglose.semana}: ${escaparHtml(fase.fase)}</strong>
            <p>${escaparHtml(fase.objetivo)}</p>
            <p>RIR objetivo: ${escaparHtml(fase.RIR_objetivo)} · Volumen: ${escaparHtml(fase.volumen)}</p>
            ${fase.criterio ? `<p>${escaparHtml(fase.criterio)}</p>` : ""}
            <p>${escaparHtml(desglose.reglas_de_progresion[`semana_${desglose.semana}`])}</p>
            <p>${escaparHtml(desglose.criterios_generales.regla_de_progresion)}</p>
            <p>${escaparHtml(desglose.criterios_generales.calentamiento.descripcion)}</p>
            <p>${escaparHtml(desglose.criterios_generales.regla_de_carga)}</p>
            <p>${escaparHtml(desglose.criterios_generales.criterio_tecnico)}</p>
            <p class="routine-safety-alert">${escaparHtml(desglose.criterios_generales.advertencia)}</p>
        `;
        resumenFase.classList.remove("hidden");
        document.getElementById("routine-goal-title").innerText = `${desglose.dia.rutina}: ${desglose.dia.enfoque || desglose.dia.rutina}`;
        document.getElementById("routine-goal-message").innerText = desglose.criterios_generales.calentamiento.descripcion;

        document.getElementById("routine-container").innerHTML = desglose.dia.ejercicios.map((ejercicio, indice) => `
            <article class="day-plan template-day-plan">
                <h4>${indice + 1}. ${escaparHtml(ejercicio.nombre)}</h4>
                <p class="enfoque"><strong>Grupo muscular:</strong> ${escaparHtml(ejercicio.grupo_muscular.join(", "))}</p>
                <p class="series"><strong>Series y repeticiones:</strong> ${ejercicio.series} × ${escaparHtml(ejercicio.repeticiones)}</p>
                <p class="enfoque"><strong>Tempo:</strong> ${escaparHtml(ejercicio.tempo)} · <strong>Descanso:</strong> ${ejercicio.descanso_seg} s · <strong>RIR:</strong> ${ejercicio.RIR_objetivo}</p>
                <p class="exercise-instructions">${escaparHtml(ejercicio.tecnica)}</p>
                ${ejercicio.alerta_seguridad ? `<p class="routine-safety-alert" role="alert">${escaparHtml(ejercicio.alerta_seguridad.mensaje)}</p>` : ""}
            </article>
        `).join("");
        mensaje.textContent = "";
    } catch (error) {
        mensaje.style.color = "#ff5252";
        mensaje.textContent = error.message;
    }
}

async function restaurarPlantillaRutina() {
    try {
        let guardada = localStorage.getItem("routineTemplate");
        if (!guardada) {
            const respuesta = await fetch("rutinas/P01_F3_HIPERTROFIA_FULLBODY_ABC.json");
            if (!respuesta.ok) throw new Error("No se pudo cargar la plantilla P01 del proyecto.");
            const plantillaPorDefecto = await respuesta.json();
            window.RutinaEngine.validarPlantilla(plantillaPorDefecto);
            guardada = JSON.stringify(plantillaPorDefecto);
            localStorage.setItem("routineTemplate", guardada);
        }
        plantillaRutinaActiva = JSON.parse(guardada);
        window.RutinaEngine.validarPlantilla(plantillaRutinaActiva);
        document.getElementById("routine-template-json").value = guardada;
        const selectorSemana = document.getElementById("routine-week");
        selectorSemana.replaceChildren(...plantillaRutinaActiva.semanas.map((semana) => new Option(`Semana ${semana.semana}`, semana.semana)));
        selectorSemana.disabled = false;
        selectorSemana.value = String(plantillaRutinaActiva.semanas[0].semana);
        actualizarDiasRutina();
    } catch (error) {
        plantillaRutinaActiva = null;
        const mensaje = document.getElementById("routine-template-msg");
        mensaje.style.color = "#ff5252";
        mensaje.textContent = error.message || "No se pudo restaurar la plantilla JSON.";
    }
}

async function cargarSeguimiento() {
    if (!usuarioActual) return;

    const tbody = document.getElementById("seguimiento-registros");
    const progreso = document.getElementById("seguimiento-progreso");
    const msg = document.getElementById("seguimiento-msg");

    try {
        const respuesta = await fetch(`${API_URL}/seguimiento/${encodeURIComponent(usuarioActual)}`);
        const data = await leerRespuesta(respuesta, "No se pudo cargar el seguimiento.");

        if (!data.registros || !data.registros.length) {
            tbody.innerHTML = `<tr><td colspan="4">Sin registros disponibles.</td></tr>`;
            progreso.innerText = "Sin registros aún.";
            return;
        }

        const registros = [...data.registros].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
        tbody.innerHTML = registros.map((registro) => `
            <tr>
                <td>${formatearFecha(registro.fecha)}</td>
                <td>${Number(registro.peso).toFixed(1)} kg</td>
                <td>${escaparHtml(registro.objetivo_momento || "-")}</td>
                <td>${formatearMedidas(registro.medidas)}</td>
            </tr>
        `).join("");

        progreso.innerText = data.progreso || "Sin registros aún.";
        if (msg) msg.innerText = "";
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="4">Sin registros disponibles.</td></tr>`;
        progreso.innerText = error.message;
    }
}

function formatearMedidas(medidas) {
    const etiquetas = { cintura: "Cintura", cadera: "Cadera", brazo: "Brazo" };
    const valores = Object.entries(medidas || {}).map(([nombre, valor]) => {
        const nombreVisible = etiquetas[nombre] || nombre;
        return `${escaparHtml(nombreVisible)}: ${Number(valor).toFixed(1)} cm`;
    });
    return valores.length ? valores.join(", ") : "-";
}

function formatearFecha(fecha) {
    if (!fecha) return "-";
    const fechaObj = new Date(fecha + "T00:00:00");
    if (Number.isNaN(fechaObj.getTime())) return fecha;
    return fechaObj.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

async function guardarSeguimiento(e) {
    e.preventDefault();
    const msg = document.getElementById("seguimiento-msg");
    const fecha = document.getElementById("seguimiento-fecha").value;
    const peso = parseFloat(document.getElementById("seguimiento-peso").value);
    const medidas = Object.fromEntries(
        ["cintura", "cadera", "brazo"]
            .map((nombre) => [nombre, parseFloat(document.getElementById(`seguimiento-${nombre}`).value)])
            .filter(([, valor]) => Number.isFinite(valor) && valor > 0)
    );

    if (!usuarioActual) {
        msg.style.color = "#ff5252";
        msg.innerText = "Debes iniciar sesión para guardar registros.";
        return;
    }

    try {
        const respuesta = await fetch(`${API_URL}/seguimiento/${encodeURIComponent(usuarioActual)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fecha, peso, medidas })
        });
        const data = await leerRespuesta(respuesta, "No se pudo guardar el registro.");

        document.getElementById("form-seguimiento").reset();
        document.getElementById("seguimiento-progreso").innerText = data.progreso || "Sin registros aún.";
        actualizarSesion(data);
        await actualizarDashboard(data);
        msg.style.color = "#00e676";
        msg.innerText = data.mensaje;
        mostrarSeccion('seguimiento');
    } catch (error) {
        msg.style.color = "#ff5252";
        msg.innerText = error.message;
    }
}

function actualizarActividad() {
    if (inactivityTimer) {
        window.clearTimeout(inactivityTimer);
        inactivityTimer = null;
    }

    if (!localStorage.getItem(SESSION_KEY)) return;

    inactivityTimer = window.setTimeout(() => {
        if (localStorage.getItem(SESSION_KEY)) cerrarSesion(true);
    }, INACTIVITY_TIMEOUT);
}

function actualizarSesion(data) {
    const sesionGuardada = localStorage.getItem(SESSION_KEY);
    if (!sesionGuardada) return;

    try {
        const sesion = JSON.parse(sesionGuardada);
        localStorage.setItem(SESSION_KEY, JSON.stringify({ ...sesion, userData: data }));
    } catch (error) {
        localStorage.removeItem(SESSION_KEY);
    }
}

async function restaurarSesion() {
    const sesionGuardada = localStorage.getItem(SESSION_KEY);
    if (!sesionGuardada) return;

    try {
        const sesion = JSON.parse(sesionGuardada);
        if (!sesion.username || !sesion.userData) {
            localStorage.removeItem(SESSION_KEY);
            return;
        }

        usuarioActual = sesion.username;
        document.getElementById("auth-box").classList.add("hidden");
        document.getElementById("dashboard").classList.remove("hidden");
        document.getElementById("welcome-title").innerText = `Bienvenido, ${usuarioActual}`;
        await actualizarDashboard(sesion.userData);
        mostrarSeccion("inicio");
        actualizarActividad();
    } catch (error) {
        localStorage.removeItem(SESSION_KEY);
    }
}

document.addEventListener("mousemove", actualizarActividad, { passive: true });
document.addEventListener("keydown", actualizarActividad);
document.addEventListener("click", actualizarActividad);
document.addEventListener("scroll", actualizarActividad, { capture: true, passive: true });
document.addEventListener("touchstart", actualizarActividad, { passive: true });
document.addEventListener("DOMContentLoaded", async () => {
    inicializarSelectoresEstatura();
    await cargarMatrizNutricional();
    await restaurarPlantillaRutina();
    await restaurarSesion();
});

function cerrarSesion(expiradaPorInactividad = false) {
    if (inactivityTimer) {
        window.clearTimeout(inactivityTimer);
        inactivityTimer = null;
    }
    usuarioActual = "";
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.clear();
    document.getElementById("dashboard").classList.add("hidden");
    document.getElementById("auth-box").classList.remove("hidden");
    document.getElementById("form-login").reset();
    document.getElementById("form-seguimiento").reset();
    mostrarTab("login");
    if (expiradaPorInactividad) window.alert("Sesión expirada por inactividad");
}

async function actualizarObjetivoPlan(campo) {
    const selector = campo === "objetivo_nutricional"
        ? document.getElementById("nutrition-goal")
        : document.getElementById("training-goal");
    const mensaje = document.getElementById(campo === "objetivo_nutricional" ? "nutrition-msg" : "training-msg");

    if (!usuarioActual) return;

    try {
        mensaje.textContent = "Actualizando plan...";
        const respuesta = await fetch(`${API_URL}/perfil/${encodeURIComponent(usuarioActual)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ [campo]: selector.value })
        });
        const data = await leerRespuesta(respuesta, "No se pudo actualizar el objetivo.");
        actualizarSesion(data);
        await actualizarDashboard(data);
        mensaje.textContent = "Plan actualizado.";
    } catch (error) {
        mensaje.textContent = error.message;
        mensaje.style.color = "#ff5252";
    }
}