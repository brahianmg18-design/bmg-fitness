/*
 * @typedef {Object} PerfilReferencia
 * @property {string} sexo
 * @property {number} peso_kg
 * @property {number} altura_cm
 * @property {string} uso
 * @property {string} cargas
 *
 * @typedef {Object} CriteriosGenerales
 * @property {string} experiencia_recomendada
 * @property {string[]} dias_sugeridos
 * @property {{min: number, max: number}} duracion_aproximada_minutos
 * @property {{duracion_minutos: string, descripcion: string}} calentamiento
 * @property {string} regla_de_carga
 * @property {string} regla_de_progresion
 * @property {string} criterio_tecnico
 * @property {string} advertencia
 *
 * @typedef {Object} FaseProgresion
 * @property {string} fase
 * @property {number|string} RIR_objetivo
 * @property {string} volumen
 * @property {string} objetivo
 * @property {string} [criterio]
 * @property {number} [volumen_porcentaje]
 *
 * @typedef {Object} EjercicioPlantilla
 * @property {number} [orden]
 * @property {string} nombre
 * @property {string[]} grupo_muscular
 * @property {number} series
 * @property {string} repeticiones
 * @property {string} tempo
 * @property {number} descanso_seg
 * @property {number} RIR
 * @property {string} tecnica
 * @property {string} imagen
 *
 * @typedef {Object} DiaPlantilla
 * @property {number} dia
 * @property {string} rutina
 * @property {string} [enfoque]
 * @property {EjercicioPlantilla[]} ejercicios
 *
 * @typedef {Object} SemanaPlantilla
 * @property {number} semana
 * @property {string} fase
 * @property {number|string} RIR
 * @property {number} [volumen_porcentaje]
 * @property {DiaPlantilla[]} dias
 *
 * @typedef {Object} ResumenSemanaVolumen
 * @property {number} series_por_sesion
 * @property {number} series_totales_semana
 * @property {string} [intensidad_relativa]
 * @property {string} [volumen_relativo_aproximado]
 *
 * @typedef {Object} ResumenVolumen
 * @property {ResumenSemanaVolumen} semana_1
 * @property {ResumenSemanaVolumen} semana_2
 * @property {ResumenSemanaVolumen} semana_3
 * @property {ResumenSemanaVolumen} semana_4
 *
 * @typedef {Object} PlantillaRutina
 * @property {string} plantilla_id
 * @property {string} version
 * @property {string} idioma
 * @property {string} categoria
 * @property {string} nivel
 * @property {number} frecuencia_semanal
 * @property {string} estructura
 * @property {string} objetivo
 * @property {PerfilReferencia} perfil_referencia
 * @property {CriteriosGenerales} criterios_generales
 * @property {{semana_1: FaseProgresion, semana_2: FaseProgresion, semana_3: FaseProgresion, semana_4: FaseProgresion}} progresion_mensual
 * @property {SemanaPlantilla[]} semanas
 * @property {ResumenVolumen} resumen_volumen
 * @property {{doble_progresion: {descripcion: string, incremento_recomendado: {tren_superior: string, tren_inferior: string}}, semana_1: string, semana_2: string, semana_3: string, semana_4: string}} reglas_de_progresion
 * @property {{tipo_plantilla: string, requiere_personalizacion_de_carga: boolean, requiere_personalizacion_por_experiencia: boolean, compatible_con_progressive_overload: boolean, compatible_con_deload: boolean, estructura_reutilizable: boolean, proxima_plantilla_sugerida: string}} metadatos_plataforma
 */

