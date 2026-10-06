const API_URL = window.location.protocol === "file:"
    ? "http://127.0.0.1:8000/api"
    : "/api";
const SESSION_KEY = "sessionUser";
const ROUTINE_SETTINGS_KEY = "routineSettings";
const SIN_PREFERENCIA_MUSCULAR = "sin_preferencia";
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
let planNutricionalActivo = [];
let perfilNutricionalActual = null;

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

    const usuario = document.getElementById("login-user").value.trim();
    const contrasena = document.getElementById("login-pass").value.trim();
    const payload = { usuario, contrasena };

    try {
        const respuesta = await fetch(`${API_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
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

function normalizarListaAlimentosPreferidos(lista) {
    const entrada = Array.isArray(lista) ? lista : [];
    const vistos = new Set();
    const resultado = [];

    entrada.forEach((valor) => {
        const texto = String(valor || "").trim();
        if (!texto || vistos.has(texto.toLowerCase())) return;
        vistos.add(texto.toLowerCase());
        resultado.push(texto);
    });

    return resultado;
}

function obtenerPreferenciasNutricionales() {
    try {
        const guardadas = JSON.parse(localStorage.getItem("nutritionSettings") || "{}");
        return {
            goal: guardadas.goal || "maintenance",
            available_foods: normalizarListaAlimentosPreferidos(guardadas.available_foods || []),
            meal_frequency: Number(guardadas.meal_frequency || 4),
            weight: Number(guardadas.weight || perfilNutricionalActual?.peso || 0)
        };
    } catch (error) {
        localStorage.removeItem("nutritionSettings");
        return { goal: "maintenance", available_foods: [], meal_frequency: 4, weight: 0 };
    }
}

function renderizarChipsPreferencias(preferencias = []) {
    const contenedor = document.getElementById("nutrition-selected-foods");
    if (!contenedor) return;

    const lista = normalizarListaAlimentosPreferidos(preferencias);
    if (!lista.length) {
        const mensaje = document.createElement("p");
        mensaje.className = "nutrition-empty-state";
        mensaje.textContent = "No has agregado alimentos preferidos.";
        contenedor.replaceChildren(mensaje);
        return;
    }

    const chips = lista.map((alimento) => {
        const chip = document.createElement("span");
        chip.className = "nutrition-chip";

        const nombre = document.createElement("span");
        nombre.className = "nutrition-chip-name";
        nombre.textContent = alimento;

        const boton = document.createElement("button");
        boton.type = "button";
        boton.dataset.food = alimento;
        boton.setAttribute("aria-label", `Eliminar ${alimento}`);
        boton.textContent = "×";
        boton.addEventListener("click", () => eliminarPreferenciaAlimento(boton.dataset.food));

        chip.append(nombre, boton);
        return chip;
    });
    contenedor.replaceChildren(...chips);
}

function sincronizarPreferenciasAlimentos(preferencias = []) {
    const lista = normalizarListaAlimentosPreferidos(preferencias);
    const hidden = document.getElementById("nutrition-foods");
    const fuente = document.getElementById("nutrition-food-choice");
    if (hidden) {
        hidden.replaceChildren(...[...new Set(lista)].map((opcion) => new Option(opcion, opcion)));
        [...hidden.options].forEach((option) => {
            option.selected = lista.includes(option.value);
        });
    }
    if (fuente) {
        fuente.value = fuente.options[0]?.value || "";
    }
    renderizarChipsPreferencias(lista);
    return lista;
}

function agregarPreferenciaAlimento() {
    const selector = document.getElementById("nutrition-food-choice");
    const hidden = document.getElementById("nutrition-foods");
    if (!selector || !hidden) return;

    const valor = String(selector.value || "").trim();
    if (!valor) return;

    const listaActual = normalizarListaAlimentosPreferidos([...hidden.options].map((opcion) => opcion.value));
    const siguiente = normalizarListaAlimentosPreferidos([...listaActual, valor]);
    sincronizarPreferenciasAlimentos(siguiente);
    selector.value = selector.options[0]?.value || "";
}

function eliminarPreferenciaAlimento(alimento) {
    const hidden = document.getElementById("nutrition-foods");
    if (!hidden) return;

    const listaActual = normalizarListaAlimentosPreferidos([...hidden.options].map((opcion) => opcion.value))
        .filter((valor) => valor.toLowerCase() !== String(alimento || "").trim().toLowerCase());
    sincronizarPreferenciasAlimentos(listaActual);
}

function restaurarEstadoNutricional(perfil = perfilNutricionalActual) {
    const preferencias = obtenerPreferenciasNutricionales();
    const selectorObjetivo = document.getElementById("nutrition-goal");
    const selectorComidas = document.getElementById("nutrition-meal-frequency");
    const selectorPeso = document.getElementById("nutrition-weight");

    if (selectorObjetivo) {
        const objetivoGuardado = preferencias.goal || normalizarObjetivoNutricional(perfil?.objetivo_nutricional || perfil?.objetivo || "Mantenimiento");
        selectorObjetivo.value = objetivoGuardado;
    }
    if (selectorComidas) {
        selectorComidas.value = String(preferencias.meal_frequency || 4);
    }
    if (selectorPeso) {
        selectorPeso.value = Number(preferencias.weight || perfil?.peso || 0) ? Number(preferencias.weight || perfil?.peso || 0).toFixed(1) : "";
    }
    sincronizarPreferenciasAlimentos(preferencias.available_foods?.length ? preferencias.available_foods : (perfil?.preferencias_nutricionales || []));
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

    const selectorDia = document.getElementById("nutrition-day");
    const dia = planNutricionalActivo.find((item, indice) => Number(item.dia_numero ?? indice + 1) === Number(selectorDia.value));
    if (!dia) return;
    localStorage.setItem("nutritionSelectedDay", selectorDia.value);
    contenedor.innerHTML = renderizarTarjetaDiaAlimenticio(dia);
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
                    ${comida.imagen ? `<img src="${escaparHtml(comida.imagen)}" alt="${escaparHtml(comida.plato || comida.comida)}" loading="lazy" decoding="async" onerror="this.style.display='none'">` : ""}
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

function normalizarObjetivoNutricional(valor) {
    const objetivo = String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (objetivo.includes("deficit") || objetivo.includes("grasa")) return "deficit";
    if (objetivo.includes("superavit") || objetivo.includes("musculo") || objetivo.includes("ganar")) return "surplus";
    return "maintenance";
}

async function actualizarPlanNutricional(perfil = perfilNutricionalActual) {
    if (!perfil) return;

    const mensaje = document.getElementById("nutrition-msg");
    const selectorObjetivo = document.getElementById("nutrition-goal");
    const selectorPeso = document.getElementById("nutrition-weight");
    const selectorAlimentos = document.getElementById("nutrition-foods");
    const objetivo = selectorObjetivo.value;
    const alimentos = normalizarListaAlimentosPreferidos([...selectorAlimentos.options].map((opcion) => opcion.value));
    const frecuencia = Number(document.getElementById("nutrition-meal-frequency").value);
    const pesoActual = Number(selectorPeso.value || perfil.peso || 0);
    const preferencias = { goal: objetivo, available_foods: alimentos, meal_frequency: frecuencia, weight: pesoActual };
    localStorage.setItem("nutritionSettings", JSON.stringify(preferencias));

    try {
        mensaje.textContent = "Generando plan...";
        mensaje.style.color = "";
        const respuesta = await fetch(`${API_URL}/nutricion/plan`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                weight: Number(pesoActual || perfil.peso),
                height: Number(perfil.estatura),
                age: Number(perfil.edad),
                gender: perfil.sexo,
                goal: objetivo,
                available_foods: alimentos,
                preferences: alimentos,
                meal_frequency: frecuencia
            })
        });
        const plan = await leerRespuesta(respuesta, "No se pudo generar el plan nutricional.");
        document.getElementById("res-imc").innerText = plan.imc;
        document.getElementById("res-peso-actual").innerText = `${Number(pesoActual || perfil.peso || 0).toFixed(1)} kg`;
        document.getElementById("res-tmb").innerText = `${plan.tmb} kcal`;
        document.getElementById("res-tdee").innerText = `${plan.tdee} kcal`;
        document.getElementById("res-calorias").innerText = `${plan.target_calories} kcal`;
        document.getElementById("res-proteinas").innerText = `${plan.proteinas} g`;
        document.getElementById("res-carbos").innerText = `${plan.carbos} g`;
        document.getElementById("res-grasas").innerText = `${plan.grasas} g`;
        document.getElementById("res-explicacion").innerText = plan.explicacion_nutricional;
        const distribucion = plan.distribucion_macros || {};
        document.getElementById("res-distribucion").innerText =
            `Distribución orientativa: ${distribucion.carbohidratos ?? "-"}% carbohidratos, ${distribucion.proteinas ?? "-"}% proteína y ${distribucion.grasas ?? "-"}% grasas.`;
        document.getElementById("home-imc").innerText = plan.imc;
        document.getElementById("home-calorias").innerText = `${plan.target_calories} kcal`;
        document.getElementById("home-objetivo").innerText = selectorObjetivo.selectedOptions[0].textContent;
        renderizarPlanAlimenticio(plan.menu_alimenticio || []);
        document.getElementById("nutrition-warnings").textContent = "";
        mensaje.textContent = "Plan actualizado.";
    } catch (error) {
        mensaje.style.color = "#ff5252";
        mensaje.textContent = error.message;
        document.getElementById("nutrition-warnings").textContent = error.message;
    }
}

async function aplicarCambiosNutricionales() {
    if (!usuarioActual || !perfilNutricionalActual) {
        const mensaje = document.getElementById("nutrition-msg");
        mensaje.style.color = "#ff5252";
        mensaje.textContent = "Inicia sesión para aplicar cambios.";
        return;
    }

    const mensaje = document.getElementById("nutrition-msg");
    const selectorObjetivo = document.getElementById("nutrition-goal");
    const selectorComidas = document.getElementById("nutrition-meal-frequency");
    const selectorPeso = document.getElementById("nutrition-weight");
    const selectorAlimentos = document.getElementById("nutrition-foods");
    const objetivo = selectorObjetivo.value;
    const alimentos = normalizarListaAlimentosPreferidos([...selectorAlimentos.options].map((opcion) => opcion.value));
    const frecuencia = Number(selectorComidas.value || 4);
    const pesoActual = Number(selectorPeso.value || perfilNutricionalActual.peso || 0);
    const objetivoBackend = {
        deficit: "Perder Grasa (Déficit)",
        maintenance: "Mantenimiento",
        surplus: "Ganar Peso/Músculo (Superávit)"
    }[objetivo] || "Mantenimiento";

    try {
        mensaje.textContent = "Guardando cambios...";
        mensaje.style.color = "";

        const actualizacionesPerfil = {};
        if (Number(perfilNutricionalActual.peso || 0) !== pesoActual) {
            actualizacionesPerfil.peso = pesoActual;
        }
        if ((perfilNutricionalActual.objetivo_nutricional || perfilNutricionalActual.objetivo) !== objetivoBackend) {
            actualizacionesPerfil.objetivo_nutricional = objetivoBackend;
        }

        if (Object.keys(actualizacionesPerfil).length) {
            const respuestaPerfil = await fetch(`${API_URL}/perfil/${encodeURIComponent(usuarioActual)}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(actualizacionesPerfil)
            });
            const perfilActualizado = await leerRespuesta(respuestaPerfil, "No se pudo guardar el perfil.");
            perfilNutricionalActual = { ...perfilNutricionalActual, ...perfilActualizado };
            actualizarSesion(perfilActualizado);
        }

        const preferencias = {
            goal: objetivo,
            available_foods: alimentos,
            meal_frequency: frecuencia,
            weight: pesoActual
        };
        localStorage.setItem("nutritionSettings", JSON.stringify(preferencias));

        const respuestaPlan = await fetch(`${API_URL}/nutricion/plan`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                weight: pesoActual,
                height: Number(perfilNutricionalActual.estatura || 1.7),
                age: Number(perfilNutricionalActual.edad || 30),
                gender: perfilNutricionalActual.sexo || "masculino",
                goal: objetivo,
                available_foods: alimentos,
                preferences: alimentos,
                meal_frequency: frecuencia
            })
        });
        const plan = await leerRespuesta(respuestaPlan, "No se pudo generar el plan nutricional.");
        document.getElementById("res-imc").innerText = plan.imc;
        document.getElementById("res-peso-actual").innerText = `${pesoActual.toFixed(1)} kg`;
        document.getElementById("res-tmb").innerText = `${plan.tmb} kcal`;
        document.getElementById("res-tdee").innerText = `${plan.tdee} kcal`;
        document.getElementById("res-calorias").innerText = `${plan.target_calories} kcal`;
        document.getElementById("res-proteinas").innerText = `${plan.proteinas} g`;
        document.getElementById("res-carbos").innerText = `${plan.carbos} g`;
        document.getElementById("res-grasas").innerText = `${plan.grasas} g`;
        document.getElementById("res-explicacion").innerText = plan.explicacion_nutricional;
        document.getElementById("home-imc").innerText = plan.imc;
        document.getElementById("home-calorias").innerText = `${plan.target_calories} kcal`;
        document.getElementById("home-objetivo").innerText = selectorObjetivo.selectedOptions[0].textContent;
        renderizarPlanAlimenticio(plan.menu_alimenticio || []);
        document.getElementById("nutrition-warnings").textContent = "";
        mensaje.style.color = "#00e676";
        mensaje.textContent = "Cambios aplicados correctamente.";
    } catch (error) {
        mensaje.style.color = "#ff5252";
        mensaje.textContent = error.message || "No fue posible guardar los cambios. Inténtalo nuevamente.";
        document.getElementById("nutrition-warnings").textContent = error.message || "No fue posible guardar los cambios.";
    }
}

