(() => {
    const FACTOR_PORCION_MINIMO = 0.55;
    const FACTOR_PORCION_MAXIMO = 2.5;
    const CLAVES_MACROS = ["proteinas", "carbohidratos", "grasas"];

    function exigir(condicion, mensaje) {
        if (!condicion) throw new Error(mensaje);
    }

    function normalizar(valor) {
        return String(valor ?? "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replaceAll("_", " ")
            .replaceAll("-", " ")
            .trim();
    }

    function redondear(valor, decimales = 0) {
        const factor = 10 ** decimales;
        return Math.round((Number(valor) + Number.EPSILON) * factor) / factor;
    }

    function limitar(valor, minimo, maximo) {
        return Math.min(maximo, Math.max(minimo, valor));
    }

    function puntoMedio(rango, descripcion) {
        exigir(Array.isArray(rango) && rango.length === 2, `El rango de ${descripcion} no es válido.`);
        const [minimo, maximo] = rango.map(Number);
        exigir(Number.isFinite(minimo) && Number.isFinite(maximo) && minimo > 0 && maximo >= minimo, `El rango de ${descripcion} no es válido.`);
        return (minimo + maximo) / 2;
    }

    async function cargarRecursos() {
        const [respuestaIndice, respuestaImagenes] = await Promise.all([
            fetch("nutrition/nutrition_library_index.json"),
            fetch("nutrition/nutrition-images.json")
        ]);
        if (!respuestaIndice.ok || !respuestaImagenes.ok) {
            throw new Error("No se pudieron cargar los datos del plan nutricional.");
        }

        const [indice, imagenes] = await Promise.all([respuestaIndice.json(), respuestaImagenes.json()]);
        const archivosRequeridos = [
            "nutrition_prototypes.json",
            "foods.json",
            "preparations.json",
            "substitutions.json",
            "nutrition_rules.json"
        ];
        exigir(
            Array.isArray(indice.files)
                && indice.files.length === archivosRequeridos.length
                && archivosRequeridos.every((archivo) => indice.files.some((entrada) => entrada.file === archivo)),
            "El índice nutricional debe referenciar los cinco archivos de datos requeridos."
        );
        const archivos = await Promise.all(indice.files.map(async ({ file }) => {
            exigir(typeof file === "string" && /^[A-Za-z0-9_-]+\.json$/.test(file), "El índice nutricional contiene un nombre de archivo no válido.");
            const respuesta = await fetch(`nutrition/${file}`);
            if (!respuesta.ok) throw new Error(`No se pudo cargar la biblioteca nutricional '${file}'.`);
            return [file, await respuesta.json()];
        }));
        const biblioteca = Object.fromEntries(archivos);
        const matriz = adaptarMatriz(indice, biblioteca);
        const catalogos = adaptarCatalogos(biblioteca, imagenes);
        validarRecursos(matriz, catalogos);
        return { matriz, catalogos };
    }

    function adaptarMatriz(indice, biblioteca) {
        const prototipos = biblioteca["nutrition_prototypes.json"];
        const reglas = biblioteca["nutrition_rules.json"];
        exigir(prototipos && reglas, "Faltan prototipos o reglas nutricionales.");
        exigir(
            Array.isArray(prototipos.meal_count_options)
                && prototipos.meal_count_options.every((cantidad) => cantidad >= indice.meal_count.min && cantidad <= indice.meal_count.max)
                && prototipos.meal_count_options.includes(Number(indice.meal_count.default)),
            "El índice y las opciones de comidas no coinciden."
        );

        const ajustes = {};
        const proteinaPorKg = {};
        const grasaPorKg = {};
        Object.entries(prototipos.goal_rules || {}).forEach(([objetivo, regla]) => {
            ajustes[objetivo] = Number(regla.energy_adjustment_kcal);
            proteinaPorKg[objetivo] = puntoMedio(regla.protein_g_per_kg, `proteína para ${objetivo}`);
            grasaPorKg[objetivo] = puntoMedio(regla.fat_g_per_kg, `grasa para ${objetivo}`);
        });
        ["muscle_gain", "fat_loss", "recomposition"].forEach((objetivo) => {
            exigir(Number.isFinite(ajustes[objetivo]), `Falta el ajuste energético para '${objetivo}'.`);
            exigir(Number.isFinite(proteinaPorKg[objetivo]) && Number.isFinite(grasaPorKg[objetivo]), `Faltan los macros para '${objetivo}'.`);
        });
        exigir(Number.isFinite(Number(reglas.energy_model?.activity_factor)), "Falta el factor de actividad del modelo energético.");

        const distribuciones = Object.fromEntries(Object.entries(reglas.meal_distribution || {}).map(([cantidad, regla]) => [
            cantidad,
            regla.calorie_percent
        ]));
        return {
            nutrition_prototype_matrix: {
                energy_model: {
                    activity_factor: Number(reglas.energy_model.activity_factor),
                    goal_adjustment_kcal: ajustes
                },
                macro_model: {
                    protein_g_per_kg: proteinaPorKg,
                    fat_g_per_kg: grasaPorKg
                },
                prototypes: (prototipos.profiles || []).map((perfil) => ({
                    id: perfil.id,
                    sex: perfil.sex,
                    reference: {
                        height_cm: perfil.height_cm,
                        weight_kg: perfil.weight_kg,
                        age_years: perfil.age_reference
                    }
                })),
                meal_structure: {
                    allowed_meals_per_day: prototipos.meal_count_options,
                    default_meals_per_day: Number(indice.meal_count.default),
                    distributions: distribuciones
                },
                monthly_plan: { duration_days: Number(reglas.variety?.plan_days) }
            }
        };
    }

    function adaptarCatalogos(biblioteca, imagenes) {
        const alimentosFuente = biblioteca["foods.json"]?.foods;
        const preparacionesFuente = biblioteca["preparations.json"]?.preparations;
        const gruposFuente = biblioteca["substitutions.json"]?.groups;
        exigir(Array.isArray(alimentosFuente) && Array.isArray(preparacionesFuente) && Array.isArray(gruposFuente), "La biblioteca nutricional está incompleta.");

        const alimentosPorGrupo = new Map();
        gruposFuente.forEach((grupo) => {
            exigir(grupo.id && Array.isArray(grupo.food_ids), "Hay un grupo de sustitución no válido.");
            grupo.food_ids.forEach((id) => {
                exigir(!alimentosPorGrupo.has(id), `El alimento '${id}' aparece en más de un grupo de sustitución.`);
                alimentosPorGrupo.set(id, grupo);
            });
        });
        const gruposNutricionales = {
            protein_animal: "proteina",
            eggs: "proteina",
            dairy: "proteina",
            carb_grain: "carbohidrato",
            carb_tuber: "carbohidrato",
            bread: "carbohidrato",
            legume: "carbohidrato",
            fruit: "fruta",
            vegetable: "vegetal",
            fat: "grasa"
        };
        const categoriasNutricionales = {
            animal_protein: "proteina",
            eggs: "proteina",
            dairy: "proteina",
            cereal: "carbohidrato",
            rice: "carbohidrato",
            pasta: "carbohidrato",
            bread: "carbohidrato",
            tuber: "carbohidrato",
            legume: "carbohidrato",
            fruit: "fruta",
            vegetable: "vegetal",
            healthy_fat: "grasa",
            nuts_seeds: "grasa"
        };
        const foods = alimentosFuente.map((alimento) => {
            const grupo = alimentosPorGrupo.get(alimento.id);
            const nutricion = alimento.nutrition_per_100g || {};
            const sustituciones = grupo ? grupo.food_ids.filter((id) => id !== alimento.id) : [];
            return {
                id: alimento.id,
                nombre: alimento.name,
                categoria: alimento.category,
                grupo_sustitucion: grupo?.id || alimento.category,
                grupo_nutricional: gruposNutricionales[grupo?.id] || categoriasNutricionales[alimento.category] || "general",
                calorias: Number(nutricion.kcal),
                proteinas: Number(nutricion.protein_g),
                carbohidratos: Number(nutricion.carbs_g),
                grasas: Number(nutricion.fat_g),
                unidad_medida: alimento.unit,
                etiquetas: alimento.tags || [],
                posibles_sustituciones: sustituciones,
                permitido_en: alimento.allowed_in || {}
            };
        });
        const tiposComida = {
            breakfast: "Desayuno",
            lunch: "Almuerzo",
            snack: "Merienda",
            dinner: "Cena"
        };
        const preparations = preparacionesFuente.map((preparacion) => ({
            id: preparacion.id,
            nombre: preparacion.name,
            categoria: tiposComida[preparacion.meal_type] || preparacion.meal_type,
            tipo_comida: preparacion.meal_type,
            ingredientes: preparacion.ingredients.map((ingrediente) => ({
                alimento_id: ingrediente.food_id,
                cantidad_g: ingrediente.quantity_g
            })),
            etiquetas: preparacion.favorite_match_tags || [],
            metodos_coccion: preparacion.cooking_methods || [],
            alimentos_utilizados: [...new Set(preparacion.ingredients.map((ingrediente) => ingrediente.food_id))],
            soporta_escalado: preparacion.supports_scaling === true,
            soporta_sustitucion: preparacion.supports_substitution === true
        }));
        const reglas = biblioteca["nutrition_rules.json"];
        return {
            foods,
            preparations,
            meal_images: imagenes.meal_images || {},
            reglas,
            grupos_sustitucion: gruposFuente
        };
    }

    function validarRecursos(matriz, catalogos) {
        const datos = matriz?.nutrition_prototype_matrix;
        exigir(Array.isArray(datos?.prototypes) && datos.prototypes.length > 0, "La biblioteca de prototipos está vacía.");
        exigir(Number(datos.monthly_plan?.duration_days) === 28, "La biblioteca debe configurar un plan de 28 días.");
        exigir(Array.isArray(catalogos?.foods) && catalogos.foods.length > 0, "La biblioteca de alimentos está vacía.");
        exigir(Array.isArray(catalogos?.preparations) && catalogos.preparations.length > 0, "La biblioteca de preparaciones está vacía.");
        exigir(
            catalogos?.reglas
                && Array.isArray(catalogos.reglas.variety?.rotate_categories)
                && typeof catalogos.reglas.ui_requirements?.show_image === "boolean",
            "Faltan reglas de generación nutricional."
        );
        const idsPrototipos = new Set();
        datos.prototypes.forEach((prototipo) => {
            exigir(prototipo.id && !idsPrototipos.has(prototipo.id), `El prototipo '${prototipo.id}' está duplicado o no tiene identificador.`);
            idsPrototipos.add(prototipo.id);
            exigir(["male", "female"].includes(prototipo.sex), `El sexo del prototipo '${prototipo.id}' no es válido.`);
            ["height_cm", "weight_kg", "age_years"].forEach((campo) => {
                exigir(Number.isFinite(Number(prototipo.reference[campo])), `El prototipo '${prototipo.id}' tiene una referencia inválida.`);
            });
        });
        exigir(
            Object.keys(catalogos.reglas.generation_score || {}).length === 6
                && Object.values(catalogos.reglas.generation_score).every((peso) => Number.isFinite(Number(peso)) && Number(peso) >= 0)
                && Math.abs(Object.values(catalogos.reglas.generation_score).reduce((suma, peso) => suma + Number(peso), 0) - 1) < 0.001
                && Number(catalogos.reglas.favorite_foods?.max_favorite_items_per_meal) > 0
                && Number(catalogos.reglas.favorite_foods?.priority_boost) >= 0,
            "Las reglas de selección nutricional no son válidas."
        );

        const gruposSustitucion = new Set();
        catalogos.grupos_sustitucion.forEach((grupo) => {
            exigir(grupo.id && !gruposSustitucion.has(grupo.id), `El grupo de sustitución '${grupo.id}' está duplicado o no tiene identificador.`);
            gruposSustitucion.add(grupo.id);
        });
        const alimentos = new Map();
        catalogos.foods.forEach((alimento) => {
            exigir(alimento.id && alimento.nombre && alimento.grupo_sustitucion && alimento.grupo_nutricional, "Cada alimento debe tener identificador, nombre y grupo nutricional.");
            exigir(!alimentos.has(alimento.id), `El alimento '${alimento.id}' está duplicado.`);
            ["calorias", ...CLAVES_MACROS].forEach((clave) => {
                exigir(Number.isFinite(Number(alimento[clave])) && Number(alimento[clave]) >= 0, `El alimento '${alimento.nombre}' tiene un valor nutricional inválido.`);
            });
            alimentos.set(alimento.id, alimento);
        });

        const preparaciones = new Set();
        catalogos.preparations.forEach((preparacion) => {
            exigir(preparacion.id && preparacion.nombre && preparacion.categoria, "Cada preparación debe tener identificador, nombre y categoría.");
            exigir(!preparaciones.has(preparacion.id), `La preparación '${preparacion.id}' está duplicada.`);
            exigir(Array.isArray(preparacion.ingredientes) && preparacion.ingredientes.length > 0, `La preparación '${preparacion.nombre}' no tiene ingredientes.`);
            preparacion.ingredientes.forEach((ingrediente) => {
                exigir(alimentos.has(ingrediente.alimento_id), `No existe el alimento '${ingrediente.alimento_id}' usado por '${preparacion.nombre}'.`);
                exigir(Number.isFinite(Number(ingrediente.cantidad_g)) && Number(ingrediente.cantidad_g) > 0, `La cantidad de un ingrediente de '${preparacion.nombre}' no es válida.`);
                const alimento = alimentos.get(ingrediente.alimento_id);
                exigir(alimento.permitido_en[preparacion.tipo_comida] !== false, `El alimento '${alimento.nombre}' no está permitido en '${preparacion.nombre}'.`);
            });
            const macros = { proteinas: 0, carbohidratos: 0, grasas: 0 };
            preparacion.ingredientes.forEach((ingrediente) => {
                const alimento = alimentos.get(ingrediente.alimento_id);
                CLAVES_MACROS.forEach((macro) => {
                    macros[macro] += Number(alimento[macro]) * Number(ingrediente.cantidad_g) / 100;
                });
            });
            preparacion.macros = Object.fromEntries(CLAVES_MACROS.map((macro) => [macro, redondear(macros[macro])]));
            preparacion.calorias = Math.round(preparacion.macros.proteinas * 4 + preparacion.macros.carbohidratos * 4 + preparacion.macros.grasas * 9);
            preparacion.alimentos_utilizados = [...new Set(preparacion.ingredientes.map((ingrediente) => ingrediente.alimento_id))];
            preparacion.posibles_sustituciones = Object.fromEntries(preparacion.ingredientes.map((ingrediente) => [
                ingrediente.alimento_id,
                alimentos.get(ingrediente.alimento_id).posibles_sustituciones || []
            ]));
            preparaciones.add(preparacion.id);
        });
        catalogos.grupos_sustitucion.forEach((grupo) => grupo.food_ids.forEach((id) => {
            exigir(alimentos.has(id), `El grupo '${grupo.id}' referencia el alimento inexistente '${id}'.`);
        }));
        exigir(
            Object.entries(matriz.nutrition_prototype_matrix.meal_structure.distributions).every(([cantidad, porcentajes]) =>
                Array.isArray(porcentajes)
                    && porcentajes.length === Number(cantidad)
                    && porcentajes.every((valor) => Number.isFinite(Number(valor)) && Number(valor) > 0)
                    && Math.round(porcentajes.reduce((total, valor) => total + Number(valor), 0)) === 100
            ),
            "Las distribuciones de comidas deben sumar 100% para cada frecuencia."
        );
        exigir(
            Number.isFinite(Number(catalogos.reglas.variety.max_same_preparation_per_7_days))
                && Number(catalogos.reglas.variety.max_same_main_protein_consecutive_days) > 0,
            "Los límites de variedad nutricional no son válidos."
        );
        return true;
    }

    function normalizarSexo(sexo) {
        const valor = normalizar(sexo);
        if (["male", "masculino", "hombre", "m"].includes(valor)) return "male";
        if (["female", "femenino", "mujer", "f"].includes(valor)) return "female";
        throw new Error("El sexo debe ser masculino o femenino para calcular el plan nutricional.");
    }

    function normalizarObjetivo(objetivo) {
        const valor = normalizar(objetivo);
        if (["fat loss", "perder grasa", "perdida de grasa", "deficit", "déficit"].includes(valor)) return "fat_loss";
        if (["muscle gain", "surplus", "ganar peso/musculo (superavit)", "ganancia muscular", "superavit", "masa muscular"].includes(valor)) return "muscle_gain";
        if (["maintenance", "mantenimiento", "recomposition", "recomposicion", "tonificar"].includes(valor)) return "recomposition";
        throw new Error("Selecciona un objetivo nutricional válido.");
    }

    function alturaEnCentimetros(estatura) {
        const valor = Number(estatura);
        return valor > 3 ? valor : valor * 100;
    }

    function seleccionarPrototipo(matriz, perfil) {
        const datos = matriz?.nutrition_prototype_matrix;
        const sexo = normalizarSexo(perfil.sexo);
        const altura = alturaEnCentimetros(perfil.estatura);
        const peso = Number(perfil.peso);
        const edad = Number(perfil.edad);
        exigir(Number.isFinite(altura) && altura >= 120 && altura <= 230, "La estatura debe estar entre 120 y 230 cm.");
        exigir(Number.isFinite(peso) && peso >= 30 && peso <= 350, "El peso debe estar entre 30 y 350 kg.");
        exigir(Number.isFinite(edad) && edad >= 14 && edad <= 100, "La edad debe estar entre 14 y 100 años.");

        const candidatos = datos.prototypes.filter((prototipo) => prototipo.sex === sexo);
        exigir(candidatos.length > 0, `No hay prototipos para sexo '${sexo}'.`);
        return candidatos
            .map((prototipo) => {
                const referencia = prototipo.reference;
                const distancia = ((altura - referencia.height_cm) / 10) ** 2
                    + ((peso - referencia.weight_kg) / 10) ** 2
                    + (((edad - referencia.age_years) / 10) ** 2) * 0.25;
                return { ...prototipo, distancia: redondear(distancia, 4) };
            })
            .sort((a, b) => a.distancia - b.distancia)[0];
    }

    function calcularObjetivos(matriz, perfil, objetivoSeleccionado) {
        const datos = matriz?.nutrition_prototype_matrix;
        const sexo = normalizarSexo(perfil.sexo);
        const objetivo = normalizarObjetivo(objetivoSeleccionado);
        const peso = Number(perfil.peso);
        const altura = alturaEnCentimetros(perfil.estatura);
        const edad = Number(perfil.edad);
        exigir(Number.isFinite(altura) && altura >= 120 && altura <= 230, "La estatura debe estar entre 120 y 230 cm.");
        exigir(Number.isFinite(peso) && peso >= 30 && peso <= 350, "El peso debe estar entre 30 y 350 kg.");
        exigir(Number.isFinite(edad) && edad >= 14 && edad <= 100, "La edad debe estar entre 14 y 100 años.");

        const tmb = sexo === "male"
            ? (10 * peso) + (6.25 * altura) - (5 * edad) + 5
            : (10 * peso) + (6.25 * altura) - (5 * edad) - 161;
        const factorActividad = Number(datos.energy_model.activity_factor);
        const tdee = tmb * factorActividad;
        const indiceMasaCorporal = peso / ((altura / 100) ** 2);
        const ajusteObjetivo = Number(datos.energy_model.goal_adjustment_kcal[objetivo]);
        const gramosProteina = Number(datos.macro_model.protein_g_per_kg[objetivo]) * peso;
        const gramosGrasa = Number(datos.macro_model.fat_g_per_kg[objetivo]) * peso;
        const caloriasMinimas = Math.max(tmb, gramosProteina * 4 + gramosGrasa * 9);
        const caloriasSolicitadas = tdee + ajusteObjetivo;
        const calorias = Math.round(Math.max(caloriasSolicitadas, caloriasMinimas));
        const proteinas = Math.round(gramosProteina);
        const grasas = Math.round(gramosGrasa);
        const carbohidratos = Math.max(0, Math.round((calorias - proteinas * 4 - grasas * 9) / 4));
        const prototipo = seleccionarPrototipo(matriz, perfil);

        return {
            prototipo_id: prototipo.id,
            factor_actividad: factorActividad,
            tmb: Math.round(tmb),
            tdee: Math.round(tdee),
            calorias,
            proteinas,
            grasas,
            carbohidratos,
            imc: redondear(indiceMasaCorporal, 1),
            objetivo,
            advertencias: calorias > caloriasSolicitadas
                ? ["La meta se ajustó para no quedar por debajo del metabolismo basal ni de los mínimos de proteína y grasa."]
                : []
        };
    }

    function crearDistribucionComidas(matriz, frecuencia) {
        const estructura = matriz.nutrition_prototype_matrix.meal_structure;
        const valoresPermitidos = estructura.allowed_meals_per_day;
        exigir(valoresPermitidos.includes(Number(frecuencia)), "Selecciona entre 2 y 6 comidas al día.");
        const distribucion = estructura.distributions[String(frecuencia)];
        exigir(Array.isArray(distribucion) && distribucion.length === Number(frecuencia), "La distribución de comidas seleccionada no es válida.");
        const comidasPorFrecuencia = {
            2: ["Desayuno", "Cena"],
            3: ["Desayuno", "Almuerzo", "Cena"],
            4: ["Desayuno", "Almuerzo", "Merienda", "Cena"],
            5: ["Desayuno", "Almuerzo", "Merienda 1", "Merienda 2", "Cena"],
            6: ["Desayuno", "Almuerzo", "Merienda 1", "Merienda 2", "Merienda 3", "Cena"]
        };
        return comidasPorFrecuencia[Number(frecuencia)].map((nombre, indice) => ({
            categoria: nombre.startsWith("Merienda") ? "Merienda" : nombre,
            nombre,
            porcentaje: Number(distribucion[indice])
        }));
    }

    function macroDeEquivalencia(grupo) {
        if (grupo === "proteina") return "proteinas";
        if (grupo === "grasa") return "grasas";
        if (grupo === "carbohidrato" || grupo === "fruta") return "carbohidratos";
        return "calorias";
    }

    function obtenerCantidadSustituida(alimentoBase, alimentoSustituto, cantidad) {
        const macro = macroDeEquivalencia(alimentoBase.grupo_nutricional);
        const valorBase = macro === "calorias" ? alimentoBase.calorias : alimentoBase[macro];
        const valorSustituto = macro === "calorias" ? alimentoSustituto.calorias : alimentoSustituto[macro];
        const proporcion = valorBase > 0 && valorSustituto > 0 ? valorBase / valorSustituto : 1;
        return Math.max(5, Math.round((Number(cantidad) * proporcion) / 5) * 5);
    }

    function calcularIngredientes(preparacion, foodsById, sustituciones = {}, factorPorcion = 1) {
        const macrosTotales = { proteinas: 0, carbohidratos: 0, grasas: 0 };
        const macrosPorGrupo = {};
        let caloriasTotales = 0;
        const alimentos = preparacion.ingredientes.map((ingrediente) => {
            const alimentoBase = foodsById.get(ingrediente.alimento_id);
            const clave = `${preparacion.id}:${ingrediente.alimento_id}`;
            const idSeleccionado = sustituciones[clave] || ingrediente.alimento_id;
            const alimento = foodsById.get(idSeleccionado);
            exigir(alimento, `No se encontró el alimento '${idSeleccionado}'.`);
            if (idSeleccionado !== ingrediente.alimento_id) {
                exigir(preparacion.soporta_sustitucion, `La preparación '${preparacion.nombre}' no permite sustituciones.`);
            }
            exigir(alimento.grupo_sustitucion === alimentoBase.grupo_sustitucion, "La sustitución debe pertenecer al mismo grupo nutricional.");

            const cantidadBase = idSeleccionado === ingrediente.alimento_id
                ? Number(ingrediente.cantidad_g)
                : obtenerCantidadSustituida(alimentoBase, alimento, ingrediente.cantidad_g);
            const factorAlimento = typeof factorPorcion === "number"
                ? factorPorcion
                : Number(factorPorcion[alimento.grupo_nutricional] || factorPorcion.general || 1);
            const cantidad = Math.max(5, Math.round((cantidadBase * factorAlimento) / 5) * 5);
            const grupoMacros = macrosPorGrupo[alimento.grupo_nutricional] || { proteinas: 0, carbohidratos: 0, grasas: 0 };
            CLAVES_MACROS.forEach((macro) => {
                const cantidadMacro = Number(alimento[macro]) * cantidad / 100;
                macrosTotales[macro] += cantidadMacro;
                grupoMacros[macro] += cantidadMacro;
            });
            caloriasTotales += Number(alimento.calorias) * cantidad / 100;
            macrosPorGrupo[alimento.grupo_nutricional] = grupoMacros;
            return {
                alimento_base_id: ingrediente.alimento_id,
                alimento_id: alimento.id,
                nombre: alimento.nombre,
                cantidad,
                unidad: alimento.unidad_medida,
                posibles_sustituciones: alimentoBase.posibles_sustituciones || []
            };
        });

        const macros = Object.fromEntries(CLAVES_MACROS.map((macro) => [macro, redondear(macrosTotales[macro])]));
        const calorias = Math.round(caloriasTotales);
        return { alimentos, macros, calorias, macros_por_grupo: macrosPorGrupo };
    }

    function contarPreferencias(preparacion, favorites, foodsById) {
        const alimentos = preparacion.alimentos_utilizados.map((id) => foodsById.get(id));
        return favorites.filter((preferencia) => alimentos.some((alimento) => {
            const textos = [alimento.id, alimento.nombre, ...(alimento.etiquetas || [])].map(normalizar);
            return textos.some((texto) => texto === preferencia || texto.includes(preferencia) || preferencia.includes(texto));
        })).length;
    }

    function obtenerSustitucionesComida(sustituciones, preparacion, dia, indiceComida) {
        const seleccionadas = {};
        preparacion.ingredientes.forEach((ingrediente) => {
            const clave = `${dia}:${indiceComida}:${preparacion.id}:${ingrediente.alimento_id}`;
            if (sustituciones[clave]) {
                seleccionadas[`${preparacion.id}:${ingrediente.alimento_id}`] = sustituciones[clave];
            }
        });
        return seleccionadas;
    }

    function fraccionDeterminista(texto) {
        let hash = 2166136261;
        for (let indice = 0; indice < texto.length; indice += 1) {
            hash ^= texto.charCodeAt(indice);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0) / 4294967295;
    }

    function obtenerFirmasCategoria(preparacion, categoria, foodsById) {
        if (categoria === "preparation") return [preparacion.id];
        if (categoria === "cooking_method") return preparacion.metodos_coccion || [];
        const grupoNutricional = {
            protein: "proteina",
            carb: "carbohidrato",
            fruit: "fruta",
            vegetable: "vegetal",
            healthy_fat: "grasa"
        }[categoria];
        if (!grupoNutricional) return [];
        return preparacion.alimentos_utilizados
            .map((id) => foodsById.get(id))
            .filter((alimento) => alimento?.grupo_nutricional === grupoNutricional)
            .map((alimento) => alimento.id);
    }

    function seleccionarImagen(catalogos, preparacion, favorites, dia) {
        const imagenes = catalogos.meal_images?.[preparacion.categoria] || [];
        if (!catalogos.reglas.ui_requirements.show_image || !imagenes.length) return "";
        const preparacionNormalizada = normalizar(`${preparacion.nombre} ${(preparacion.etiquetas || []).join(" ")}`);
        const preferidas = imagenes.filter((imagen) => {
            const etiquetas = imagen.tags.map(normalizar);
            return favorites.some((preferencia) => etiquetas.some((etiqueta) => etiqueta.includes(preferencia) || preferencia.includes(etiqueta)))
                || etiquetas.some((etiqueta) => preparacionNormalizada.includes(etiqueta));
        });
        const opciones = preferidas.length ? preferidas : imagenes;
        return opciones[Math.floor(fraccionDeterminista(`${preparacion.id}:${dia}`) * opciones.length)].url;
    }

    function calcularPuntuacion(preparacion, slot, objetivos, preferencias, conteos, recientes, seleccionadas, catalogos, sustituciones, dia, indiceSlot, comidasCategoriaPorDia, cantidadPreparacionesCategoria) {
        const alimentos = new Map(catalogos.foods.map((alimento) => [alimento.id, alimento]));
        const sustitucionesComida = obtenerSustitucionesComida(sustituciones, preparacion, dia, indiceSlot);
        const conteo = calcularIngredientes(preparacion, alimentos, sustitucionesComida);
        const caloriasObjetivo = objetivos.calorias * slot.porcentaje / 100;
        const factor = preparacion.soporta_escalado
            ? limitar(caloriasObjetivo / Math.max(1, conteo.calorias), FACTOR_PORCION_MINIMO, FACTOR_PORCION_MAXIMO)
            : 1;
        const estimado = calcularIngredientes(preparacion, alimentos, sustitucionesComida, factor);
        const diferenciasMacro = CLAVES_MACROS.map((macro) => {
            const objetivoMacro = objetivos[macro] * slot.porcentaje / 100;
            return Math.abs(estimado.macros[macro] - objetivoMacro) / Math.max(12, objetivoMacro);
        });
        const diferenciaCalorias = Math.abs(estimado.calorias - caloriasObjetivo) / Math.max(100, caloriasObjetivo);
        const coincidenciasFavoritas = contarPreferencias(preparacion, preferencias, alimentos);
        const reglas = catalogos.reglas;
        const pesos = reglas.generation_score;
        const maximoFavoritos = Number(reglas.favorite_foods.max_favorite_items_per_meal);
        const favoritosPuntuables = Math.min(maximoFavoritos, coincidenciasFavoritas);
        const conteoUso = conteos.get(preparacion.id) || 0;
        const penalizacionReciente = recientes.includes(preparacion.id) ? 0.6 : 0;
        const penalizacionMismoDia = seleccionadas.has(preparacion.id) ? 1.5 : 0;
        const diasPlan = Number(reglas.variety.plan_days);
        const usosObjetivo = Math.ceil(diasPlan * comidasCategoriaPorDia / cantidadPreparacionesCategoria);
        const penalizacionFrecuencia = Math.min(1, Math.max(0, conteoUso - usosObjetivo + 1) / Math.max(1, usosObjetivo));
        const ajusteMacro = diferenciasMacro[0] * 0.55 + diferenciasMacro[1] * 0.3 + diferenciasMacro[2] * 0.15;
        const ajusteCaloriasMacros = diferenciaCalorias * 0.45 + ajusteMacro * 0.55;
        const prioridadFavoritos = favoritosPuntuables / Math.max(1, maximoFavoritos)
            * Number(reglas.favorite_foods.priority_boost) / 100;
        const alimentosProteicos = preparacion.alimentos_utilizados
            .map((id) => alimentos.get(id))
            .filter((alimento) => alimento?.grupo_nutricional === "proteina");
        const proteinaPrincipal = alimentosProteicos[0]?.id;
        const preparacionesRecientes = new Map(catalogos.preparations.map((item) => [item.id, item]));
        const repeticionesProteina = proteinaPrincipal
            ? recientes.filter((id) => preparacionesRecientes.get(id)?.alimentos_utilizados
                .some((alimentoId) => alimentoId === proteinaPrincipal)).length
            : 0;
        const categoriasComparables = catalogos.reglas.variety.rotate_categories.filter((categoria) =>
            obtenerFirmasCategoria(preparacion, categoria, alimentos).length > 0
        );
        const categoriasRepetidas = categoriasComparables.filter((categoria) => {
            const firmas = obtenerFirmasCategoria(preparacion, categoria, alimentos);
            return recientes.some((id) => {
                const reciente = preparacionesRecientes.get(id);
                return reciente && obtenerFirmasCategoria(reciente, categoria, alimentos)
                    .some((firma) => firmas.includes(firma));
            });
        }).length;
        const balanceCategoria = categoriasRepetidas / Math.max(1, categoriasComparables.length);
        const limiteProteina = Number(reglas.variety.max_same_main_protein_consecutive_days);
        const balanceProteina = Math.min(1, repeticionesProteina / Math.max(1, limiteProteina));
        const desempate = fraccionDeterminista(`${dia}:${indiceSlot}:${preparacion.id}`) * 0.025;
        return Number(pesos.macro_calorie_fit) * ajusteCaloriasMacros
            + Number(pesos.meal_type_fit) * (preparacion.categoria === slot.categoria ? 0 : 1)
            + Number(pesos.variety) * (penalizacionMismoDia + penalizacionFrecuencia)
            + Number(pesos.recency) * (penalizacionReciente ? 1 : 0)
            + Number(pesos.category_balance) * Math.max(balanceCategoria, balanceProteina)
            - Number(pesos.favorite_food_match) * prioridadFavoritos
            + desempate;
    }

    function seleccionarPreparacion(opciones, slot, objetivos, preferencias, conteos, recientes, seleccionadas, catalogos, sustituciones, dia, indiceSlot, comidasCategoriaPorDia) {
        const variedad = catalogos.reglas.variety;
        const preparacionesDeAyer = variedad.avoid_same_preparation_consecutive_days
            ? recientes.slice(-comidasCategoriaPorDia)
            : [];
        const ventanaSemanal = recientes.slice(-7 * comidasCategoriaPorDia);
        const limiteSemanal = Number(variedad.max_same_preparation_per_7_days);
        const opcionesBajoLimite = opciones.filter((preparacion) =>
            ventanaSemanal.filter((id) => id === preparacion.id).length < limiteSemanal
        );
        const opcionesConVariedad = opcionesBajoLimite.length ? opcionesBajoLimite : opciones;
        const opcionesSinRepetir = opcionesConVariedad.filter((preparacion) =>
            !seleccionadas.has(preparacion.id) && !preparacionesDeAyer.includes(preparacion.id)
        );
        const opcionesDisponibles = opcionesSinRepetir.length
            ? opcionesSinRepetir
            : opcionesConVariedad.filter((preparacion) => !seleccionadas.has(preparacion.id));
        const candidatos = opcionesDisponibles.length
            ? opcionesDisponibles
            : opciones.filter((preparacion) => !seleccionadas.has(preparacion.id));
        return [...candidatos].sort((a, b) =>
            calcularPuntuacion(a, slot, objetivos, preferencias, conteos, recientes, seleccionadas, catalogos, sustituciones, dia, indiceSlot, comidasCategoriaPorDia, opciones.length)
            - calcularPuntuacion(b, slot, objetivos, preferencias, conteos, recientes, seleccionadas, catalogos, sustituciones, dia, indiceSlot, comidasCategoriaPorDia, opciones.length)
        )[0];
    }

    function crearComida(preparacion, slot, dia, objetivos, catalogos, sustituciones = {}, factorForzado = null, preferences = []) {
        const foodsById = new Map(catalogos.foods.map((alimento) => [alimento.id, alimento]));
        const base = calcularIngredientes(preparacion, foodsById, sustituciones);
        const caloriasObjetivo = objetivos.calorias * slot.porcentaje / 100;
        const factorPorcion = factorForzado ?? (preparacion.soporta_escalado
            ? limitar(caloriasObjetivo / Math.max(1, base.calorias), FACTOR_PORCION_MINIMO, FACTOR_PORCION_MAXIMO)
            : 1);
        const contenidoInicial = calcularIngredientes(preparacion, foodsById, sustituciones, factorPorcion);
        const proteinaDeAlimentosProteicos = contenidoInicial.macros_por_grupo.proteina?.proteinas || 0;
        const proteinaDeOtrosGrupos = contenidoInicial.macros.proteinas - proteinaDeAlimentosProteicos;
        const proteinaObjetivoComida = objetivos.proteinas * slot.porcentaje / 100;
        const factorProteina = preparacion.soporta_escalado && proteinaDeAlimentosProteicos > 0
            ? limitar(Math.max(1, (proteinaObjetivoComida - proteinaDeOtrosGrupos) / proteinaDeAlimentosProteicos), 1, 1.5)
            : 1;
        const contenidoConProteina = calcularIngredientes(
            preparacion,
            foodsById,
            sustituciones,
            { general: factorPorcion, proteina: factorPorcion * factorProteina }
        );
        const energiaCarbohidratos = ["carbohidrato", "fruta"].reduce((total, grupo) => {
            const macros = contenidoConProteina.macros_por_grupo[grupo] || {};
            return total + (macros.proteinas || 0) * 4 + (macros.carbohidratos || 0) * 4 + (macros.grasas || 0) * 9;
        }, 0);
        const energiaRestante = contenidoConProteina.calorias - energiaCarbohidratos;
        const proporcionCarbohidratos = preparacion.soporta_escalado && energiaCarbohidratos > 0
            ? limitar((caloriasObjetivo - energiaRestante) / energiaCarbohidratos, 0.25, 2.5)
            : 1;
        const factorCarbohidratos = factorPorcion * proporcionCarbohidratos;
        const contenido = calcularIngredientes(preparacion, foodsById, sustituciones, {
            general: factorPorcion,
            proteina: factorPorcion * factorProteina,
            carbohidrato: factorCarbohidratos,
            fruta: factorCarbohidratos
        });
        return {
            receta_id: preparacion.id,
            comida: slot.nombre,
            categoria: preparacion.categoria,
            plato: preparacion.nombre,
            imagen: seleccionarImagen(catalogos, preparacion, preferences, dia),
            calorias: contenido.calorias,
            macros: contenido.macros,
            alimentos: contenido.alimentos,
            factor_porcion: redondear(factorPorcion, 3),
            factor_proteina: redondear(factorProteina, 3),
            factor_carbohidratos: redondear(factorCarbohidratos, 3),
            objetivo_calorias_comida: Math.round(caloriasObjetivo),
            objetivo_proteinas_comida: Math.round(proteinaObjetivoComida),
            etiquetas: preparacion.etiquetas || []
        };
    }

    function sumarMacros(comidas) {
        const totales = { proteinas: 0, carbohidratos: 0, grasas: 0 };
        comidas.forEach((comida) => CLAVES_MACROS.forEach((macro) => {
            totales[macro] += Number(comida.macros[macro]) || 0;
        }));
        return Object.fromEntries(CLAVES_MACROS.map((macro) => [macro, Math.round(totales[macro])]));
    }

    function actualizarTotalesDia(dia) {
        dia.macros = sumarMacros(dia.comidas);
        dia.calorias = dia.comidas.reduce((total, comida) => total + comida.calorias, 0);
        dia.total_dia = { calorias: dia.calorias, ...dia.macros };
        return dia;
    }

    function generarPlan(matriz, catalogos, perfil, objetivoSeleccionado, frecuencia, favoritos = [], sustituciones = {}) {
        validarRecursos(matriz, catalogos);
        const objetivos = calcularObjetivos(matriz, perfil, objetivoSeleccionado);
        const comidasPorDia = crearDistribucionComidas(matriz, Number(frecuencia));
        const preferencias = [...new Set(favoritos.map(normalizar).filter(Boolean))];
        const preparacionesPorCategoria = new Map();
        catalogos.preparations.forEach((preparacion) => {
            const opciones = preparacionesPorCategoria.get(preparacion.categoria) || [];
            opciones.push(preparacion);
            preparacionesPorCategoria.set(preparacion.categoria, opciones);
        });
        comidasPorDia.forEach((slot) => exigir(preparacionesPorCategoria.get(slot.categoria)?.length, `No hay preparaciones para '${slot.categoria}'.`));
        const comidasPorCategoria = new Map();
        comidasPorDia.forEach((slot) => comidasPorCategoria.set(slot.categoria, (comidasPorCategoria.get(slot.categoria) || 0) + 1));

        const conteos = new Map();
        const recientesPorCategoria = new Map();
        const firmasDias = new Set();
        const menu = [];
        const duracionPlan = Number(matriz.nutrition_prototype_matrix.monthly_plan.duration_days);
        for (let numeroDia = 1; numeroDia <= duracionPlan; numeroDia += 1) {
            const seleccionadas = new Set();
            const comidas = comidasPorDia.map((slot, indiceSlot) => {
                const opciones = preparacionesPorCategoria.get(slot.categoria);
                const recientes = recientesPorCategoria.get(slot.categoria) || [];
                const preparacion = seleccionarPreparacion(
                    opciones, slot, objetivos, preferencias, conteos, recientes,
                    seleccionadas, catalogos, sustituciones, numeroDia, indiceSlot,
                    comidasPorCategoria.get(slot.categoria)
                );
                seleccionadas.add(preparacion.id);
                const sustitucionesComida = obtenerSustitucionesComida(sustituciones, preparacion, numeroDia, indiceSlot);
                return crearComida(preparacion, slot, numeroDia, objetivos, catalogos, sustitucionesComida, null, preferencias);
            });
            let firma = comidas.map((comida) => comida.receta_id).join("|");
            if (firmasDias.has(firma)) {
                const indiceUltimaComida = comidas.length - 1;
                const ultimaComida = comidas[indiceUltimaComida];
                const ultimaPreparacion = catalogos.preparations.find((item) => item.id === ultimaComida.receta_id);
                const slot = comidasPorDia[indiceUltimaComida];
                const recientesUltimoGrupo = recientesPorCategoria.get(slot.categoria) || [];
                const preparacionesDeAyer = recientesUltimoGrupo.slice(-comidasPorCategoria.get(slot.categoria));
                const opcionesAlternas = preparacionesPorCategoria.get(slot.categoria)
                    .filter((item) => item.id !== ultimaComida.receta_id
                        && !seleccionadas.has(item.id)
                        && !preparacionesDeAyer.includes(item.id));
                const opcionesOrdenadas = [...opcionesAlternas].sort((a, b) =>
                    calcularPuntuacion(
                        a, slot, objetivos, preferencias, conteos,
                        recientesPorCategoria.get(slot.categoria) || [],
                        seleccionadas, catalogos, sustituciones, numeroDia, indiceUltimaComida,
                        comidasPorCategoria.get(slot.categoria), preparacionesPorCategoria.get(slot.categoria).length
                    ) - calcularPuntuacion(
                        b, slot, objetivos, preferencias, conteos,
                        recientesPorCategoria.get(slot.categoria) || [],
                        seleccionadas, catalogos, sustituciones, numeroDia, indiceUltimaComida,
                        comidasPorCategoria.get(slot.categoria), preparacionesPorCategoria.get(slot.categoria).length
                    )
                );
                const alternativa = opcionesOrdenadas.find((preparacion) =>
                    !firmasDias.has(comidas.map((comida, indice) =>
                        indice === indiceUltimaComida ? preparacion.id : comida.receta_id
                    ).join("|"))
                ) || opcionesOrdenadas[0];
                exigir(alternativa && ultimaPreparacion, `No fue posible variar las preparaciones del día ${numeroDia}.`);
                const sustitucionesAlternas = obtenerSustitucionesComida(sustituciones, alternativa, numeroDia, indiceUltimaComida);
                comidas[indiceUltimaComida] = crearComida(alternativa, slot, numeroDia, objetivos, catalogos, sustitucionesAlternas, null, preferencias);
                seleccionadas.delete(ultimaComida.receta_id);
                seleccionadas.add(alternativa.id);
                firma = comidas.map((comida) => comida.receta_id).join("|");
            }
            exigir(!firmasDias.has(firma), `El plan generó una combinación repetida en el día ${numeroDia}.`);
            firmasDias.add(firma);
            comidas.forEach((comida, indiceComida) => {
                const slot = comidasPorDia[indiceComida];
                const recientes = recientesPorCategoria.get(slot.categoria) || [];
                conteos.set(comida.receta_id, (conteos.get(comida.receta_id) || 0) + 1);
                recientes.push(comida.receta_id);
                const longitudHistorial = 7 * (comidasPorCategoria.get(slot.categoria) || 1);
                while (recientes.length > longitudHistorial) recientes.shift();
                recientesPorCategoria.set(slot.categoria, recientes);
            });

            const dia = actualizarTotalesDia({
                dia: `Día ${numeroDia}`,
                dia_numero: numeroDia,
                comidas
            });
            menu.push(dia);
        }

        const caloriasPorcentaje = objetivos.calorias > 0 ? objetivos.calorias : 1;
        return {
            objetivos,
            advertencias: objetivos.advertencias,
            distribucion_macros: {
                proteinas: redondear((objetivos.proteinas * 4 / caloriasPorcentaje) * 100),
                carbohidratos: redondear((objetivos.carbohidratos * 4 / caloriasPorcentaje) * 100),
                grasas: redondear((objetivos.grasas * 9 / caloriasPorcentaje) * 100)
            },
            menu
        };
    }

    function obtenerOpcionesSustitucion(catalogos, alimentoId, preparacionId = null) {
        const alimentos = new Map(catalogos.foods.map((alimento) => [alimento.id, alimento]));
        const alimento = alimentos.get(alimentoId);
        exigir(alimento, `No se encontró el alimento '${alimentoId}'.`);
        const preparacion = preparacionId
            ? catalogos.preparations.find((item) => item.id === preparacionId)
            : null;
        if (preparacionId && !preparacion) throw new Error(`No se encontró la preparación '${preparacionId}'.`);
        if (preparacion && !preparacion.soporta_sustitucion) return [];
        const ids = [alimentoId, ...(alimento.posibles_sustituciones || [])];
        return [...new Set(ids)]
            .map((id) => alimentos.get(id))
            .filter((opcion) => opcion && opcion.grupo_sustitucion === alimento.grupo_sustitucion);
    }

    function aplicarSustitucion(menu, catalogos, numeroDia, indiceComida, alimentoBaseId, alimentoNuevoId, sustituciones = {}) {
        const dia = menu.find((item) => item.dia_numero === Number(numeroDia));
        exigir(dia, `No se encontró el día ${numeroDia}.`);
        const comida = dia.comidas[Number(indiceComida)];
        exigir(comida, "No se encontró la comida seleccionada.");
        const preparacion = catalogos.preparations.find((item) => item.id === comida.receta_id);
        exigir(preparacion, "No se encontró la preparación seleccionada.");
        const ingrediente = preparacion.ingredientes.find((item) => item.alimento_id === alimentoBaseId);
        exigir(ingrediente, "El ingrediente ya no pertenece a esta preparación.");
        const opciones = obtenerOpcionesSustitucion(catalogos, alimentoBaseId);
        exigir(opciones.some((item) => item.id === alimentoNuevoId), "El alimento elegido no es una sustitución equivalente disponible.");

        const clave = `${Number(numeroDia)}:${Number(indiceComida)}:${preparacion.id}:${alimentoBaseId}`;
        if (alimentoNuevoId === alimentoBaseId) delete sustituciones[clave];
        else sustituciones[clave] = alimentoNuevoId;
        const sustitucionesComida = obtenerSustitucionesComida(sustituciones, preparacion, numeroDia, indiceComida);

        const foodsById = new Map(catalogos.foods.map((alimento) => [alimento.id, alimento]));
        const factorBase = comida.factor_porcion;
        const contenidoConProteina = calcularIngredientes(preparacion, foodsById, sustitucionesComida, {
            general: factorBase,
            proteina: factorBase * comida.factor_proteina
        });
        const energiaCarbohidratos = ["carbohidrato", "fruta"].reduce((total, grupo) => {
            const macros = contenidoConProteina.macros_por_grupo[grupo] || {};
            return total + (macros.proteinas || 0) * 4 + (macros.carbohidratos || 0) * 4 + (macros.grasas || 0) * 9;
        }, 0);
        const energiaRestante = contenidoConProteina.calorias - energiaCarbohidratos;
        const proporcionCarbohidratos = energiaCarbohidratos > 0
            ? limitar((comida.objetivo_calorias_comida - energiaRestante) / energiaCarbohidratos, 0.25, 2.5)
            : 1;
        const factorCarbohidratos = factorBase * proporcionCarbohidratos;
        const contenido = calcularIngredientes(preparacion, foodsById, sustitucionesComida, {
            general: factorBase,
            proteina: factorBase * comida.factor_proteina,
            carbohidrato: factorCarbohidratos,
            fruta: factorCarbohidratos
        });
        comida.alimentos = contenido.alimentos;
        comida.macros = contenido.macros;
        comida.calorias = contenido.calorias;
        comida.factor_carbohidratos = redondear(factorCarbohidratos, 3);
        comida.etiquetas = preparacion.etiquetas || [];
        actualizarTotalesDia(dia);
        return { dia, comida, sustituciones };
    }

    window.NutritionalScalingEngine = Object.freeze({
        cargarRecursos,
        validarRecursos,
        seleccionarPrototipo,
        calcularObjetivos,
        generarPlan,
        obtenerOpcionesSustitucion,
        aplicarSustitucion
    });
})();
