/*
 * @typedef {Object} ReferenciaPrototipoNutricional
 * @property {number} height_cm
 * @property {number} weight_kg
 * @property {number} age_years
 *
 * @typedef {Object} PrototipoNutricional
 * @property {string} id
 * @property {'male'|'female'} sex
 * @property {ReferenciaPrototipoNutricional} reference
 * @property {string} profile
 *
 * @typedef {Object} EstrategiaSeleccion
 * @property {string} method
 * @property {string[]} primary_variables
 * @property {string[]} secondary_variables
 * @property {string} important_note
 *
 * @typedef {Object} ModeloEnergia
 * @property {number} reference_age_years
 * @property {{description: string, activity_factors: Record<string, number>}} activity_model
 * @property {{beginner: number, intermediate: number, advanced: number}} training_level_adjustment
 * @property {{fat_loss: number, maintenance: number, muscle_gain: number}} goal_adjustment
 *
 * @typedef {Object} RangoGramosPorKg
 * @property {number} min
 * @property {number} max
 *
 * @typedef {Object} RangosProteina
 * @property {RangoGramosPorKg} fat_loss
 * @property {RangoGramosPorKg} maintenance
 * @property {RangoGramosPorKg} muscle_gain
 *
 * @typedef {Object} ModeloMacros
 * @property {{unit: string, default_range: RangosProteina}} protein
 * @property {{unit: string, default_range: RangoGramosPorKg}} fat
 * @property {{method: string, description: string}} carbohydrates
 *
 * @typedef {Object} EstructuraComidas
 * @property {number} meals_per_day
 * @property {{id: string, name: string}[]} meals
 *
 * @typedef {Object} ReglasPersonalizacion
 * @property {boolean} weight_adjustment
 * @property {boolean} height_adjustment
 * @property {boolean} age_adjustment
 * @property {boolean} sex_adjustment
 * @property {boolean} training_level_adjustment
 * @property {boolean} training_frequency_adjustment
 * @property {boolean} goal_adjustment
 * @property {boolean} body_fat_optional
 * @property {boolean} final_plan_must_be_calculated_from_real_user_data
 *
 * @typedef {Object} ObjetivoNutricionMatriz
 * @property {string} id
 * @property {string} name
 * @property {number} calorie_adjustment_kcal
 *
 * @typedef {Object} ObjetivosNutricionMatriz
 * @property {ObjetivoNutricionMatriz} fat_loss
 * @property {ObjetivoNutricionMatriz} maintenance
 * @property {ObjetivoNutricionMatriz} muscle_gain
 *
 * @typedef {Object} PlanMensual
 * @property {number} duration_days
 * @property {number} weeks
 * @property {number} meals_per_day
 * @property {number} unique_days_required
 * @property {boolean} repeat_exact_week
 * @property {boolean} progressive_portion_adjustment
 * @property {boolean} meal_variety_required
 * @property {{morning_training: boolean, afternoon_training: boolean, evening_training: boolean}} training_time_adaptation
 *
 * @typedef {Object} RangoPorObjetivo
 * @property {{min: number, max: number}} fat_loss
 * @property {{min: number, max: number}} maintenance
 * @property {{min: number, max: number}} muscle_gain
 *
 * @typedef {Object} MatrizPrototiposNutricionales
 * @property {{version: string, description: string, purpose: string, selection_strategy: EstrategiaSeleccion, energy_model: ModeloEnergia, macro_model: ModeloMacros, meal_structure: EstructuraComidas, prototypes: PrototipoNutricional[], personalization_rules: ReglasPersonalizacion, nutrition_goals: ObjetivosNutricionMatriz, monthly_plan: PlanMensual}} nutrition_prototype_matrix
 *
 * @typedef {Object} PerfilNutricionalUsuario
 * @property {number} peso
 * @property {number} estatura
 * @property {number} edad
 * @property {string} sexo
 * @property {number} [actividad]
 * @property {number} [dias_entrenamiento]
 * @property {string} [nivel_experiencia]
 * @property {string} [objetivo_nutricional]
 *
 * @typedef {Object} IngredienteMenu
 * @property {string} nombre
 * @property {number} cantidad
 * @property {string} unidad
 *
 * @typedef {Object} ComidaMenu
 * @property {string} receta_id
 * @property {string} comida
 * @property {string} plato
 * @property {number} calorias
 * @property {{proteinas: number, carbohidratos: number, grasas: number}} macros
 * @property {IngredienteMenu[]} alimentos
 *
 * @typedef {Object} DiaMenu
 * @property {string} dia
 * @property {number} dia_numero
 * @property {number} calorias
 * @property {{proteinas: number, carbohidratos: number, grasas: number}} macros
 * @property {ComidaMenu[]} comidas
 *
 * @typedef {Object} ObjetivosNutricionales
 * @property {string} prototipo_id
 * @property {number} factor_actividad
 * @property {number} factor_experiencia
 * @property {number} tmb
 * @property {number} tdee
 * @property {number} calorias
 * @property {number} proteinas
 * @property {number} grasas
 * @property {number} carbohidratos
 * @property {string[]} advertencias
 */

