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

    /** @param {PlantillaRutina} plantilla */
    function generarDesglose(plantilla, numeroSemana, numeroDia) {
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
        validarPlantilla,
        generarDesglose,
        evaluarProgresion,
        validarSeguridadRIR
    });
})();