// Constantes físicas del Tanque de Gasoil (241 cm x 61 cm x 122 cm)
const GASOIL_LARGO_CM = 241;
const GASOIL_ANCHO_CM = 61;
const GASOIL_ALTURA_CM = 122;
const GASOIL_LITROS_POR_CM = (GASOIL_LARGO_CM * GASOIL_ANCHO_CM) / 1000; // 14.701 L/cm
const GASOIL_CAPACIDAD_MAX = Number((GASOIL_LITROS_POR_CM * GASOIL_ALTURA_CM).toFixed(2)); // 1793.52 L

let gasoilLitrosActuales = 0;

document.addEventListener("DOMContentLoaded", () => {
  const hoyISO = obtenerFechaLocalISO();

  const inputFechaCisterna = document.getElementById("cisterna-fecha");
  if (inputFechaCisterna) inputFechaCisterna.value = hoyISO;

  const inputFechaRecarga = document.getElementById("recarga-gasoil-fecha");
  if (inputFechaRecarga) inputFechaRecarga.value = hoyISO;

  const formCisterna = document.getElementById("form-cisterna");
  if (formCisterna) formCisterna.addEventListener("submit", registrarCisterna);

  const formRecargaGasoil = document.getElementById("form-recarga-gasoil");
  if (formRecargaGasoil) formRecargaGasoil.addEventListener("submit", confirmarRecargaGasoil);

  dibujarEscalaVisorGasoil();
  cargarTodo();
});

async function cargarTodo() {
  await Promise.all([
    cargarMantenimiento(),
    cargarLavanderia(),
    cargarCisternas(),
    cargarGasoil(),
  ]);
}