(() => {
    const FACTOR_ESCALA_MIN = 0.7;
    const FACTOR_ESCALA_MAX = 1.5;

    function exigir(condicion, mensaje) {
        if (!condicion) throw new Error(mensaje);
    }

    function normalizar(valor) {
        return String(valor ?? "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replaceAll("_", " ")
            .trim();
    }

    function validarMatriz(documento) {
        const matriz = documento?.nutrition_prototype_matrix;
        exigir(matriz && Array.isArray(matriz.prototypes) && matriz.prototypes.length > 0, "La matriz debe incluir nutrition_prototype_matrix.prototypes.");
        exigir(matriz.energy_model?.activity_model?.activity_factors, "Faltan factores de actividad en la matriz.");
        exigir(matriz.energy_model?.training_level_adjustment, "Faltan factores por nivel de entrenamiento.");
        exigir(matriz.energy_model?.goal_adjustment, "Faltan ajustes energéticos por objetivo.");
        exigir(matriz.macro_model?.protein?.default_range && matriz.macro_model?.fat?.default_range, "Faltan rangos de macronutrientes.");
        exigir(Number(matriz.monthly_plan?.duration_days) === 28, "La matriz debe definir un plan mensual de 28 días.");
        exigir(Array.isArray(matriz.meal_structure?.meals) && matriz.meal_structure.meals.length === Number(matriz.meal_structure.meals_per_day), "La estructura de comidas no coincide con meals_per_day.");
        return true;
    }

    function normalizarSexo(sexo) {
        const valor = normalizar(sexo);
        if (["male", "masculino", "hombre", "m"].includes(valor)) return "male";
        if (["female", "femenino", "mujer", "f"].includes(valor)) return "female";
        throw new Error("El sexo debe ser masculino o femenino para calcular el metabolismo basal.");
    }

    function normalizarNivel(nivel) {
        const valor = normalizar(nivel);
        if (["principiante", "beginner"].includes(valor)) return "beginner";
        if (["intermedio", "intermediate"].includes(valor)) return "intermediate";
        if (["avanzado", "advanced"].includes(valor)) return "advanced";
        throw new Error("Selecciona un nivel de entrenamiento válido.");
    }

    function normalizarObjetivo(objetivo) {
        const valor = normalizar(objetivo);
        if (["fat loss", "perder grasa", "perdida de grasa", "perder grasa (deficit)", "deficit"].includes(valor)) return "fat_loss";
        if (["muscle gain", "ganar peso/musculo (superavit)", "ganancia muscular", "superavit"].includes(valor)) return "muscle_gain";
        if (["maintenance", "mantenimiento"].includes(valor)) return "maintenance";
        throw new Error("Selecciona un objetivo nutricional válido.");
    }

    function alturaEnCentimetros(estatura) {
        const valor = Number(estatura);
        return valor > 3 ? valor : valor * 100;
    }

    function seleccionarPrototipo(matriz, perfil) {
        const sexo = normalizarSexo(perfil.sexo);
        const altura = alturaEnCentimetros(perfil.estatura);
        const peso = Number(perfil.peso);
        const edad = Number(perfil.edad);
        exigir(Number.isFinite(altura) && altura >= 120 && altura <= 230, "La estatura debe estar entre 120 y 230 cm.");
        exigir(Number.isFinite(peso) && peso >= 30 && peso <= 350, "El peso debe estar entre 30 y 350 kg.");
        exigir(Number.isFinite(edad) && edad >= 14 && edad <= 100, "La edad debe estar entre 14 y 100 años.");

        const candidatos = matriz.prototypes.filter((prototipo) => prototipo.sex === sexo);
        exigir(candidatos.length > 0, `No hay prototipos para sexo '${sexo}'.`);
        return candidatos
            .map((prototipo) => {
                const referencia = prototipo.reference;
                const distancia = ((altura - referencia.height_cm) / 10) ** 2
                    + ((peso - referencia.weight_kg) / 10) ** 2
                    + (((edad - referencia.age_years) / 10) ** 2) * 0.25;
                return { ...prototipo, distancia: Number(distancia.toFixed(4)) };
            })
            .sort((a, b) => a.distancia - b.distancia)[0];
    }

    function limitar(valor, minimo, maximo) {
        return Math.min(maximo, Math.max(minimo, valor));
    }

    /** @param {MatrizPrototiposNutricionales} documento @param {PerfilNutricionalUsuario} perfil @returns {ObjetivosNutricionales} */
    function calcularObjetivos(documento, perfil) {
        validarMatriz(documento);
        const matriz = documento.nutrition_prototype_matrix;
        const sexo = normalizarSexo(perfil.sexo);
        const nivel = normalizarNivel(perfil.nivel_experiencia);
        const objetivo = normalizarObjetivo(perfil.objetivo_nutricional);
        const peso = Number(perfil.peso);
        const altura = alturaEnCentimetros(perfil.estatura);
        const edad = Number(perfil.edad);
        const frecuencia = Math.trunc(Number(perfil.dias_entrenamiento));
        const factorPorFrecuencia = matriz.energy_model.activity_model.activity_factors[`${frecuencia}_days`];
        const actividadUsuario = Number(perfil.actividad);
        const factorActividad = Number.isFinite(factorPorFrecuencia)
            ? factorPorFrecuencia
            : Number.isFinite(actividadUsuario) && actividadUsuario > 0 ? actividadUsuario : 1.2;
        const factorExperiencia = matriz.energy_model.training_level_adjustment[nivel];
        const tmb = sexo === "male"
            ? (10 * peso) + (6.25 * altura) - (5 * edad) + 5
            : (10 * peso) + (6.25 * altura) - (5 * edad) - 161;
        const tdee = tmb * factorActividad * factorExperiencia;
        const ajusteObjetivo = matriz.energy_model.goal_adjustment[objetivo];
        const rangoProteina = matriz.macro_model.protein.default_range[objetivo];
        const rangoGrasa = matriz.macro_model.fat.default_range;
        const proteinaPorKg = (rangoProteina.min + rangoProteina.max) / 2;
        const grasaPorKg = (rangoGrasa.min + rangoGrasa.max) / 2;
        const proteinas = Math.round(Math.max(rangoProteina.min * peso, limitar(proteinaPorKg * peso, rangoProteina.min * peso, rangoProteina.max * peso)));
        const grasas = Math.round(limitar(grasaPorKg * peso, rangoGrasa.min * peso, rangoGrasa.max * peso));
        const advertencias = [];
        const advertenciasTecnicas = [];
        const caloriasSolicitadas = tdee + ajusteObjetivo;
        const caloriasMinimasDeMacros = (proteinas * 4) + (grasas * 9);
        const pisoCalorico = Math.max(tmb, caloriasMinimasDeMacros);
        const calorias = Math.round(Math.max(caloriasSolicitadas, pisoCalorico));
        exigir(proteinas >= rangoProteina.min * peso, "El objetivo no alcanza el mínimo proteico por kilogramo.");
        if (pisoCalorico > caloriasSolicitadas) {
            advertencias.push("El objetivo calórico se elevó hasta un mínimo compatible con metabolismo basal y proteína/grasa objetivo.");
        }
        if (!matriz.micronutrient_model) {
            advertenciasTecnicas.push("La matriz no contiene micronutrientes por alimento; se conservan los ingredientes y el escalado de porciones se limita a 0,70-1,50.");
        }
        const carbohidratos = Math.max(0, Math.round((calorias - (proteinas * 4) - (grasas * 9)) / 4));
        const prototipo = seleccionarPrototipo(matriz, perfil);
        if (peso < 45 || peso > 140) {
            advertenciasTecnicas.push("El peso está fuera del rango central de prototipos; se seleccionó el más cercano y el cálculo usa tus datos reales.");
        }

        return {
            prototipo_id: prototipo.id,
            perfil_prototipo: prototipo.profile,
            factor_actividad: factorActividad,
            factor_experiencia: factorExperiencia,
            tmb: Math.round(tmb),
            tdee: Math.round(tdee),
            calorias,
            proteinas,
            grasas,
            carbohidratos,
            advertencias,
            metadatos: {
                micronutrient_data_available: Boolean(matriz.micronutrient_model),
                advertencias_tecnicas: advertenciasTecnicas
            }
        };
    }

    function escalarCantidad(alimento, factor) {
        const cantidad = Number(alimento.cantidad);
        if (!Number.isFinite(cantidad) || cantidad <= 0) return alimento.cantidad;
        if (String(alimento.unidad).startsWith("unidad")) return Math.max(1, Math.round(cantidad * factor));
        return Math.max(5, Math.round((cantidad * factor) / 5) * 5);
    }

    function adaptarMenu(documento, menuBase, perfil, caloriasBase) {
        const objetivos = calcularObjetivos(documento, perfil);
        exigir(Array.isArray(menuBase) && menuBase.length === Number(documento.nutrition_prototype_matrix.monthly_plan.duration_days), "El menú base debe contener los 28 días requeridos.");
        const comidasEsperadas = Number(documento.nutrition_prototype_matrix.meal_structure.meals_per_day);
        menuBase.forEach((dia, indice) => {
            exigir(Array.isArray(dia.comidas) && dia.comidas.length === comidasEsperadas, `El día ${indice + 1} debe contener ${comidasEsperadas} comidas.`);
            dia.comidas.forEach((comida) => {
                exigir(typeof comida.receta_id === "string" && comida.receta_id.trim(), `La comida '${comida.comida}' no tiene un ID de receta válido.`);
                exigir(Array.isArray(comida.alimentos), `La comida '${comida.comida}' debe incluir ingredientes.`);
            });
        });
        if (documento.nutrition_prototype_matrix.monthly_plan.meal_variety_required
            && !documento.nutrition_prototype_matrix.monthly_plan.repeat_exact_week) {
            const firmasDia = new Set(menuBase.map((dia) => dia.comidas.map((comida) => comida.plato || comida.comida).join("|")));
            exigir(firmasDia.size === menuBase.length, "El plan mensual requiere una combinación de comidas distinta para cada día.");
        }
        const advertencias = [...objetivos.advertencias];
        const advertenciasTecnicas = [...objetivos.metadatos.advertencias_tecnicas];
        const menu = menuBase.map((diaBase, indice) => {
            const baseCalorias = Number(diaBase.calorias || caloriasBase);
            exigir(Number.isFinite(baseCalorias) && baseCalorias > 0, `El día ${indice + 1} no tiene calorías base válidas.`);
            const factorSolicitado = objetivos.calorias / baseCalorias;
            const factorPorciones = limitar(factorSolicitado, FACTOR_ESCALA_MIN, FACTOR_ESCALA_MAX);
            if (factorPorciones !== factorSolicitado) {
                advertenciasTecnicas.push(`Día ${indice + 1}: el factor de porciones se limitó a ${factorPorciones.toFixed(2)} para preservar una escala razonable.`);
            }
            const macrosBase = diaBase.macros || {};
            const comidas = (diaBase.comidas || []).map((comida) => {
                const proporcionCalorias = Number(comida.calorias || 0) / baseCalorias;
                const macros = {};
                for (const [nombre, objetivoMacro] of Object.entries({
                    proteinas: objetivos.proteinas,
                    carbohidratos: objetivos.carbohidratos,
                    grasas: objetivos.grasas
                })) {
                    const macroBase = Number(macrosBase[nombre] || 0);
                    const proporcionMacro = macroBase > 0
                        ? Number(comida.macros?.[nombre] || 0) / macroBase
                        : proporcionCalorias;
                    macros[nombre] = Math.round(objetivoMacro * proporcionMacro);
                }
                return {
                    ...comida,
                    calorias: Math.round(objetivos.calorias * proporcionCalorias),
                    macros,
                    alimentos: (comida.alimentos || []).map((alimento) => ({
                        ...alimento,
                        cantidad: escalarCantidad(alimento, factorPorciones)
                    }))
                };
            });
            return {
                ...diaBase,
                dia_numero: Number(diaBase.dia_numero ?? indice + 1),
                calorias: objetivos.calorias,
                macros: {
                    proteinas: objetivos.proteinas,
                    carbohidratos: objetivos.carbohidratos,
                    grasas: objetivos.grasas
                },
                comidas,
                factor_escalado_porciones: Number(factorPorciones.toFixed(3))
            };
        });
        return {
            objetivos,
            advertencias: [...new Set(advertencias)],
            metadatos: {
                ...objetivos.metadatos,
                factor_escalado_minimo: FACTOR_ESCALA_MIN,
                factor_escalado_maximo: FACTOR_ESCALA_MAX,
                advertencias_tecnicas: [...new Set(advertenciasTecnicas)]
            },
            menu
        };
    }

    function obtenerMenuDia(menu, numeroDia) {
        const dia = Math.trunc(Number(numeroDia));
        exigir(Number.isInteger(dia) && dia >= 1 && dia <= 28, "Selecciona un día entre 1 y 28.");
        const seleccionado = menu.find((item, indice) => Number(item.dia_numero ?? indice + 1) === dia);
        exigir(seleccionado, `No hay un menú cargado para el día ${dia}.`);
        return {
            ...seleccionado,
            total_dia: {
                calorias: seleccionado.calorias,
                proteinas: seleccionado.macros?.proteinas || 0,
                carbohidratos: seleccionado.macros?.carbohidratos || 0,
                grasas: seleccionado.macros?.grasas || 0
            }
        };
    }

    window.NutritionalScalingEngine = Object.freeze({
        validarMatriz,
        seleccionarPrototipo,
        calcularObjetivos,
        adaptarMenu,
        obtenerMenuDia
    });
})();