(() => {
    const CAMPOS_EJERCICIO = [
        "nombre", "grupo_muscular", "series", "repeticiones", "tempo",
        "descanso_seg", "RIR", "tecnica", "imagen"
    ];

    function exigir(condicion, mensaje) {
        if (!condicion) throw new Error(mensaje);
    }

    function exigirCampos(objeto, campos, ruta) {
        exigir(objeto && typeof objeto === "object" && !Array.isArray(objeto), `${ruta} debe ser un objeto.`);
        campos.forEach((campo) => exigir(campo in objeto, `Falta el campo obligatorio '${ruta}.${campo}'.`));
    }

    function validarPlantilla(plantilla) {
        exigir(plantilla && typeof plantilla === "object" && !Array.isArray(plantilla), "El JSON debe ser un objeto de plantilla.");
        [
            "plantilla_id", "version", "idioma", "categoria", "nivel", "frecuencia_semanal",
            "estructura", "objetivo", "perfil_referencia", "criterios_generales",
            "progresion_mensual", "semanas", "resumen_volumen", "reglas_de_progresion",
            "metadatos_plataforma"
        ].forEach((campo) => exigir(campo in plantilla, `Falta el campo obligatorio '${campo}'.`));

        exigirCampos(plantilla.perfil_referencia, ["sexo", "peso_kg", "altura_cm", "uso", "cargas"], "perfil_referencia");
        exigirCampos(plantilla.criterios_generales, [
            "experiencia_recomendada", "dias_sugeridos", "duracion_aproximada_minutos",
            "calentamiento", "regla_de_carga", "regla_de_progresion", "criterio_tecnico", "advertencia"
        ], "criterios_generales");
        exigirCampos(plantilla.criterios_generales.duracion_aproximada_minutos, ["min", "max"], "criterios_generales.duracion_aproximada_minutos");
        exigirCampos(plantilla.criterios_generales.calentamiento, ["duracion_minutos", "descripcion"], "criterios_generales.calentamiento");
        exigirCampos(plantilla.reglas_de_progresion, ["doble_progresion", "semana_1", "semana_2", "semana_3", "semana_4"], "reglas_de_progresion");
        exigirCampos(plantilla.reglas_de_progresion.doble_progresion, ["descripcion", "incremento_recomendado"], "reglas_de_progresion.doble_progresion");
        exigirCampos(plantilla.reglas_de_progresion.doble_progresion.incremento_recomendado, ["tren_superior", "tren_inferior"], "reglas_de_progresion.doble_progresion.incremento_recomendado");
        exigirCampos(plantilla.metadatos_plataforma, [
            "tipo_plantilla", "requiere_personalizacion_de_carga", "requiere_personalizacion_por_experiencia",
            "compatible_con_progressive_overload", "compatible_con_deload", "estructura_reutilizable",
            "proxima_plantilla_sugerida"
        ], "metadatos_plataforma");

        exigir(Array.isArray(plantilla.semanas) && plantilla.semanas.length > 0, "La plantilla debe incluir semanas.");
        ["semana_1", "semana_2", "semana_3", "semana_4"].forEach((semana) => {
            exigirCampos(plantilla.progresion_mensual[semana], ["fase", "RIR_objetivo", "volumen", "objetivo"], `progresion_mensual.${semana}`);
        });

        plantilla.semanas.forEach((semana) => {
            exigir(Number.isInteger(semana.semana) && Array.isArray(semana.dias), "Cada semana debe incluir su número y el arreglo dias.");
            exigir(semana.semana >= 1 && semana.semana <= 4, "El número de semana debe estar entre 1 y 4.");
            semana.dias.forEach((dia) => {
                exigir(Number.isInteger(dia.dia) && Array.isArray(dia.ejercicios), "Cada día debe incluir su número y el arreglo ejercicios.");
                dia.ejercicios.forEach((ejercicio) => {
                    CAMPOS_EJERCICIO.forEach((campo) => exigir(campo in ejercicio, `Falta '${campo}' en un ejercicio.`));
                    exigir(Array.isArray(ejercicio.grupo_muscular), "grupo_muscular debe ser un arreglo.");
                    exigir(Number.isFinite(Number(ejercicio.series)) && Number(ejercicio.series) > 0, "Las series deben ser mayores que cero.");
                    exigir(Number.isFinite(Number(ejercicio.descanso_seg)) && Number(ejercicio.descanso_seg) >= 0, "descanso_seg debe ser un número no negativo.");
                    exigir(Number.isFinite(Number(ejercicio.RIR)) && Number(ejercicio.RIR) >= 0, "RIR debe ser un número no negativo.");
                });
            });
        });

        ["semana_1", "semana_2", "semana_3", "semana_4"].forEach((semana) => {
            exigirCampos(plantilla.resumen_volumen[semana], ["series_por_sesion", "series_totales_semana"], `resumen_volumen.${semana}`);
        });
        return true;
    }

    function buscarDia(plantilla, numeroSemana, numeroDia) {
        validarPlantilla(plantilla);
        const semana = plantilla.semanas.find((item) => item.semana === Number(numeroSemana));
        exigir(semana, `No existe la semana ${numeroSemana}.`);
        const dia = semana.dias.find((item) => item.dia === Number(numeroDia));
        exigir(dia, `No existe el día ${numeroDia} en la semana ${numeroSemana}.`);
        return { semana, dia };
    }

    function esCompuestoComplejo(ejercicio) {
        const nombre = String(ejercicio.nombre || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        return /sentadilla|press|jalon|peso muerto|prensa|remo|hip thrust/.test(nombre)
            || (Array.isArray(ejercicio.grupo_muscular) && ejercicio.grupo_muscular.length > 1);
    }

    function validarSeguridadRIR(ejercicio, rir, numeroSemana) {
        const rirNumerico = Number(rir);
        if (rirNumerico === 0 && esCompuestoComplejo(ejercicio)) {
            return {
                nivel: "alerta",
                mensaje: numeroSemana === 3
                    ? `${ejercicio.nombre}: la semana 3 limita el RIR 0 a aislamientos seguros; conserva al menos 1 RIR en este ejercicio compuesto.`
                    : `${ejercicio.nombre}: evita programar RIR 0 en un ejercicio compuesto complejo.`
            };
        }
        return null;
    }

    const ARCHIVOS_BIBLIOTECA = [
        "01_biblioteca_ejercicios.json",
        "02_patrones_movimiento.json",
        "03_grupos_musculares.json",
        "04_estructuras_nivel_frecuencia.json",
        "05_objetivos_entrenamiento.json",
        "06_equipamiento.json",
        "07_reglas_prioridad_muscular.json",
        "08_progresion_28_dias.json",
        "09_motor_generacion.json",
        "10_especificacion_integracion_copilot.json"
    ];
    const PATRONES_POR_ESTRUCTURA = {
        fullbody: ["empuje_horizontal", "traccion_horizontal", "sentadilla", "bisagra_cadera", "empuje_vertical", "estabilidad_core"],
        torso: ["empuje_horizontal", "traccion_horizontal", "empuje_vertical", "traccion_vertical", "extension_codo"],
        pierna: ["sentadilla", "bisagra_cadera", "unilateral_pierna", "flexion_rodilla", "flexion_plantar", "estabilidad_core"],
        legs: ["sentadilla", "bisagra_cadera", "unilateral_pierna", "flexion_rodilla", "flexion_plantar", "estabilidad_core"],
        push: ["empuje_horizontal", "empuje_vertical", "aduccion_horizontal", "abduccion_hombro", "extension_codo"],
        pull: ["traccion_horizontal", "traccion_vertical", "flexion_codo", "elevacion_escapular", "anti_rotacion"]
    };
    const GRUPOS_POR_ESTRUCTURA = {
        fullbody: ["pecho", "espalda", "hombros", "cuadriceps", "isquiosurales", "gluteos", "core"],
        torso: ["pecho", "espalda", "hombros", "biceps", "triceps"],
        pierna: ["cuadriceps", "isquiosurales", "gluteos", "gemelos", "core"],
        legs: ["cuadriceps", "isquiosurales", "gluteos", "gemelos", "core"],
        push: ["pecho", "hombros", "triceps"],
        pull: ["espalda", "biceps", "trapecio"]
    };
    const GRUPO_POR_PATRON = {
        empuje_horizontal: "pecho",
        empuje_vertical: "hombros",
        aduccion_horizontal: "pecho",
        abduccion_hombro: "hombros",
        extension_codo: "triceps",
        traccion_horizontal: "espalda",
        traccion_vertical: "espalda",
        flexion_codo: "biceps",
        elevacion_escapular: "trapecio",
        sentadilla: "cuadriceps",
        bisagra_cadera: "gluteos",
        extension_cadera: "gluteos",
        unilateral_pierna: "cuadriceps",
        flexion_rodilla: "isquiosurales",
        extension_rodilla: "cuadriceps",
        flexion_plantar: "gemelos",
        estabilidad_core: "core",
        flexion_tronco: "core",
        anti_rotacion: "core"
    };
    const OBJETIVOS_COMPATIBLES = {
        hipertrofia: ["hipertrofia"],
        fuerza: ["fuerza"],
        fuerza_definicion: ["fuerza_definicion", "fuerza"],
        acondicionamiento: ["acondicionamiento"]
    };

    function normalizarIdentificador(valor) {
        return String(valor || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_|_$/g, "");
    }

    async function cargarBiblioteca() {
        const archivos = await Promise.all(ARCHIVOS_BIBLIOTECA.map(async (archivo) => {
            const respuesta = await fetch(`training/${archivo}`);
            if (!respuesta.ok) throw new Error(`No se pudo cargar la biblioteca de entrenamiento '${archivo}'.`);
            return [archivo, await respuesta.json()];
        }));
        const biblioteca = Object.fromEntries(archivos);
        validarBiblioteca(biblioteca);
        return biblioteca;
    }

    function validarBiblioteca(biblioteca) {
        ARCHIVOS_BIBLIOTECA.forEach((archivo) => exigir(biblioteca?.[archivo], `Falta el archivo '${archivo}' en la biblioteca.`));
        const ejercicios = biblioteca["01_biblioteca_ejercicios.json"].ejercicios;
        const grupos = biblioteca["03_grupos_musculares.json"].grupos;
        const patrones = biblioteca["02_patrones_movimiento.json"].patrones;
        const objetivos = biblioteca["05_objetivos_entrenamiento.json"].objetivos;
        const perfilesEquipo = biblioteca["06_equipamiento.json"].perfiles;
        exigir(Array.isArray(ejercicios) && ejercicios.length > 0, "La biblioteca de ejercicios está vacía.");
        exigir(Array.isArray(grupos) && grupos.length > 0, "La biblioteca de grupos musculares está vacía.");
        exigir(Array.isArray(patrones) && patrones.length > 0, "La biblioteca de patrones está vacía.");
        exigir(Array.isArray(objetivos) && objetivos.length > 0, "La biblioteca de objetivos está vacía.");

        const idsEjercicios = new Map();
        ejercicios.forEach((ejercicio) => {
            exigir(ejercicio.id && ejercicio.nombre, "Cada ejercicio debe tener ID y nombre.");
            exigir(!idsEjercicios.has(ejercicio.id), `El ID de ejercicio '${ejercicio.id}' está duplicado.`);
            idsEjercicios.set(ejercicio.id, ejercicio);
        });
        if (biblioteca["01_biblioteca_ejercicios.json"].reglas.usar_solo_ids_existentes) {
            exigir(ejercicios.length === Number(biblioteca["01_biblioteca_ejercicios.json"].reglas.total_ejercicios), "La cantidad de ejercicios no coincide con la biblioteca maestra.");
        }

        const idsGrupos = new Set(grupos.map((grupo) => grupo.id));
        const aliasesMusculares = new Map();
        grupos.forEach((grupo) => (grupo.alias_ejercicio || []).forEach((alias) => aliasesMusculares.set(alias, grupo.id)));
        const idsPatrones = new Set(patrones.map((patron) => patron.id));
        const idsObjetivos = new Set(objetivos.map((objetivo) => objetivo.id));
        const equipamientoConocido = new Set(ejercicios.flatMap((ejercicio) => ejercicio.equipamiento));
        const idsNiveles = new Set(Object.keys(biblioteca["04_estructuras_nivel_frecuencia.json"].niveles));

        ejercicios.forEach((ejercicio) => {
            exigir(idsPatrones.has(ejercicio.patron_movimiento), `El ejercicio '${ejercicio.id}' referencia el patrón inexistente '${ejercicio.patron_movimiento}'.`);
            const grupo = aliasesMusculares.get(ejercicio.grupo_muscular) || ejercicio.grupo_muscular;
            exigir(idsGrupos.has(grupo), `El ejercicio '${ejercicio.id}' referencia el grupo muscular inexistente '${ejercicio.grupo_muscular}'.`);
            ejercicio.variantes.forEach((id) => exigir(idsEjercicios.has(id), `El ejercicio '${ejercicio.id}' referencia la variante inexistente '${id}'.`));
            ejercicio.niveles.forEach((nivel) => exigir(idsNiveles.has(nivel), `El ejercicio '${ejercicio.id}' referencia el nivel inexistente '${nivel}'.`));
            ejercicio.objetivos.forEach((objetivo) => exigir(idsObjetivos.has(objetivo), `El ejercicio '${ejercicio.id}' referencia el objetivo inexistente '${objetivo}'.`));
            ejercicio.equipamiento.forEach((equipo) => exigir(equipamientoConocido.has(equipo), `El ejercicio '${ejercicio.id}' referencia equipamiento no reconocido '${equipo}'.`));
        });
        perfilesEquipo.forEach((perfil) => {
            exigir(perfil.id && perfil.nombre, "Cada perfil de equipamiento debe incluir ID y nombre.");
            if (Array.isArray(perfil.permitidos)) {
                perfil.permitidos.forEach((equipo) => exigir(equipamientoConocido.has(equipo), `El perfil '${perfil.id}' referencia equipamiento inexistente '${equipo}'.`));
            }
        });
        const estructuras = biblioteca["04_estructuras_nivel_frecuencia.json"].niveles;
        Object.entries(estructuras).forEach(([nivel, frecuencias]) => {
            Object.entries(frecuencias).filter(([dias]) => dias !== "criterio").forEach(([dias, split]) => {
                exigir(idsNiveles.has(nivel) && Array.isArray(split) && split.length === Number(dias), `La estructura de ${nivel} para ${dias} días no es válida.`);
                exigir(split.every((id) => typeof id === "string" && id.length > 0), `Hay un split no válido en ${nivel}, ${dias} días.`);
            });
        });
        const progresion = biblioteca["08_progresion_28_dias.json"];
        exigir(Number(progresion.duracion_dias) === 28 && Array.isArray(progresion.semanas) && progresion.semanas.length === 4, "La progresión debe definir cuatro semanas y 28 días.");
        exigir(biblioteca["09_motor_generacion.json"].parametros_generacion, "Faltan parámetros de generación en el motor.");
        return true;
    }

    function normalizarNivelRutina(nivel) {
        const id = normalizarIdentificador(nivel);
        exigir(["principiante", "intermedio", "avanzado"].includes(id), "Selecciona un nivel de entrenamiento válido.");
        return id;
    }

    function normalizarObjetivoRutina(objetivo) {
        const id = normalizarIdentificador(objetivo);
        if (id.includes("acondicionamiento")) return "acondicionamiento";
        if (id.includes("fuerza") || id.includes("definicion")) return "fuerza_definicion";
        return "hipertrofia";
    }

    function normalizarGrupoMuscular(valor, biblioteca) {
        const id = normalizarIdentificador(valor);
        if (id === "brazos") return "biceps";
        if (id === "piernas") return "cuadriceps";
        if (id === "isquiotibiales") return "isquiosurales";
        if (id === "pantorrillas") return "gemelos";
        if (id === "core_abdomen") return "core";
        const grupos = biblioteca["03_grupos_musculares.json"].grupos;
        const grupo = grupos.find((item) => item.id === id || (item.alias_ejercicio || []).includes(id));
        return grupo?.id || id;
    }

    function obtenerGruposEjercicio(ejercicio, biblioteca) {
        return [...new Set([
            ejercicio.grupo_muscular,
            ...ejercicio.musculos_principales,
            ...ejercicio.musculos_secundarios
        ].map((grupo) => normalizarGrupoMuscular(grupo, biblioteca)))];
    }

    function obtenerPerfilEquipo(biblioteca, equipoId) {
        const perfiles = biblioteca["06_equipamiento.json"].perfiles;
        const perfil = perfiles.find((item) => item.id === equipoId) || perfiles.find((item) => item.id === "gimnasio_completo");
        exigir(perfil, `No existe el perfil de equipamiento '${equipoId}'.`);
        return perfil.permitidos === "Todos los equipamientos de la biblioteca."
            ? { ...perfil, es_completo: true, equipo_permitido: new Set() }
            : { ...perfil, es_completo: false, equipo_permitido: new Set(perfil.permitidos) };
    }

    function ejercicioCompatible(ejercicio, configuracion) {
        const objetivosAceptados = OBJETIVOS_COMPATIBLES[configuracion.objetivo];
        const grupoObjetivo = configuracion.biblioteca["05_objetivos_entrenamiento.json"].objetivos
            .find((item) => objetivosAceptados.includes(item.id));
        const objetivoCompatible = ejercicio.objetivos.some((objetivo) => objetivosAceptados.includes(objetivo));
        return ejercicio.niveles.includes(configuracion.nivel)
            && objetivoCompatible
            && Boolean(grupoObjetivo)
            && (configuracion.equipo.es_completo || ejercicio.equipamiento.every((equipo) => configuracion.equipo.equipo_permitido.has(equipo)));
    }

    function clasificarEstructura(estructura) {
        const id = normalizarIdentificador(estructura);
        if (id.startsWith("fullbody")) return "fullbody";
        if (id.startsWith("torso")) return "torso";
        if (id.startsWith("pierna")) return "pierna";
        if (id.startsWith("legs")) return "legs";
        if (id.startsWith("push")) return "push";
        if (id.startsWith("pull")) return "pull";
        throw new Error(`La estructura '${estructura}' no tiene una familia de entrenamiento válida.`);
    }

    function puntuarEjercicio(ejercicio, configuracion, contexto) {
        const grupos = obtenerGruposEjercicio(ejercicio, configuracion.biblioteca);
        const coincideObjetivo = contexto.grupo ? grupos.includes(contexto.grupo) : true;
        const preferido = configuracion.preferencias.includes(ejercicio.grupo_muscular)
            || configuracion.preferencias.some((grupo) => grupos.includes(grupo));
        const usosSemana = contexto.usos.get(ejercicio.id) || 0;
        const tecnicidad = normalizarIdentificador(ejercicio.demanda_tecnica);
        const penalizacionTecnica = configuracion.nivel === "principiante" && tecnicidad === "alta" ? 1.2 : 0;
        const semillaRotacion = contexto.rotar
            ? `semana:${contexto.semana}:${contexto.estructura}:${contexto.rol}:${ejercicio.id}`
            : `base:${contexto.estructura}:${contexto.rol}:${ejercicio.id}`;
        const variacion = (hashDeterminista(semillaRotacion) % 1000) / 10000;
        const preferenciaPeso = Number(configuracion.reglasPrioridad.niveles.preferencia);
        const balance = ejercicio.tipo === "compuesto" ? 0.25 : 0;
        return (coincideObjetivo ? 3 : 0)
            + balance
            + (preferido ? preferenciaPeso : 0)
            - usosSemana * 0.35
            - penalizacionTecnica
            + variacion;
    }

    function hashDeterminista(texto) {
        let hash = 2166136261;
        for (let indice = 0; indice < texto.length; indice += 1) {
            hash ^= texto.charCodeAt(indice);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    }

    function seleccionarEjercicio(configuracion, contexto, usados) {
        const opciones = configuracion.ejercicios.filter((ejercicio) =>
            !usados.has(ejercicio.id)
            && ejercicioCompatible(ejercicio, configuracion)
            && (!contexto.patron || ejercicio.patron_movimiento === contexto.patron)
            && (!contexto.grupo || obtenerGruposEjercicio(ejercicio, configuracion.biblioteca).includes(contexto.grupo))
            && (!contexto.gruposPermitidos || obtenerGruposEjercicio(ejercicio, configuracion.biblioteca)
                .some((grupo) => contexto.gruposPermitidos.includes(grupo)))
        );
        if (!opciones.length) return null;
        return [...opciones].sort((a, b) =>
            puntuarEjercicio(b, configuracion, contexto) - puntuarEjercicio(a, configuracion, contexto)
        )[0];
    }

    function obtenerRolesEstructura(familia) {
        return PATRONES_POR_ESTRUCTURA[familia].map((patron) => ({
            patron,
            grupo: GRUPO_POR_PATRON[patron]
        }));
    }

    function gruposCubiertos(ejercicios, biblioteca) {
        return new Set(ejercicios.flatMap((ejercicio) => obtenerGruposEjercicio(ejercicio, biblioteca)));
    }

    function crearEjercicioProgramado(ejercicio, indice, configuracion, fase, objetivo) {
        const parametros = configuracion.biblioteca["09_motor_generacion.json"].parametros_generacion;
        const seriesNivel = parametros.series_base_por_nivel[configuracion.nivel];
        const esCore = ["core", "flexion_tronco", "estabilidad_core", "anti_rotacion"].includes(ejercicio.grupo_muscular)
            || ["estabilidad_core", "flexion_tronco", "anti_rotacion"].includes(ejercicio.patron_movimiento);
        const tipoSerie = esCore ? "core" : (seriesNivel[ejercicio.tipo] ? ejercicio.tipo : "otro");
        let series = Number(seriesNivel[tipoSerie]);
        if (configuracion.preferencias.some((grupo) => obtenerGruposEjercicio(ejercicio, configuracion.biblioteca).includes(grupo))) {
            series += Math.max(1, Math.ceil(series * (Number(configuracion.reglasPrioridad.niveles.preferencia) - 1)));
        }
        series = Math.max(1, Math.round(series * Number(fase.volumen_factor) * configuracion.factorIntensidad));
        const rangos = objetivo.rangos;
        const tipoRango = esCore ? "core" : (ejercicio.tipo === "compuesto" ? "compuestos" : "aislamientos");
        const rirObjetivo = Math.max(
            Number(fase.rir),
            Number(objetivo.rir[Number(fase.semana) - 1]) || 0
        ) + (configuracion.nivel === "principiante" ? Number(parametros.rir_adicional_principiante) : 0);
        const tipoDescanso = esCore ? "core" : (ejercicio.objetivos.includes("acondicionamiento") ? "acondicionamiento" : tipoRango === "compuestos" ? "compuesto" : "aislamiento");
        return {
            orden: indice + 1,
            ejercicio_id: ejercicio.id,
            nombre: ejercicio.nombre,
            grupo_muscular: [normalizarGrupoMuscular(ejercicio.grupo_muscular, configuracion.biblioteca)],
            grupo_muscular_id: normalizarGrupoMuscular(ejercicio.grupo_muscular, configuracion.biblioteca),
            musculos_principales: ejercicio.musculos_principales,
            musculos_secundarios: ejercicio.musculos_secundarios,
            patron_movimiento: ejercicio.patron_movimiento,
            tipo: ejercicio.tipo,
            grupo_muscular_id: normalizarGrupoMuscular(ejercicio.grupo_muscular, configuracion.biblioteca),
            grupo_muscular: [configuracion.biblioteca["03_grupos_musculares.json"].grupos
                .find((grupo) => grupo.id === normalizarGrupoMuscular(ejercicio.grupo_muscular, configuracion.biblioteca)).nombre],
            series,
            repeticiones: rangos[tipoRango],
            tempo: "Controlado",
            descanso_seg: Number(parametros.descanso_segundos[tipoDescanso]),
            RIR: rirObjetivo,
            RIR_objetivo: rirObjetivo,
            tecnica: `Prioriza una ejecución controlada y estable; ajusta la carga para conservar el RIR indicado.`,
            imagen: "",
            equipamiento: ejercicio.equipamiento
        };
    }

    function validarRutinaGenerada(rutina, configuracion) {
        const ids = new Set(configuracion.ejercicios.map((ejercicio) => ejercicio.id));
        const ejerciciosCompatibles = configuracion.ejercicios
            .filter((ejercicio) => ejercicioCompatible(ejercicio, configuracion));
        rutina.semanas.forEach((semana) => {
            exigir(semana.dias.length === configuracion.frecuencia, `La semana ${semana.semana} no tiene ${configuracion.frecuencia} sesiones.`);
            const gruposCubiertosSemana = new Set();
            let firmaAnterior = "";
            semana.dias.forEach((dia) => {
                const idsDia = new Set();
                exigir(dia.ejercicios.length >= 3, `El día ${dia.dia} de la semana ${semana.semana} tiene muy pocos ejercicios.`);
                const firmaDia = dia.ejercicios.map((ejercicio) => ejercicio.ejercicio_id).join("|");
                exigir(
                    firmaDia !== firmaAnterior || ejerciciosCompatibles.length <= 3,
                    `Hay sesiones consecutivas idénticas en la semana ${semana.semana}.`
                );
                firmaAnterior = firmaDia;
                dia.ejercicios.forEach((ejercicio) => {
                    exigir(ids.has(ejercicio.ejercicio_id), `El ejercicio '${ejercicio.ejercicio_id}' no existe en la biblioteca.`);
                    exigir(!idsDia.has(ejercicio.ejercicio_id), `El ejercicio '${ejercicio.nombre}' está duplicado en una sesión.`);
                    idsDia.add(ejercicio.ejercicio_id);
                    const original = configuracion.ejercicios.find((item) => item.id === ejercicio.ejercicio_id);
                    exigir(ejercicioCompatible(original, configuracion), `El ejercicio '${ejercicio.nombre}' no cumple los filtros de nivel, objetivo o equipamiento.`);
                    exigir(ejercicio.series > 0 && ejercicio.RIR_objetivo >= 1, `La prescripción de '${ejercicio.nombre}' no es segura.`);
                    obtenerGruposEjercicio(original, configuracion.biblioteca).forEach((grupo) => gruposCubiertosSemana.add(grupo));
                });
            });
            const gruposDisponibles = new Set(configuracion.ejercicios
                .filter((ejercicio) => ejercicioCompatible(ejercicio, configuracion))
                .flatMap((ejercicio) => obtenerGruposEjercicio(ejercicio, configuracion.biblioteca)));
            const esenciales = ["pecho", "espalda", "hombros", "cuadriceps", "isquiosurales", "gluteos"];
            const gruposSinEstimulo = esenciales.filter((grupo) => gruposDisponibles.has(grupo) && !gruposCubiertosSemana.has(grupo));
            exigir(!gruposSinEstimulo.length, `La semana ${semana.semana} dejó sin estímulo grupos musculares disponibles: ${gruposSinEstimulo.join(", ")}.`);
            if (configuracion.preferencias.length) {
                const prioridad = configuracion.preferencias[0];
                const sesionesConPrioridad = semana.dias.filter((dia) => dia.ejercicios.some((ejercicio) =>
                    obtenerGruposEjercicio(configuracion.ejercicios.find((item) => item.id === ejercicio.ejercicio_id), configuracion.biblioteca).includes(prioridad)
                ));
                exigir(sesionesConPrioridad.length > 0, `No fue posible aplicar la prioridad muscular '${prioridad}' en la semana ${semana.semana}.`);
            }
        });
        return true;
    }

    function seleccionarSesionesPrioritarias(estructuras, biblioteca, preferencias, limite) {
        if (!preferencias.length) return new Set();
        const prioridad = preferencias[0];
        const elegibles = estructuras
            .map((estructura, indice) => ({ indice, familia: clasificarEstructura(estructura) }))
            .filter((item) => GRUPOS_POR_ESTRUCTURA[item.familia].includes(prioridad))
            .map((item) => item.indice);
        if (!elegibles.length) return new Set();
        const seleccionadas = [elegibles[0]];
        for (const indice of elegibles.slice(1).reverse()) {
            if (seleccionadas.length >= limite) break;
            if (seleccionadas.every((seleccionada) => Math.abs(seleccionada - indice) > 1)) {
                seleccionadas.push(indice);
            }
        }
        if (seleccionadas.length < Math.min(limite, elegibles.length)) {
            const siguiente = elegibles.find((indice) => !seleccionadas.includes(indice));
            if (siguiente !== undefined) seleccionadas.push(siguiente);
        }
        return new Set(seleccionadas);
    }

    function generarRutina(usuario, biblioteca) {
        validarBiblioteca(biblioteca);
        const nivel = normalizarNivelRutina(usuario.nivel || usuario.nivel_experiencia);
        const frecuencia = Number(usuario.frecuencia_dias ?? usuario.dias_entrenamiento);
        exigir(Number.isInteger(frecuencia) && frecuencia >= 1 && frecuencia <= 6, "La frecuencia debe estar entre 1 y 6 días.");
        const objetivo = normalizarObjetivoRutina(usuario.objetivo_entrenamiento);
        const equipo = obtenerPerfilEquipo(biblioteca, usuario.equipamiento || "gimnasio_completo");
        const grupos = biblioteca["03_grupos_musculares.json"].grupos;
        const reglasPrioridad = biblioteca["07_reglas_prioridad_muscular.json"];
        const idsGrupo = new Set(grupos.map((grupo) => grupo.id));
        const preferenciaCruda = usuario.preferencia_muscular || usuario.musculo_prioritario;
        const preferencia = normalizarIdentificador(preferenciaCruda);
        const prioridades = preferencia && !["sin_preferencia", "ninguno", "none"].includes(preferencia)
            ? [normalizarGrupoMuscular(preferencia, biblioteca)]
            : [];
        prioridades.forEach((grupo) => exigir(idsGrupo.has(grupo), `El grupo prioritario '${preferenciaCruda}' no existe en la biblioteca.`));
        const estructuras = biblioteca["04_estructuras_nivel_frecuencia.json"].niveles[nivel]?.[String(frecuencia)];
        exigir(Array.isArray(estructuras) && estructuras.length === frecuencia, `No hay estructura para ${nivel} y ${frecuencia} días.`);
        const objetivoConfig = biblioteca["05_objetivos_entrenamiento.json"].objetivos
            .find((item) => OBJETIVOS_COMPATIBLES[objetivo].includes(item.id));
        exigir(objetivoConfig, `No hay parámetros para el objetivo '${objetivo}'.`);
        const parametrosMotor = biblioteca["09_motor_generacion.json"].parametros_generacion;
        const indicesPrioritarios = seleccionarSesionesPrioritarias(
            estructuras,
            biblioteca,
            prioridades,
            Number(parametrosMotor.sesiones_prioritarias_maximas)
        );
        const configuracion = {
            biblioteca,
            nivel,
            frecuencia,
            objetivo,
            equipo,
            reglasPrioridad,
            preferencias: prioridades,
            factorIntensidad: ({ base: 0.9, media: 1, alta: 1.05 })[usuario.intensidad_semanal] || 1,
            ejercicios: biblioteca["01_biblioteca_ejercicios.json"].ejercicios
        };
        const progresion = biblioteca["08_progresion_28_dias.json"];
        const semanas = progresion.semanas.map((fase) => {
            const usos = new Map();
            const dias = estructuras.map((estructura, indiceDia) => {
                const familia = clasificarEstructura(estructura);
                const roles = obtenerRolesEstructura(familia);
                const gruposPermitidos = GRUPOS_POR_ESTRUCTURA[familia];
                const elegidos = [];
                const usados = new Set();
                roles.forEach((rol) => {
                    const ejercicio = seleccionarEjercicio(configuracion, {
                        ...rol, semana: fase.semana, estructura, rol: rol.patron,
                        rotar: !["compuesto", "bisagra_cadera", "sentadilla"].includes(rol.patron),
                        usos, gruposPermitidos
                    }, usados);
                    if (ejercicio) {
                        elegidos.push(ejercicio);
                        usados.add(ejercicio.id);
                        usos.set(ejercicio.id, (usos.get(ejercicio.id) || 0) + 1);
                    }
                });
                const prioridadTieneSesion = indicesPrioritarios.has(indiceDia);
                if (prioridadTieneSesion && !elegidos.some((ejercicio) => obtenerGruposEjercicio(ejercicio, biblioteca).includes(prioridades[0]))) {
                    const ejercicioPrioritario = seleccionarEjercicio(configuracion, {
                        semana: fase.semana, estructura, rol: `prioridad:${prioridades[0]}`, rotar: true,
                        usos, grupo: prioridades[0], gruposPermitidos
                    }, usados);
                    if (ejercicioPrioritario) {
                        elegidos.push(ejercicioPrioritario);
                        usados.add(ejercicioPrioritario.id);
                        usos.set(ejercicioPrioritario.id, (usos.get(ejercicioPrioritario.id) || 0) + 1);
                    }
                }
                const totalObjetivo = Math.max(5, roles.length);
                while (elegidos.length < Math.min(7, totalObjetivo)) {
                    const cubiertos = gruposCubiertos(elegidos, biblioteca);
                    const faltante = gruposPermitidos.find((grupo) => !cubiertos.has(grupo));
                    const ejercicio = seleccionarEjercicio(configuracion, {
                        semana: fase.semana, estructura, rol: `complemento:${elegidos.length}`, rotar: true,
                        usos, grupo: faltante || null, gruposPermitidos
                    }, usados) || (faltante ? seleccionarEjercicio(configuracion, {
                        semana: fase.semana, estructura, rol: `complemento:${elegidos.length}`, rotar: true,
                        usos, gruposPermitidos
                    }, usados) : null) || seleccionarEjercicio(configuracion, {
                        semana: fase.semana, estructura, rol: `complemento:${elegidos.length}`, rotar: true,
                        usos
                    }, usados);
                    if (!ejercicio) break;
                    elegidos.push(ejercicio);
                    usados.add(ejercicio.id);
                    usos.set(ejercicio.id, (usos.get(ejercicio.id) || 0) + 1);
                }
                exigir(elegidos.length >= 3, `No se encontraron suficientes ejercicios compatibles para '${estructura}' con el equipamiento seleccionado.`);
                const ejercicios = elegidos.map((ejercicio, indice) =>
                    crearEjercicioProgramado(ejercicio, indice, configuracion, fase, objetivoConfig)
                );
                return {
                    dia: indiceDia + 1,
                    rutina: estructura.replaceAll("_", " ").toUpperCase(),
                    enfoque: estructura.replaceAll("_", " "),
                    estructura_id: estructura,
                    ejercicios
                };
            });
            return {
                semana: fase.semana,
                fase: fase.nombre,
                RIR: fase.rir,
                volumen_porcentaje: Math.round(fase.volumen_factor * 100),
                volumen_factor: fase.volumen_factor,
                dias
            };
        });
        const rutina = {
            biblioteca_dinamica: true,
            plantilla_id: `BMG-${nivel}-${frecuencia}-${objetivo}`,
            version: "1.0",
            idioma: "es",
            nivel,
            frecuencia_semanal: frecuencia,
            objetivo,
            equipamiento: equipo.id,
            musculo_prioritario: prioridades[0] || null,
            criterios_generales: {
                regla_de_progresion: biblioteca["08_progresion_28_dias.json"].reglas.join(" "),
                calentamiento: { descripcion: "Realiza un calentamiento general y aproximaciones graduales antes de los ejercicios principales." }
            },
            progresion_mensual: Object.fromEntries(semanas.map((semana) => [`semana_${semana.semana}`, {
                fase: semana.fase,
                objetivo: semana.fase,
                RIR_objetivo: semana.dias[0].ejercicios[0].RIR_objetivo,
                volumen: `${semana.volumen_porcentaje}%`,
                volumen_porcentaje: semana.volumen_porcentaje
            }])),
            reglas_de_progresion: Object.fromEntries(semanas.map((semana) => [`semana_${semana.semana}`, `Fase ${semana.fase}; aplica doble progresión con RIR ${semana.RIR}.`])),
            semanas
        };
        validarRutinaGenerada(rutina, configuracion);
        return rutina;
    }

    /** @param {PlantillaRutina} plantilla */
    function generarDesglose(plantilla, numeroSemana, numeroDia) {
        if (plantilla?.biblioteca_dinamica) {
            const semana = plantilla.semanas.find((item) => item.semana === Number(numeroSemana));
            exigir(semana, `No existe la semana ${numeroSemana}.`);
            const dia = semana.dias.find((item) => item.dia === Number(numeroDia));
            exigir(dia, `No existe el día ${numeroDia} en la semana ${numeroSemana}.`);
            return {
                plantilla_id: plantilla.plantilla_id,
                semana: semana.semana,
                fase: semana.fase,
                instruccion_fase: plantilla.progresion_mensual[`semana_${semana.semana}`],
                criterios_generales: plantilla.criterios_generales,
                reglas_de_progresion: plantilla.reglas_de_progresion,
                dia: {
                    ...dia,
                    ejercicios: dia.ejercicios.map((ejercicio) => ({
                        ...ejercicio,
                        alerta_seguridad: validarSeguridadRIR(ejercicio, ejercicio.RIR_objetivo, semana.semana)
                    }))
                }
            };
        }
        const { semana, dia } = buscarDia(plantilla, numeroSemana, numeroDia);
        const fase = plantilla.progresion_mensual[`semana_${semana.semana}`];
        exigir(fase, `No hay instrucciones de progresión para la semana ${semana.semana}.`);

        const ejercicios = dia.ejercicios.map((ejercicio) => ({
            ...ejercicio,
            RIR_objetivo: ejercicio.RIR ?? semana.RIR,
            alerta_seguridad: validarSeguridadRIR(ejercicio, ejercicio.RIR ?? semana.RIR, semana.semana)
        }));

        return {
            plantilla_id: plantilla.plantilla_id,
            semana: semana.semana,
            fase: semana.fase,
            instruccion_fase: fase,
            criterios_generales: plantilla.criterios_generales,
            reglas_de_progresion: plantilla.reglas_de_progresion,
            dia: { ...dia, ejercicios }
        };
    }

    function rangoRepeticiones(texto) {
        const coincidencia = String(texto).match(/(\d+)\s*-\s*(\d+)/);
        exigir(coincidencia, `No se pudo interpretar el rango de repeticiones '${texto}'.`);
        return { minimo: Number(coincidencia[1]), maximo: Number(coincidencia[2]) };
    }

    function porcentajeIncremento(plantilla, ejercicio) {
        const gruposInferiores = /cuadriceps|gluteos|isquiotibiales|piernas|pantorrillas/;
        const esTrenInferior = ejercicio.grupo_muscular.some((grupo) =>
            gruposInferiores.test(String(grupo).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase())
        );
        const tren = esTrenInferior ? "tren_inferior" : "tren_superior";
        const recomendacion = plantilla.reglas_de_progresion.doble_progresion.incremento_recomendado[tren];
        const coincidencia = String(recomendacion).match(/(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)/);
        exigir(coincidencia, `No se pudo interpretar el incremento recomendado para ${tren}.`);
        return Number(coincidencia[1]);
    }

    function evaluarProgresion(plantilla, numeroSemana, numeroDia, nombreEjercicio, seriesRealizadas, cargaActualKg) {
        const desglose = generarDesglose(plantilla, numeroSemana, numeroDia);
        const ejercicio = desglose.dia.ejercicios.find((item) => item.nombre === nombreEjercicio);
        exigir(ejercicio, `No se encontró el ejercicio '${nombreEjercicio}' en el día seleccionado.`);
        exigir(Array.isArray(seriesRealizadas) && seriesRealizadas.length === Number(ejercicio.series), `Registra los resultados de las ${ejercicio.series} series.`);

        const { minimo, maximo } = rangoRepeticiones(ejercicio.repeticiones);
        const rirObjetivo = Number(ejercicio.RIR_objetivo);
        exigir(Number.isFinite(rirObjetivo), "El RIR objetivo del ejercicio debe ser numérico para evaluar la progresión.");
        exigir(Number.isFinite(Number(cargaActualKg)) && Number(cargaActualKg) > 0, "La carga actual debe ser mayor que cero.");

        const resultados = seriesRealizadas.map((serie, indice) => {
            const repeticiones = Number(serie.repeticiones);
            const rir = Number(serie.RIR);
            exigir(Number.isInteger(repeticiones) && repeticiones >= 0, `Revisa las repeticiones de la serie ${indice + 1}.`);
            exigir(Number.isFinite(rir) && rir >= 0 && rir <= 10, `Revisa el RIR de la serie ${indice + 1}.`);
            return { repeticiones, RIR: rir };
        });

        const alertas = resultados
            .map((serie) => validarSeguridadRIR(ejercicio, serie.RIR, Number(numeroSemana)))
            .filter(Boolean);
        if (alertas.length) {
            return { accion: "detener_y_ajustar", alertas, mensaje: alertas[0].mensaje };
        }

        const cumpleRIR = resultados.every((serie) => serie.RIR >= rirObjetivo);
        const cumpleRangoMinimo = resultados.every((serie) => serie.repeticiones >= minimo);
        if (!cumpleRIR || !cumpleRangoMinimo) {
            return {
                accion: "mantener",
                carga_siguiente_kg: Number(cargaActualKg),
                mensaje: "Mantén la carga y prioriza completar el rango con el RIR objetivo y técnica estable."
            };
        }

        if (resultados.every((serie) => serie.repeticiones >= maximo)) {
            const incrementoPorcentual = porcentajeIncremento(plantilla, ejercicio);
            const cargaSiguiente = Math.round(Number(cargaActualKg) * (1 + incrementoPorcentual / 100) * 100) / 100;
            return {
                accion: "subir_carga",
                carga_siguiente_kg: cargaSiguiente,
                incremento_porcentual: incrementoPorcentual,
                mensaje: "Todas las series alcanzaron el extremo superior del rango manteniendo el RIR objetivo."
            };
        }

        return {
            accion: "subir_repeticiones",
            repeticiones_siguientes: resultados.map((serie) => Math.min(maximo, serie.repeticiones + 1)),
            carga_siguiente_kg: Number(cargaActualKg),
            mensaje: "Aumenta una repetición por serie que aún no esté en el extremo superior del rango."
        };
    }

    window.RutinaEngine = Object.freeze({
        cargarBiblioteca,
        validarBiblioteca,
        generarRutina,
        validarRutinaGenerada,
        validarPlantilla,
        generarDesglose,
        evaluarProgresion,
        validarSeguridadRIR
    });
})();