function cancelarCambiosNutricionales() {
    const mensaje = document.getElementById("nutrition-msg");
    restaurarEstadoNutricional(perfilNutricionalActual);
    mensaje.style.color = "";
    mensaje.textContent = "Cambios cancelados.";
    if (perfilNutricionalActual) {
        actualizarPlanNutricional(perfilNutricionalActual);
    }
}

async function actualizarDashboard(data) {
    perfilNutricionalActual = data;

    document.getElementById("res-imc").innerText = data.imc;
    document.getElementById("res-peso-actual").innerText = `${Number(data.peso || 0).toFixed(1)} kg`;
    document.getElementById("res-tmb").innerText = `${data.tmb} kcal`;
    document.getElementById("res-tdee").innerText = `${data.tdee} kcal`;
    document.getElementById("res-calorias").innerText = `${data.calorias} kcal`;
    document.getElementById("res-proteinas").innerText = `${data.proteinas} g`;
    document.getElementById("res-carbos").innerText = `${data.carbos} g`;
    document.getElementById("res-grasas").innerText = `${data.grasas} g`;
    let preferenciasNutricionales = {};
    try {
        preferenciasNutricionales = JSON.parse(localStorage.getItem("nutritionSettings") || "{}");
    } catch (error) {
        localStorage.removeItem("nutritionSettings");
    }
    const selectorObjetivo = document.getElementById("nutrition-goal");
    selectorObjetivo.value = preferenciasNutricionales.goal || normalizarObjetivoNutricional(data.objetivo_nutricional || data.objetivo || "Mantenimiento");
    document.getElementById("nutrition-meal-frequency").value = String(preferenciasNutricionales.meal_frequency || 4);
    document.getElementById("nutrition-weight").value = Number(preferenciasNutricionales.weight || data.peso || 0).toFixed(1);

    const hiddenFoods = document.getElementById("nutrition-foods");
    const foodsSelected = new Set(normalizarListaAlimentosPreferidos(preferenciasNutricionales.available_foods || []));
    hiddenFoods.replaceChildren(...[...foodsSelected].map((opcion) => new Option(opcion, opcion)));
    [...hiddenFoods.options].forEach((opcion) => {
        opcion.selected = foodsSelected.has(opcion.value);
    });
    renderizarChipsPreferencias([...foodsSelected]);
    document.getElementById("training-goal").value = data.objetivo_entrenamiento || "Hipertrofia (Masa)";
    document.getElementById("res-explicacion").innerText = data.explicacion_nutricional;
    const distribucion = data.distribucion_macros || {};
    document.getElementById("res-distribucion").innerText =
        `Distribución orientativa: ${distribucion.carbohidratos ?? "-"}% carbohidratos, ${distribucion.proteinas ?? "-"}% proteína y ${distribucion.grasas ?? "-"}% grasas.`;
    renderizarPlanAlimenticio([]);
    document.getElementById("home-imc").innerText = data.imc;
    document.getElementById("home-calorias").innerText = `${data.calorias} kcal`;
    document.getElementById("home-objetivo").innerText = data.objetivo_nutricional || "-";
    actualizarEncabezadoRutina(data.objetivo_entrenamiento);
    mostrarPerfil(data);
    renderizarRutina(data.rutina);
    await actualizarPlanNutricional(data);
    await cargarSeguimiento();
    return data;
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

function normalizarDiasRutina(valor) {
    const elecciones = [2, 3, 4, 5, 6];
    const numerico = Number(valor);
    return elecciones.includes(numerico) ? numerico : 4;
}

function obtenerConfiguracionRutina() {
    const predeterminada = {
        objetivo_entrenamiento: "Hipertrofia (Masa)",
        dias_entrenamiento: 4,
        musculo_prioritario: "Pecho",
        intensidad_semanal: "media"
    };

    try {
        const guardada = JSON.parse(localStorage.getItem(ROUTINE_SETTINGS_KEY) || "{}");
        return {
            ...predeterminada,
            ...guardada,
            dias_entrenamiento: normalizarDiasRutina(guardada.dias_entrenamiento ?? predeterminada.dias_entrenamiento),
            objetivo_entrenamiento: guardada.objetivo_entrenamiento || predeterminada.objetivo_entrenamiento,
            musculo_prioritario: guardada.musculo_prioritario || predeterminada.musculo_prioritario,
            intensidad_semanal: guardada.intensidad_semanal || predeterminada.intensidad_semanal
        };
    } catch (error) {
        localStorage.removeItem(ROUTINE_SETTINGS_KEY);
        return { ...predeterminada };
    }
}

function guardarConfiguracionRutina(config = {}) {
    const actual = obtenerConfiguracionRutina();
    const siguiente = {
        ...actual,
        ...config,
        dias_entrenamiento: normalizarDiasRutina(config.dias_entrenamiento ?? actual.dias_entrenamiento),
        objetivo_entrenamiento: config.objetivo_entrenamiento || actual.objetivo_entrenamiento,
        musculo_prioritario: config.musculo_prioritario || actual.musculo_prioritario,
        intensidad_semanal: config.intensidad_semanal || actual.intensidad_semanal
    };
    localStorage.setItem(ROUTINE_SETTINGS_KEY, JSON.stringify(siguiente));
    return siguiente;
}

function sincronizarConfiguracionRutina(perfil = perfilNutricionalActual) {
    const config = obtenerConfiguracionRutina();
    const objetivo = config.objetivo_entrenamiento || perfil?.objetivo_entrenamiento || "Hipertrofia (Masa)";
    const dias = normalizarDiasRutina(config.dias_entrenamiento ?? perfil?.dias_entrenamiento ?? 4);
    const prioridad = config.musculo_prioritario || "Pecho";
    const intensidad = config.intensidad_semanal || "media";

    const selectorObjetivo = document.getElementById("training-goal");
    const selectorDias = document.getElementById("routine-days");
    const selectorPrioridad = document.getElementById("routine-muscle-priority");
    const selectorIntensidad = document.getElementById("routine-intensity");

    if (selectorObjetivo) selectorObjetivo.value = objetivo;
    if (selectorDias) selectorDias.value = String(dias);
    if (selectorPrioridad) selectorPrioridad.value = prioridad;
    if (selectorIntensidad) selectorIntensidad.value = intensidad;
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

function normalizarNombreMusculo(valor) {
    return String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function obtenerEnfoqueDia(diaNumero, diasTotales, musculoPrioritario) {
    const patrones = {
        2: ["Empuje + prioridad", "Piernas + recuperación"],
        3: ["Superior + prioridad", "Inferior + fuerza", "Cuerpo total + estabilización"],
        4: ["Empuje + pecho", "Tracción + espalda", "Piernas + glúteos", "Hombros + core"],
        5: ["Empuje + prioridad", "Tracción + espalda", "Piernas + fuerza", "Hombros + estabilización", "Core + recuperación"],
        6: ["Empuje + prioridad", "Tracción + espalda", "Piernas + fuerza", "Hombros + estabilidad", "Empuje + brazos", "Recuperación + core"]
    };
    const mapa = patrones[diasTotales] || patrones[4];
    const base = mapa[(diaNumero - 1) % mapa.length] || "Entrenamiento funcional";
    return `${base} · ${musculoPrioritario}`;
}

function ordenarEjerciciosPorPrioridad(ejercicios, musculoPrioritario) {
    if (musculoPrioritario === SIN_PREFERENCIA_MUSCULAR) return ejercicios;

    const prioridadMap = {
        Pecho: ["pecho", "triceps", "hombros", "core"],
        Espalda: ["espalda", "biceps", "core", "hombros"],
        Hombros: ["hombros", "pecho", "triceps", "core"],
        Bíceps: ["biceps", "espalda", "core"],
        Tríceps: ["triceps", "pecho", "hombros"],
        Cuádriceps: ["cuadriceps", "gluteos", "core"],
        Isquiotibiales: ["isquiotibiales", "gluteos", "core"],
        Glúteos: ["gluteos", "cuadriceps", "core"],
        Pantorrillas: ["pantorrillas", "gemelos", "gluteos"],
        "Core/Abdomen": ["core", "abdomen", "gluteos", "espalda"]
    };

    const orden = prioridadMap[musculoPrioritario] || ["core", "pecho", "espalda"];
    return [...ejercicios].sort((a, b) => {
        const grupoA = (a.grupo_muscular || []).map((grupo) => normalizarNombreMusculo(grupo)).join(" ");
        const grupoB = (b.grupo_muscular || []).map((grupo) => normalizarNombreMusculo(grupo)).join(" ");
        const prioridadA = orden.findIndex((valor) => grupoA.includes(valor));
        const prioridadB = orden.findIndex((valor) => grupoB.includes(valor));
        const valorA = prioridadA >= 0 ? prioridadA : orden.length;
        const valorB = prioridadB >= 0 ? prioridadB : orden.length;
        return valorA - valorB;
    });
}

function construirDiasRutinaVisibles(plantilla, diasSeleccionados, musculoPrioritario) {
    if (!plantilla || !Array.isArray(plantilla.semanas) || !plantilla.semanas.length) return [];

    const semana = plantilla.semanas[0];
    const baseDias = Array.isArray(semana.dias) ? semana.dias : [];
    if (!baseDias.length) return [];

    const totalBase = baseDias.length;
    return Array.from({ length: diasSeleccionados }, (_, indice) => {
        const diaBase = baseDias[indice % totalBase];
        const diaNumero = indice + 1;
        const sinPreferencia = musculoPrioritario === SIN_PREFERENCIA_MUSCULAR;
        const enfoque = sinPreferencia
            ? (diaBase.enfoque || diaBase.rutina || "Entrenamiento equilibrado")
            : obtenerEnfoqueDia(diaNumero, diasSeleccionados, musculoPrioritario);
        return {
            dia: diaNumero,
            rutina: enfoque,
            enfoque,
            ejercicios: ordenarEjerciciosPorPrioridad((diaBase.ejercicios || []).map((ejercicio) => ({ ...ejercicio })), musculoPrioritario)
        };
    });
}

function cargarPlantillaRutina() {
    const mensaje = document.getElementById("routine-template-msg") || document.getElementById("training-msg");
    const areaJson = document.getElementById("routine-template-json");

    if (!areaJson) {
        if (mensaje) {
            mensaje.textContent = "La plantilla del sistema ya está integrada y no se carga desde JSON en la interfaz.";
            mensaje.style.color = "";
        }
        return;
    }

    try {
        const texto = areaJson.value;
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
        if (mensaje) {
            mensaje.style.color = "#00e676";
            mensaje.textContent = `Plantilla ${plantilla.plantilla_id} cargada.`;
        }
    } catch (error) {
        if (mensaje) {
            mensaje.style.color = "#ff5252";
            mensaje.textContent = error.message || "No se pudo cargar la plantilla JSON.";
        }
    }
}

function actualizarDiasRutina() {
    const semanas = document.getElementById("routine-week");
    const dias = document.getElementById("routine-day");
    if (!plantillaRutinaActiva) return;

    const config = obtenerConfiguracionRutina();
    const totalDias = normalizarDiasRutina(config.dias_entrenamiento || document.getElementById("routine-days")?.value || 4);
    const semana = plantillaRutinaActiva.semanas.find((item) => item.semana === Number(semanas.value));
    if (!semana) return;

    const planDias = construirDiasRutinaVisibles(plantillaRutinaActiva, totalDias, config.musculo_prioritario || "Pecho");
    dias.replaceChildren(...planDias.map((dia) => new Option(`Día ${dia.dia} · ${dia.rutina}`, dia.dia)));
    dias.disabled = false;
    const valorActual = Number(dias.value || 1);
    dias.value = String(Math.min(valorActual, planDias.length) || 1);
}

function cambiarSemanaRutina() {
    actualizarDiasRutina();
    actualizarVistaRutina();
}

function actualizarVistaRutina() {
    if (!plantillaRutinaActiva) return;

    const config = obtenerConfiguracionRutina();
    const semana = Number(document.getElementById("routine-week").value);
    const dia = Number(document.getElementById("routine-day").value || 1);
    const diasTotales = normalizarDiasRutina(document.getElementById("routine-days")?.value || config.dias_entrenamiento || 4);
    const resumenFase = document.getElementById("routine-phase-summary");

    try {
        const planDias = construirDiasRutinaVisibles(plantillaRutinaActiva, diasTotales, config.musculo_prioritario || "Pecho");
        const diaSeleccionado = planDias.find((item) => item.dia === dia) || planDias[0];
        const desglose = window.RutinaEngine.generarDesglose(plantillaRutinaActiva, semana, Math.min(dia, plantillaRutinaActiva.semanas[0].dias.length));
        const fase = desglose.instruccion_fase;
        const intensidadLabel = {
            base: "Base",
            media: "Media",
            alta: "Alta"
        }[config.intensidad_semanal || "media"] || "Media";

        resumenFase.innerHTML = `
            <strong>Semana ${desglose.semana}: ${escaparHtml(fase.fase)}</strong>
            <p>${escaparHtml(fase.objetivo)}</p>
            <p>RIR objetivo: ${escaparHtml(fase.RIR_objetivo)} · Volumen: ${escaparHtml(fase.volumen)}</p>
            ${fase.criterio ? `<p>${escaparHtml(fase.criterio)}</p>` : ""}
            <p>${escaparHtml(desglose.reglas_de_progresion[`semana_${desglose.semana}`])}</p>
            <p>${escaparHtml(desglose.criterios_generales.regla_de_progresion)}</p>
            <p>${escaparHtml(desglose.criterios_generales.calentamiento.descripcion)}</p>
            <p><strong>Intensidad semanal:</strong> ${escaparHtml(intensidadLabel)}</p>
        `;
        resumenFase.classList.remove("hidden");

        document.getElementById("routine-goal-title").innerText = `${config.objetivo_entrenamiento || "Hipertrofia (Masa)"} · ${diaSeleccionado.rutina}`;
        const mensajePrioridad = config.musculo_prioritario === SIN_PREFERENCIA_MUSCULAR
            ? "Distribución normal"
            : `${config.musculo_prioritario || "Pecho"} como prioridad`;
        document.getElementById("routine-goal-message").innerText = `${mensajePrioridad} · ${intensidadLabel} · Semana ${semana}`;

        document.getElementById("routine-container").innerHTML = diaSeleccionado.ejercicios.map((ejercicio, indice) => {
            const nombre = ejercicio.nombre || "Ejercicio";
            const grupos = Array.isArray(ejercicio.grupo_muscular) ? ejercicio.grupo_muscular.join(" · ") : "General";
            const imagen = ejercicio.imagen || IMAGENES_EJERCICIOS[nombre] || "";
            const detalleRir = ejercicio.RIR_objetivo ?? ejercicio.RIR ?? "-";
            return `
                <article class="day-plan template-day-plan">
                    <div class="exercise-card">
                        <div class="exercise-visual" aria-label="${escaparHtml(nombre)}">
                            ${imagen ? `<img src="${escaparHtml(imagen)}" alt="${escaparHtml(nombre)}" loading="lazy" onerror="this.style.display='none'; this.parentElement.querySelector('.exercise-fallback').classList.remove('hidden')">` : ""}
                            <div class="exercise-fallback ${imagen ? "hidden" : ""}" aria-hidden="true">
                                <svg viewBox="0 0 64 64" role="img" focusable="false">
                                    <path d="M16 26v12M11 29v6M21 22v20M43 22v20M48 26v12M53 29v6M21 32h22" />
                                </svg>
                            </div>
                        </div>
                        <div class="exercise-meta">
                            <h4>${indice + 1}. ${escaparHtml(nombre)}</h4>
                            <p class="exercise-focus">${escaparHtml(grupos)}</p>
                            <p class="series">${escaparHtml(ejercicio.series)} × ${escaparHtml(ejercicio.repeticiones)}</p>
                            <div class="exercise-detail-row">
                                <span>Tempo ${escaparHtml(ejercicio.tempo)}</span>
                                <span>Descanso ${escaparHtml(ejercicio.descanso_seg)} s</span>
                                <span>RIR ${escaparHtml(detalleRir)}</span>
                            </div>
                            <p class="exercise-instructions">${escaparHtml(ejercicio.tecnica || "Mantén una postura estable y controla cada repetición.")}</p>
                            ${ejercicio.alerta_seguridad ? `<p class="routine-safety-alert" role="alert">${escaparHtml(ejercicio.alerta_seguridad.mensaje)}</p>` : ""}
                        </div>
                    </div>
                </article>
            `;
        }).join("");
    } catch (error) {
        resumenFase.innerHTML = "";
        resumenFase.classList.add("hidden");
        document.getElementById("routine-goal-title").innerText = "Objetivo: -";
        document.getElementById("routine-goal-message").innerText = "No fue posible actualizar tu rutina. Intenta nuevamente.";
        document.getElementById("routine-container").innerHTML = "";
        document.getElementById("training-msg").textContent = error.message || "No fue posible actualizar la rutina.";
        document.getElementById("training-msg").style.color = "#ff5252";
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
        const selectorSemana = document.getElementById("routine-week");
        selectorSemana.replaceChildren(...plantillaRutinaActiva.semanas.map((semana) => new Option(`Semana ${semana.semana}`, semana.semana)));
        selectorSemana.disabled = false;
        selectorSemana.value = String(plantillaRutinaActiva.semanas[0].semana);
        sincronizarConfiguracionRutina(perfilNutricionalActual || { objetivo_entrenamiento: "Hipertrofia (Masa)", dias_entrenamiento: 4 });
        actualizarDiasRutina();
        actualizarVistaRutina();
    } catch (error) {
        plantillaRutinaActiva = null;
        const mensaje = document.getElementById("training-msg");
        mensaje.style.color = "#ff5252";
        mensaje.textContent = error.message || "No se pudo cargar la rutina del sistema.";
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

    const botonAgregarAlimento = document.getElementById("nutrition-add-food");
    const botonAplicarCambios = document.getElementById("nutrition-apply-btn");
    const botonCancelarCambios = document.getElementById("nutrition-cancel-btn");
    const selectorObjetivo = document.getElementById("nutrition-goal");
    const selectorComidas = document.getElementById("nutrition-meal-frequency");
    const selectorPeso = document.getElementById("nutrition-weight");
    const selectorObjetivoRutina = document.getElementById("training-goal");
    const selectorDiasRutina = document.getElementById("routine-days");
    const selectorPrioridadRutina = document.getElementById("routine-muscle-priority");
    const selectorIntensidadRutina = document.getElementById("routine-intensity");
    const botonAplicarRutina = document.getElementById("routine-apply-btn");
    const botonCancelarRutina = document.getElementById("routine-cancel-btn");

    botonAgregarAlimento?.addEventListener("click", agregarPreferenciaAlimento);
    botonAplicarCambios?.addEventListener("click", aplicarCambiosNutricionales);
    botonCancelarCambios?.addEventListener("click", cancelarCambiosNutricionales);
    selectorObjetivo?.addEventListener("change", () => {
        const mensaje = document.getElementById("nutrition-msg");
        mensaje.textContent = "Cambios pendientes.";
        mensaje.style.color = "";
    });
    selectorComidas?.addEventListener("change", () => {
        const mensaje = document.getElementById("nutrition-msg");
        mensaje.textContent = "Cambios pendientes.";
        mensaje.style.color = "";
    });
    selectorPeso?.addEventListener("input", () => {
        const mensaje = document.getElementById("nutrition-msg");
        mensaje.textContent = "Cambios pendientes.";
        mensaje.style.color = "";
    });

    selectorObjetivoRutina?.addEventListener("change", () => {
        guardarConfiguracionRutina({ objetivo_entrenamiento: selectorObjetivoRutina.value });
        actualizarVistaRutina();
    });
    selectorDiasRutina?.addEventListener("change", () => {
        guardarConfiguracionRutina({ dias_entrenamiento: Number(selectorDiasRutina.value) });
        actualizarDiasRutina();
        actualizarVistaRutina();
    });
    selectorPrioridadRutina?.addEventListener("change", () => {
        guardarConfiguracionRutina({ musculo_prioritario: selectorPrioridadRutina.value });
        actualizarDiasRutina();
        actualizarVistaRutina();
    });
    selectorIntensidadRutina?.addEventListener("change", () => {
        guardarConfiguracionRutina({ intensidad_semanal: selectorIntensidadRutina.value });
        actualizarVistaRutina();
    });
    botonAplicarRutina?.addEventListener("click", aplicarCambiosRutina);
    botonCancelarRutina?.addEventListener("click", cancelarCambiosRutina);

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

async function aplicarCambiosRutina() {
    const selector = document.getElementById("training-goal");
    const selectorDias = document.getElementById("routine-days");
    const selectorPrioridad = document.getElementById("routine-muscle-priority");
    const selectorIntensidad = document.getElementById("routine-intensity");
    const mensaje = document.getElementById("training-msg");

    if (!usuarioActual) {
        mensaje.textContent = "Debes iniciar sesión para guardar los cambios.";
        mensaje.style.color = "#ff5252";
        return;
    }

    const siguiente = {
        objetivo_entrenamiento: selector.value,
        dias_entrenamiento: Number(selectorDias.value || 4),
        musculo_prioritario: selectorPrioridad.value,
        intensidad_semanal: selectorIntensidad.value
    };

    try {
        mensaje.textContent = "Guardando cambios...";
        mensaje.style.color = "";
        guardarConfiguracionRutina(siguiente);

        const respuesta = await fetch(`${API_URL}/perfil/${encodeURIComponent(usuarioActual)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                objetivo_entrenamiento: siguiente.objetivo_entrenamiento,
                dias_entrenamiento: siguiente.dias_entrenamiento
            })
        });
        const data = await leerRespuesta(respuesta, "No se pudo actualizar la rutina.");
        actualizarSesion(data);
        perfilNutricionalActual = { ...perfilNutricionalActual, ...data };
        sincronizarConfiguracionRutina(perfilNutricionalActual);
        actualizarDiasRutina();
        actualizarVistaRutina();
        mensaje.textContent = "✓ Cambios aplicados correctamente.";
        mensaje.style.color = "#00e676";
    } catch (error) {
        mensaje.textContent = error.message || "No fue posible actualizar tu rutina. Intenta nuevamente.";
        mensaje.style.color = "#ff5252";
        console.error("Error al guardar la rutina:", error);
    }
}

function cancelarCambiosRutina() {
    const mensaje = document.getElementById("training-msg");
    const config = obtenerConfiguracionRutina();
    sincronizarConfiguracionRutina({ ...perfilNutricionalActual, ...config });
    actualizarDiasRutina();
    actualizarVistaRutina();
    mensaje.textContent = "Cambios cancelados.";
    mensaje.style.color = "";
}

async function actualizarObjetivoPlan() {
    await aplicarCambiosRutina();
}