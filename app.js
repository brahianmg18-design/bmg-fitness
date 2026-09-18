const API_URL = window.location.protocol === "file:"
    ? "http://127.0.0.1:8000/api"
    : "/api";
const SESSION_KEY = "sessionUser";
const SESSION_TIMEOUT = 180000;
const IMAGENES_EJERCICIOS = {
    "Sentadilla con barra": "https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=900&q=85",
    "Peso muerto rumano": "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=900&q=85",
    "Prensa de pierna": "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=900&q=85",
    "Extensión de cuádriceps": "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=900&q=85",
    "Elevación de gemelos": "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=900&q=85"
};
let usuarioActual = "";
let contrasenaActual = "";

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

function mostrarTab(tab) {
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
    const objetivo = document.getElementById("reg-objetivo").value;

    alertMsg.style.color = "#00e676";
    alertMsg.innerText = "Procesando registro...";

    try {
        const respuesta = await fetch(`${API_URL}/registro`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usuario, contrasena, email, edad, sexo, peso, estatura, actividad, objetivo })
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
            contrasenaActual = contrasena;
            localStorage.setItem(SESSION_KEY, JSON.stringify({
                username: usuarioActual,
                loginTime: Date.now(),
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

async function actualizarDashboard(data) {
    document.getElementById("res-imc").innerText = data.imc;
    document.getElementById("res-calorias").innerText = `${data.calorias} kcal`;
    document.getElementById("res-proteinas").innerText = `${data.proteinas} g`;
    document.getElementById("res-carbos").innerText = `${data.carbos} g`;
    document.getElementById("res-grasas").innerText = `${data.grasas} g`;
    document.getElementById("res-explicacion").innerText = data.explicacion_nutricional;
    document.getElementById("home-imc").innerText = data.imc;
    document.getElementById("home-calorias").innerText = `${data.calorias} kcal`;
    document.getElementById("home-objetivo").innerText = data.objetivo;
    mostrarPerfil(data);
    renderizarRutina(data.rutina);
    await cargarSeguimiento();
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

function mostrarPerfil(perfil) {
    document.getElementById("profile-email").value = perfil.email || "";
    document.getElementById("profile-edad").value = perfil.edad ?? "";
    document.getElementById("profile-sexo").value = perfil.sexo || "masculino";
    document.getElementById("profile-peso").value = perfil.peso ?? "";
    document.getElementById("profile-estatura").value = perfil.estatura ?? "";
    document.getElementById("profile-actividad").value = perfil.actividad ?? 1.55;
    document.getElementById("profile-objetivo").value = perfil.objetivo || "Ganar masa muscular";
    document.getElementById("profile-dias").value = perfil.dias_entrenamiento ?? 4;
    document.getElementById("current-edad").innerText = `${perfil.edad ?? "-"} años`;
    document.getElementById("current-sexo").innerText = perfil.sexo || "-";
    document.getElementById("current-peso").innerText = `${perfil.peso ?? "-"} kg`;
    document.getElementById("current-estatura").innerText = `${perfil.estatura ?? "-"} m`;
    document.getElementById("current-actividad").innerText = nombreActividad(perfil.actividad);
    document.getElementById("current-objetivo").innerText = perfil.objetivo || "-";
    document.getElementById("current-dias").innerText = `${perfil.dias_entrenamiento ?? "-"} días`;
    document.getElementById("current-email").innerText = perfil.email || "-";
}

function nombreActividad(valor) {
    const actividades = { "1.2": "Sedentario", "1.375": "Ligero", "1.55": "Moderado", "1.725": "Intenso" };
    return actividades[String(valor)] || `${valor} factor`;
}

async function guardarPerfil(e) {
    e.preventDefault();
    const profileMsg = document.getElementById("profile-msg");
    const datos = {
        edad: parseInt(document.getElementById("profile-edad").value),
        sexo: document.getElementById("profile-sexo").value,
        peso: parseFloat(document.getElementById("profile-peso").value),
        estatura: parseFloat(document.getElementById("profile-estatura").value),
        actividad: parseFloat(document.getElementById("profile-actividad").value),
        objetivo: document.getElementById("profile-objetivo").value,
        dias_entrenamiento: parseInt(document.getElementById("profile-dias").value),
        email: document.getElementById("profile-email").value.trim()
    };

    profileMsg.style.color = "#94a3b8";
    profileMsg.innerText = "Guardando cambios...";
    try {
        const respuesta = await fetch(`${API_URL}/perfil/${encodeURIComponent(usuarioActual)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(datos)
        });
        const data = await leerRespuesta(respuesta, "No se pudo guardar el perfil.");
        actualizarSesion(data);
        await actualizarDashboard(data);
        window.alert("Perfil actualizado con éxito");
        profileMsg.style.color = "#00e676";
        profileMsg.innerText = data.mensaje;
    } catch (error) {
        profileMsg.style.color = "#ff5252";
        profileMsg.innerText = error.message;
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
    const routineContainer = document.getElementById("routine-container");
    routineContainer.innerHTML = rutina.map((dia) => `
        <section class="day-plan">
            <h4>Día ${dia.dia}: ${dia.nombre}</h4>
            ${dia.ejercicios.map((item) => {
                return `
                <div class="exercise-card">
                    ${crearTarjetaEjercicio(item.ejercicio, item.imagen_url)}
                    <h5>${escaparHtml(item.ejercicio)}</h5>
                    <p class="series">${escaparHtml(item.series)}</p>
                    <p class="enfoque"><strong>Enfoque:</strong> ${escaparHtml(item.enfoque)}</p>
                </div>
            `;
            }).join("")}
        </section>
    `).join("");
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
            tbody.innerHTML = `<tr><td colspan="2">Sin registros disponibles.</td></tr>`;
            progreso.innerText = "Sin registros aún.";
            return;
        }

        tbody.innerHTML = data.registros.map((registro) => `
            <tr>
                <td>${formatearFecha(registro.fecha)}</td>
                <td>${Number(registro.peso).toFixed(1)} kg</td>
            </tr>
        `).join("");

        progreso.innerText = data.progreso || "Sin registros aún.";
        if (msg) msg.innerText = "";
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="2">Sin registros disponibles.</td></tr>`;
        progreso.innerText = error.message;
    }
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

    if (!usuarioActual) {
        msg.style.color = "#ff5252";
        msg.innerText = "Debes iniciar sesión para guardar registros.";
        return;
    }

    try {
        const respuesta = await fetch(`${API_URL}/seguimiento/${encodeURIComponent(usuarioActual)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fecha, peso })
        });
        const data = await leerRespuesta(respuesta, "No se pudo guardar el registro.");

        document.getElementById("form-seguimiento").reset();
        document.getElementById("seguimiento-progreso").innerText = data.progreso || "Sin registros aún.";
        await cargarSeguimiento();
        msg.style.color = "#00e676";
        msg.innerText = data.mensaje;
        mostrarSeccion('seguimiento');
    } catch (error) {
        msg.style.color = "#ff5252";
        msg.innerText = error.message;
    }
}

function actualizarActividad() {
    const sesionGuardada = localStorage.getItem(SESSION_KEY);
    if (!sesionGuardada) return;

    try {
        const sesion = JSON.parse(sesionGuardada);
        localStorage.setItem(SESSION_KEY, JSON.stringify(sesion));
    } catch (error) {
        localStorage.removeItem(SESSION_KEY);
    }
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

function verificarSesion() {
    const sesionGuardada = localStorage.getItem(SESSION_KEY);
    if (!sesionGuardada) return;

    try {
        const sesion = JSON.parse(sesionGuardada);
        if (!sesion.loginTime || Date.now() - sesion.loginTime >= SESSION_TIMEOUT) {
            cerrarSesion();
            window.alert("Sesión expirada por inactividad");
        }
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
    } catch (error) {
        localStorage.removeItem(SESSION_KEY);
    }
}

document.addEventListener("mousemove", actualizarActividad);
document.addEventListener("keydown", actualizarActividad);
document.addEventListener("click", actualizarActividad);
document.addEventListener("DOMContentLoaded", async () => {
    verificarSesion();
    await restaurarSesion();
    setInterval(verificarSesion, 30000);
});

function cerrarSesion() {
    usuarioActual = "";
    contrasenaActual = "";
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.clear();
    document.getElementById("dashboard").classList.add("hidden");
    document.getElementById("auth-box").classList.remove("hidden");
    document.getElementById("form-login").reset();
    document.getElementById("form-seguimiento").reset();
    mostrarTab("login");
}