function obtenerFechaLocalISO(fechaObj = new Date()) {
  const anio = fechaObj.getFullYear();
  const mes = String(fechaObj.getMonth() + 1).padStart(2, "0");
  const dia = String(fechaObj.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

function formatearNumero(valor) {
  return Number(valor).toLocaleString("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ==========================================
// 0. TANQUE DE GASOIL (VISOR 10 CM + MODAL RECARGA)
// ==========================================
function dibujarEscalaVisorGasoil() {
  const regleta = document.getElementById("gasoil-regleta");
  const lineasInternas = document.getElementById("gasoil-lineas-internas");
  if (!regleta || !lineasInternas) return;

  regleta.innerHTML = "";
  lineasInternas.innerHTML = "";

  // Marcas: 0, 10, 20, ..., 120 y tope 122 cm
  const marcas = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 122];

  marcas.forEach((cm) => {
    const pctBottom = (cm / GASOIL_ALTURA_CM) * 100;
    const litrosMarca = cm * GASOIL_LITROS_POR_CM;
    const esTope = cm === 122;

    // Línea horizontal dentro del visor
    lineasInternas.innerHTML += `
      <div
        style="bottom: ${pctBottom}%;"
        class="absolute left-0 right-0 border-t ${esTope ? "border-red-400 border-dashed" : "border-slate-400/50"}">
      </div>
    `;

    // Etiqueta exterior en cm y Litros
    regleta.innerHTML += `
      <div
        style="bottom: ${pctBottom}%; transform: translateY(50%);"
        class="absolute left-0 right-0 flex items-center gap-1.5 leading-none">
        <span class="w-2.5 h-[1.5px] bg-slate-500 inline-block shrink-0"></span>
        <span class="font-bold text-slate-700 w-11 shrink-0">${cm} cm</span>
        <span class="text-slate-500">→</span>
        <span class="font-semibold ${esTope ? "text-amber-700 font-bold" : "text-slate-700"}">
          ${formatearNumero(litrosMarca)} L
        </span>
      </div>
    `;
  });
}

async function cargarGasoil() {
  const { data, error } = await supabaseClient
    .from("tanque_gasoil")
    .select("*")
    .eq("id", 1)
    .single();

  if (error) {
    console.error("Error cargando gasoil:", error);
    return;
  }

  gasoilLitrosActuales = Math.min(GASOIL_CAPACIDAD_MAX, Math.max(0, Number(data.litros_actuales) || 0));
  const porcentaje = (gasoilLitrosActuales / GASOIL_CAPACIDAD_MAX) * 100;
  const alturaCm = gasoilLitrosActuales / GASOIL_LITROS_POR_CM;
  const espacioLibre = Math.max(0, GASOIL_CAPACIDAD_MAX - gasoilLitrosActuales);
  const esCritico = porcentaje <= 20;

  const liquidoEl = document.getElementById("gasoil-liquido");
  liquidoEl.style.height = `${porcentaje.toFixed(1)}%`;
  liquidoEl.className = `w-full transition-all duration-500 border-t-2 ${
    esCritico
      ? "bg-red-500/85 border-red-700"
      : "bg-amber-400/90 border-amber-600"
  }`;

  document.getElementById("gasoil-litros-txt").textContent = `${formatearNumero(gasoilLitrosActuales)} L`;
  document.getElementById("gasoil-pct-txt").textContent = `${porcentaje.toFixed(1)}%`;
  document.getElementById("gasoil-cm-txt").textContent = `${alturaCm.toFixed(1)} cm`;
  document.getElementById("gasoil-libre-txt").textContent = `${formatearNumero(espacioLibre)} L`;
  document.getElementById("gasoil-actualizado").textContent = data.actualizado_en
    ? `Act: ${formatearFecha(data.actualizado_en)}`
    : "";

  window._alertasGasoil = esCritico
    ? [`Planta Eléctrica - Gasoil al ${porcentaje.toFixed(1)}% (${formatearNumero(gasoilLitrosActuales)} L) — Solicitar suministro`]
    : [];

  renderizarPanelAlertas();
  cargarHistorialGasoil();
}

async function cargarHistorialGasoil() {
  const { data, error } = await supabaseClient
    .from("recargas_gasoil")
    .select("*")
    .order("fecha", { ascending: false })
    .order("id", { ascending: false })
    .limit(8);

  if (error) return console.error("Error cargando historial de gasoil:", error);

  const lista = document.getElementById("lista-recargas-gasoil");
  lista.innerHTML = "";

  if (!data || !data.length) {
    lista.innerHTML = `<p class="py-3 text-center text-slate-400">Sin recargas de gasoil registradas.</p>`;
    return;
  }

  data.forEach((rec) => {
    lista.innerHTML += `
      <div class="py-2 flex items-center justify-between gap-2">
        <div>
          <span class="font-bold text-amber-800">+${formatearNumero(rec.litros_agregados)} L</span>
          <span class="text-slate-500"> → Total: ${formatearNumero(rec.litros_resultantes)} L</span>
          ${rec.observacion ? `<span class="block text-[11px] text-slate-400">${rec.observacion}</span>` : ""}
        </div>
        <span class="text-[11px] font-semibold text-slate-400 shrink-0">${formatearFecha(rec.fecha)}</span>
      </div>
    `;
  });
}

async function guardarLecturaCm() {
  const cm = parseFloat(document.getElementById("input-gasoil-cm").value);
  if (isNaN(cm) || cm < 0 || cm > GASOIL_ALTURA_CM) {
    alert(`Ingrese una altura válida entre 0 y ${GASOIL_ALTURA_CM} cm.`);
    return;
  }
  const litrosCalculados = Number((cm * GASOIL_LITROS_POR_CM).toFixed(2));
  await actualizarLitrosGasoil(litrosCalculados);
  document.getElementById("input-gasoil-cm").value = "";
}

async function guardarLecturaLitros() {
  const litros = parseFloat(document.getElementById("input-gasoil-litros").value);
  if (isNaN(litros) || litros < 0 || litros > GASOIL_CAPACIDAD_MAX) {
    alert(`Ingrese una cantidad válida entre 0 y ${GASOIL_CAPACIDAD_MAX} litros.`);
    return;
  }
  await actualizarLitrosGasoil(Number(litros.toFixed(2)));
  document.getElementById("input-gasoil-litros").value = "";
}

async function actualizarLitrosGasoil(nuevosLitros) {
  await supabaseClient
    .from("tanque_gasoil")
    .update({
      litros_actuales: nuevosLitros,
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", 1);

  cargarGasoil();
}

// Funciones del Modal de Recarga de Gasoil
function abrirModalGasoil() {
  const espacioLibre = Math.max(0, Number((GASOIL_CAPACIDAD_MAX - gasoilLitrosActuales).toFixed(2)));
  document.getElementById("modal-gasoil-actual").textContent = `${formatearNumero(gasoilLitrosActuales)} L`;
  document.getElementById("modal-gasoil-max").textContent = `${formatearNumero(espacioLibre)} L`;

  const inputLitros = document.getElementById("recarga-gasoil-litros");
  inputLitros.max = espacioLibre;
  inputLitros.value = "";
  document.getElementById("recarga-gasoil-obs").value = "";

  document.getElementById("modal-gasoil").classList.remove("hidden");
}

function cerrarModalGasoil() {
  document.getElementById("modal-gasoil").classList.add("hidden");
}

function llenarCompletoModalGasoil() {
  const espacioLibre = Math.max(0, Number((GASOIL_CAPACIDAD_MAX - gasoilLitrosActuales).toFixed(2)));
  document.getElementById("recarga-gasoil-litros").value = espacioLibre;
}

async function confirmarRecargaGasoil(event) {
  event.preventDefault();

  const fecha = document.getElementById("recarga-gasoil-fecha").value;
  const litrosAgregar = parseFloat(document.getElementById("recarga-gasoil-litros").value);
  const observacion = document.getElementById("recarga-gasoil-obs").value.trim();

  if (isNaN(litrosAgregar) || litrosAgregar <= 0) return;

  const nuevosLitros = Math.min(
    GASOIL_CAPACIDAD_MAX,
    Number((gasoilLitrosActuales + litrosAgregar).toFixed(2))
  );

  await supabaseClient
    .from("tanque_gasoil")
    .update({
      litros_actuales: nuevosLitros,
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", 1);

  await supabaseClient
    .from("recargas_gasoil")
    .insert([{
      fecha,
      litros_agregados: Number(litrosAgregar.toFixed(2)),
      litros_resultantes: nuevosLitros,
      observacion,
    }]);

  cerrarModalGasoil();
  cargarGasoil();
}

// ==========================================
// 1. AGUA (MANUAL) Y GAS (-2% DIARIO)
// ==========================================
function calcularPorcentajeGas(porcentajeBase, fechaBaseStr) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fechaBase = new Date(fechaBaseStr + "T00:00:00");
  const diasTranscurridos = Math.max(0, Math.floor((hoy - fechaBase) / (1000 * 60 * 60 * 24)));
  const descuento = diasTranscurridos * 2;
  return Math.max(0, porcentajeBase - descuento);
}

async function cargarMantenimiento() {
  const { data, error } = await supabaseClient
    .from("mantenimiento_recursos")
    .select("*")
    .order("id", { ascending: true });

  if (error) return console.error("Error cargando mantenimiento:", error);

  const contAgua = document.getElementById("contenedor-agua");
  const contGas = document.getElementById("contenedor-gas");
  const graficoBarras = document.getElementById("grafico-barras");

  contAgua.innerHTML = "";
  contGas.innerHTML = "";
  graficoBarras.innerHTML = "";

  const alertasGas = [];

  data.forEach((item) => {
    const esAgua = item.categoria === "agua";
    const porcentajeReal = esAgua
      ? item.porcentaje_base
      : calcularPorcentajeGas(item.porcentaje_base, item.fecha_base);

    const esAlertaGas = !esAgua && porcentajeReal <= 20;
    if (esAlertaGas) {
      alertasGas.push(`Gas - ${item.nombre} al ${porcentajeReal}% (Solicitar recarga)`);
    }

    let colorBarraGrafico = esAgua ? "bg-sky-400" : "bg-amber-400";
    if (esAlertaGas) {
      colorBarraGrafico = "bg-red-500";
    } else if (item.en_uso) {
      colorBarraGrafico = "bg-emerald-500";
    }

    graficoBarras.innerHTML += `
      <div class="flex flex-col items-center">
        <div class="mb-2 flex items-center gap-1.5">
          <span class="text-sm font-extrabold ${esAlertaGas ? "text-red-600" : "text-slate-800"}">${porcentajeReal}%</span>
          ${item.en_uso ? `<span class="w-2 h-2 rounded-full bg-emerald-500" title="En uso"></span>` : ""}
        </div>
        <div class="w-16 sm:w-20 h-44 bg-stone-100 border border-stone-200 rounded-xl p-1 flex items-end justify-center overflow-hidden">
          <div class="${colorBarraGrafico} w-full rounded-lg transition-all duration-500" style="height: ${porcentajeReal}%"></div>
        </div>
        <span class="mt-2.5 text-xs font-bold text-slate-700 text-center">${item.nombre}</span>
        <span class="text-[11px] font-semibold ${item.en_uso ? "text-emerald-600" : "text-slate-400"}">
          ${item.en_uso ? "● En uso" : "En reserva"}
        </span>
      </div>
    `;

    const bordeTarjeta = item.en_uso
      ? "border-emerald-400 bg-emerald-50/30"
      : "border-stone-200 bg-stone-50/50";

    const cardHTML = `
      <div class="p-4 rounded-xl border-2 transition-all ${bordeTarjeta}">
        <div class="flex items-center justify-between gap-2 mb-2">
          <div>
            <h4 class="font-bold text-slate-800 text-sm">${item.nombre}</h4>
            <span class="text-[11px] text-slate-400">
              ${esAgua ? "Control manual" : `Base: ${item.porcentaje_base}% (${formatearFecha(item.fecha_base)})`}
            </span>
          </div>
          <button 
            onclick="toggleEnUso(${item.id}, ${!item.en_uso})"
            class="px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
              item.en_uso
                ? "bg-emerald-500 text-white shadow-sm"
                : "bg-stone-200 text-slate-600 hover:bg-stone-300"
            }">
            ${item.en_uso ? "● EN USO" : "EN RESERVA"}
          </button>
        </div>

        <div class="flex items-center justify-between text-xs font-semibold mb-1.5">
          <span class="text-slate-500">Porcentaje</span>
          <span class="text-base font-extrabold ${porcentajeReal <= 20 ? "text-red-600" : "text-slate-800"}">${porcentajeReal}%</span>
        </div>

        <div class="w-full bg-stone-200 rounded-full h-2.5 mb-3 overflow-hidden">
          <div class="${colorBarraGrafico} h-2.5 rounded-full transition-all duration-300" style="width: ${porcentajeReal}%"></div>
        </div>

        <div class="flex items-center gap-2">
          <input 
            type="range" min="0" max="100" value="${porcentajeReal}"
            onchange="actualizarRecursoManual(${item.id}, this.value)"
            class="w-full h-2 bg-stone-200 rounded-lg cursor-pointer"
          />
          <button 
            onclick="pedirPorcentajeRecurso(${item.id}, '${item.nombre}', ${porcentajeReal})"
            class="text-[11px] bg-white border border-stone-300 px-2.5 py-1 rounded-md font-bold hover:bg-stone-100 cursor-pointer shrink-0">
            Editar %
          </button>
          <button 
            onclick="actualizarRecursoManual(${item.id}, 100)"
            class="text-[11px] bg-white border border-stone-300 px-2.5 py-1 rounded-md font-bold hover:bg-stone-100 cursor-pointer shrink-0">
            100%
          </button>
        </div>
      </div>
    `;

    if (esAgua) contAgua.innerHTML += cardHTML;
    else contGas.innerHTML += cardHTML;
  });

  window._alertasGas = alertasGas;
  renderizarPanelAlertas();
}

async function toggleEnUso(id, nuevoEstado) {
  await supabaseClient
    .from("mantenimiento_recursos")
    .update({ en_uso: nuevoEstado, actualizado_en: new Date().toISOString() })
    .eq("id", id);

  cargarMantenimiento();
}

async function actualizarRecursoManual(id, nuevoPorcentaje) {
  const hoyISO = obtenerFechaLocalISO();
  await supabaseClient
    .from("mantenimiento_recursos")
    .update({
      porcentaje_base: parseInt(nuevoPorcentaje, 10),
      fecha_base: hoyISO,
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", id);

  cargarMantenimiento();
}

async function pedirPorcentajeRecurso(id, nombre, actual) {
  const entrada = prompt(`Porcentaje actual de ${nombre} (0 - 100):`, actual);
  if (entrada === null) return;
  const valor = parseInt(entrada, 10);
  if (isNaN(valor) || valor < 0 || valor > 100) return;
  await actualizarRecursoManual(id, valor);
}

// ==========================================
// 2. REGISTRO DIARIO DE CISTERNAS
// ==========================================
async function registrarCisterna(event) {
  event.preventDefault();

  const fecha = document.getElementById("cisterna-fecha").value;
  const cantidad = parseInt(document.getElementById("cisterna-cantidad").value, 10);
  const destino = document.getElementById("cisterna-destino").value.trim() || "Tanque Externo";

  if (!fecha || isNaN(cantidad) || cantidad <= 0) return;

  const { error } = await supabaseClient
    .from("suministro_cisternas")
    .insert([{ fecha, cantidad, destino }]);

  if (error) return console.error("Error registrando cisterna:", error);

  document.getElementById("cisterna-cantidad").value = 1;
  document.getElementById("cisterna-destino").value = "";
  cargarCisternas();
}

async function eliminarCisterna(id) {
  if (!confirm("¿Eliminar este registro de cisterna?")) return;

  await supabaseClient
    .from("suministro_cisternas")
    .delete()
    .eq("id", id);

  cargarCisternas();
}

async function cargarCisternas() {
  const { data, error } = await supabaseClient
    .from("suministro_cisternas")
    .select("*")
    .order("fecha", { ascending: false })
    .order("id", { ascending: false });

  if (error) return console.error("Error cargando cisternas:", error);

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const hoyISO = obtenerFechaLocalISO(hoy);

  const inicioSemana = new Date(hoy);
  const diaSemana = inicioSemana.getDay();
  const diffLunes = diaSemana === 0 ? -6 : 1 - diaSemana;
  inicioSemana.setDate(inicioSemana.getDate() + diffLunes);
  const inicioSemanaISO = obtenerFechaLocalISO(inicioSemana);

  const prefijoMes = hoyISO.slice(0, 7);

  let totalHoy = 0;
  let totalSemana = 0;
  let totalMes = 0;

  data.forEach((reg) => {
    const cant = Number(reg.cantidad) || 0;
    if (reg.fecha === hoyISO) totalHoy += cant;
    if (reg.fecha >= inicioSemanaISO && reg.fecha <= hoyISO) totalSemana += cant;
    if (reg.fecha.startsWith(prefijoMes)) totalMes += cant;
  });

  document.getElementById("cisternas-hoy").textContent = totalHoy;
  document.getElementById("cisternas-semana").textContent = totalSemana;
  document.getElementById("cisternas-mes").textContent = totalMes;

  const lista = document.getElementById("lista-cisternas");
  lista.innerHTML = "";

  if (!data.length) {
    lista.innerHTML = `<p class="py-3 text-center text-slate-400">Sin cisternas registradas todavía.</p>`;
    return;
  }

  data.slice(0, 12).forEach((reg) => {
    lista.innerHTML += `
      <div class="py-2 flex items-center justify-between gap-2">
        <div>
          <span class="font-bold text-slate-800">${reg.cantidad} cisterna(s)</span>
          <span class="text-slate-400">· ${reg.destino || "General"}</span>
          <span class="block text-[11px] text-slate-400">${formatearFecha(reg.fecha)}</span>
        </div>
        <button
          onclick="eliminarCisterna(${reg.id})"
          title="Eliminar registro"
          class="text-xs text-stone-400 hover:text-red-600 px-2 py-1 rounded cursor-pointer">
          ✕
        </button>
      </div>
    `;
  });
}

// ==========================================
// 3. LAVANDERÍA (MANUAL + ALERTA <= 20%)
// ==========================================
async function cargarLavanderia() {
  const { data, error } = await supabaseClient
    .from("lavanderia_insumos")
    .select("*")
    .order("id", { ascending: true });

  if (error) return console.error("Error cargando lavandería:", error);

  const etiquetasProductos = {
    alpha: "(Detergente)",
    beta: "(Incrementador)",
    hypo: "(Blanqueador)",
    ecosoft: "(Suavisante)",
  };

  const contLav = document.getElementById("contenedor-lavanderia");
  contLav.innerHTML = "";
  const alertasLav = [];

  data.forEach((prod) => {
    const porcentaje = prod.porcentaje;
    const esCritico = porcentaje <= 20;
    const clave = (prod.nombre || "").trim().toLowerCase();
    const subtipo = etiquetasProductos[clave] || "";

    if (esCritico) {
      alertasLav.push(`Lavandería - ${prod.nombre} al ${porcentaje}% (Solicitar suministro)`);
    }

    contLav.innerHTML += `
      <div class="bg-white p-4 rounded-2xl border-2 transition-all card-shadow flex flex-col justify-between ${
        esCritico ? "border-red-400 bg-red-50/30" : "border-stone-200/80"
      }">
        <div>
          <div class="flex items-center justify-between gap-2 mb-1">
            <h4 class="font-bold text-slate-800 text-base flex items-baseline gap-1.5 flex-wrap">
              <span>${prod.nombre}</span>
              ${
                subtipo
                  ? `<span class="text-xs font-normal text-slate-400">${subtipo}</span>`
                  : ""
              }
            </h4>
            ${
              esCritico
                ? `<span class="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">ALERTA ≤ 20%</span>`
                : `<span class="bg-emerald-50 text-emerald-700 text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0">ÓPTIMO</span>`
            }
          </div>
          <p class="text-xs text-slate-400 mb-3">Duración ref.: ${prod.duracion_texto}</p>

          <div class="flex items-end justify-between mb-1.5">
            <span class="text-xs text-slate-500">Nivel manual</span>
            <span class="text-2xl font-extrabold ${esCritico ? "text-red-600" : "text-slate-800"}">${porcentaje}%</span>
          </div>

          <div class="w-full bg-stone-200 rounded-full h-2.5 mb-3 overflow-hidden">
            <div class="${esCritico ? "bg-red-500" : "bg-teal-500"} h-2.5 rounded-full transition-all" style="width: ${porcentaje}%"></div>
          </div>

          <input 
            type="range" min="0" max="100" value="${porcentaje}"
            onchange="actualizarLavanderiaManual(${prod.id}, this.value)"
            class="w-full h-2 bg-stone-200 rounded-lg cursor-pointer mb-3"
          />
        </div>

        <div class="pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
          <button 
            onclick="pedirPorcentajeLavanderia(${prod.id}, '${prod.nombre}', ${porcentaje})"
            class="text-xs text-slate-600 hover:text-slate-900 underline cursor-pointer font-medium">
            Ingresar %
          </button>
          <button 
            onclick="actualizarLavanderiaManual(${prod.id}, 100)"
            class="bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer">
            Reponer 100%
          </button>
        </div>
      </div>
    `;
  });

  window._alertasLav = alertasLav;
  renderizarPanelAlertas();
}

async function actualizarLavanderiaManual(id, nuevoPorcentaje) {
  await supabaseClient
    .from("lavanderia_insumos")
    .update({
      porcentaje: parseInt(nuevoPorcentaje, 10),
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", id);

  cargarLavanderia();
}

async function pedirPorcentajeLavanderia(id, nombre, actual) {
  const entrada = prompt(`Porcentaje manual de ${nombre} (0 - 100):`, actual);
  if (entrada === null) return;
  const valor = parseInt(entrada, 10);
  if (isNaN(valor) || valor < 0 || valor > 100) return;
  await actualizarLavanderiaManual(id, valor);
}

function renderizarPanelAlertas() {
  const todas = [
    ...(window._alertasGasoil || []),
    ...(window._alertasGas || []),
    ...(window._alertasLav || []),
  ];
  const panel = document.getElementById("panel-alarmas");
  const lista = document.getElementById("lista-alarmas");
  const badge = document.getElementById("badge-alertas");
  const texto = document.getElementById("texto-alertas");

  lista.innerHTML = "";
  if (todas.length > 0) {
    panel.classList.remove("hidden");
    badge.classList.remove("hidden");
    texto.textContent = `${todas.length} alerta(s) ≤ 20%`;
    todas.forEach((msg) => {
      const li = document.createElement("li");
      li.textContent = msg;
      lista.appendChild(li);
    });
  } else {
    panel.classList.add("hidden");
    badge.classList.add("hidden");
  }
}

function formatearFecha(isoString) {
  if (!isoString) return "";
  const soloFecha = isoString.includes("T") ? isoString : `${isoString}T00:00:00`;
  const d = new Date(soloFecha);
  return d.toLocaleDateString("es-VE", { day: "2-digit", month: "short" });
}