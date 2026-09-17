const API_URL = "https://bmg-fitness.onrender.com/api";
const SESSION_KEY = "usuarioLogueado";
const SESSION_TIMEOUT = 300000;
let usuarioActual = "";
let contrasenaActual = "";

function mostrarTab(tab) {
    const formLogin = document.getElementById("form-login");
    const formRegister = document.getElementById("form-register");
    const formReset = document.getElementById("form-reset");
    const tabLogin = document.getElementById("tab-login");
    const tabRegister = document.getElementById("tab-register");
    const alertMsg = document.getElementById("alert-msg");

    alertMsg.innerText = "";

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
    document.getElementById("alert-msg").innerText = "";
}

async function ejecutarRegistro(e) {
    e.preventDefault();
    const alertMsg = document.getElementById("alert-msg");
    
    const usuario = document.getElementById("reg-user").value;
    const contrasena = document.getElementById("reg-pass").value;
    const correo = document.getElementById("reg-correo").value;
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
            body: JSON.stringify({ usuario, contrasena, correo, edad, sexo, peso, estatura, actividad, objetivo })
        });

        const data = await respuesta.json();

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

        const data = await respuesta.json();

        if (respuesta.ok) {
            usuarioActual = data.usuario;
            contrasenaActual = contrasena;
            localStorage.setItem(SESSION_KEY, JSON.stringify({
                usuario: usuarioActual,
                lastActivity: Date.now()
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

    alertMsg.style.color = "#94a3b8";
    alertMsg.innerText = "Enviando solicitud...";

    try {
        const respuesta = await fetch(`${API_URL}/reset-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usuario, correo })
        });
        const data = await respuesta.json();
        if (!respuesta.ok) throw new Error(data.detail || "No se pudo solicitar la recuperación.");

        alertMsg.style.color = "#00e676";
        alertMsg.innerText = data.mensaje;
        document.getElementById("form-reset").reset();
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
}

function mostrarPerfil(perfil) {
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
        dias_entrenamiento: parseInt(document.getElementById("profile-dias").value)
    };

    profileMsg.style.color = "#94a3b8";
    profileMsg.innerText = "Guardando cambios...";
    try {
        const respuesta = await fetch(`${API_URL}/perfil/${encodeURIComponent(usuarioActual)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(datos)
        });
        const data = await respuesta.json();
        if (!respuesta.ok) throw new Error(data.detail || "No se pudo guardar el perfil.");
        await actualizarDashboard(data);
        profileMsg.style.color = "#00e676";
        profileMsg.innerText = data.mensaje;
    } catch (error) {
        profileMsg.style.color = "#ff5252";
        profileMsg.innerText = error.message;
    }
}

function crearIlustracionSVG(nombreEjercicio) {
    const nombre = String(nombreEjercicio || "Ejercicio");
    const grupo = /pierna|sentadilla|prensa|gemelo|cuádriceps/i.test(nombre) ? "PIERNAS" : "ENTRENAMIENTO";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 360">
        <rect width="600" height="360" fill="#111827"/>
        <circle cx="300" cy="105" r="32" fill="#00e676"/>
        <path d="M300 140 L300 225 M300 165 L220 205 M300 165 L380 205 M300 225 L240 310 M300 225 L360 310" stroke="#e2e8f0" stroke-width="22" stroke-linecap="round" fill="none"/>
        <path d="M205 178 H395" stroke="#00e676" stroke-width="10" stroke-linecap="round"/>
        <text x="300" y="330" text-anchor="middle" fill="#94a3b8" font-family="sans-serif" font-size="18">${grupo}</text>
    </svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function renderizarRutina(rutina) {
    const routineContainer = document.getElementById("routine-container");
    routineContainer.innerHTML = rutina.map((dia) => `
        <section class="day-plan">
            <h4>Día ${dia.dia}: ${dia.nombre}</h4>
            ${dia.ejercicios.map((item) => {
                const imagen = typeof item.imagen_url === "string" && /^https?:\/\//.test(item.imagen_url)
                    ? item.imagen_url
                    : crearIlustracionSVG(item.ejercicio);
                return `
                <div class="exercise-card">
                    <img src="${imagen}" alt="${item.ejercicio}" onerror="this.onerror=null; this.src=crearIlustracionSVG(this.alt);" class="ejercicio-img" loading="lazy">
                    <h5>${item.ejercicio}</h5>
                    <p class="series">${item.series}</p>
                    <p class="enfoque"><strong>Enfoque:</strong> ${item.enfoque}</p>
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
        const data = await respuesta.json();

        if (!respuesta.ok) throw new Error(data.detail || "No se pudo cargar el seguimiento.");

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
        const data = await respuesta.json();

        if (!respuesta.ok) throw new Error(data.detail || "No se pudo guardar el registro.");

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
        localStorage.setItem(SESSION_KEY, JSON.stringify({
            usuario: sesion.usuario,
            lastActivity: Date.now()
        }));
    } catch (error) {
        localStorage.removeItem(SESSION_KEY);
    }
}

function verificarSesion() {
    const sesionGuardada = localStorage.getItem(SESSION_KEY);
    if (!sesionGuardada) return;

    try {
        const sesion = JSON.parse(sesionGuardada);
        if (!sesion.lastActivity || Date.now() - sesion.lastActivity > SESSION_TIMEOUT) {
            localStorage.removeItem(SESSION_KEY);
            usuarioActual = "";
            contrasenaActual = "";
            document.getElementById("dashboard").classList.add("hidden");
            document.getElementById("auth-box").classList.remove("hidden");
            mostrarTab("login");
            window.alert("Sesión expirada por inactividad");
        }
    } catch (error) {
        localStorage.removeItem(SESSION_KEY);
    }
}

document.addEventListener("mousemove", actualizarActividad);
document.addEventListener("keydown", actualizarActividad);
document.addEventListener("click", actualizarActividad);
document.addEventListener("DOMContentLoaded", () => {
    verificarSesion();
    setInterval(verificarSesion, 30000);
});

function cerrarSesion() {
    usuarioActual = "";
    contrasenaActual = "";
    localStorage.removeItem(SESSION_KEY);
    document.getElementById("dashboard").classList.add("hidden");
    document.getElementById("auth-box").classList.remove("hidden");
    document.getElementById("form-login").reset();
    document.getElementById("form-seguimiento").reset();
}