document.addEventListener("DOMContentLoaded", () => {
  cargarTodo();
});

async function cargarTodo() {
  await Promise.all([cargarMantenimiento(), cargarLavanderia()]);
}

// ==========================================
// 1. MÓDULO AGUA Y GAS
// ==========================================
async function cargarMantenimiento() {
  const { data, error } = await supabaseClient
    .from("mantenimiento_recursos")
    .select("*")
    .order("id", { ascending: true });

  if (error) return console.error("Error cargando recursos:", error);

  const contAgua = document.getElementById("contenedor-agua");
  const contGas = document.getElementById("contenedor-gas");
  contAgua.innerHTML = "";
  contGas.innerHTML = "";

  data.forEach((item) => {
    const esAgua = item.categoria === "agua";
    const colorBarra = item.en_uso
      ? "bg-emerald-500"
      : esAgua
      ? "bg-sky-400"
      : "bg-amber-400";

    const bordeTarjeta = item.en_uso
      ? "border-emerald-400 bg-emerald-50/40"
      : "border-stone-200 bg-stone-50/50";

    const cardHTML = `
      <div class="p-4 rounded-xl border-2 transition-all ${bordeTarjeta}">
        <div class="flex items-center justify-between mb-2">
          <div>
            <h4 class="font-bold text-slate-800 text-sm">${item.nombre}</h4>
            <span class="text-[11px] text-slate-400">Act: ${formatearFecha(item.actualizado_en)}</span>
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
          <span class="text-slate-500">Nivel actual</span>
          <span class="text-base font-bold ${item.porcentaje <= 20 ? "text-red-600" : "text-slate-800"}">${item.porcentaje}%</span>
        </div>

        <!-- Barra de progreso -->
        <div class="w-full bg-stone-200 rounded-full h-3 mb-3 overflow-hidden">
          <div class="${colorBarra} h-3 rounded-full transition-all duration-300" style="width: ${item.porcentaje}%"></div>
        </div>

        <!-- Control deslizante + botones rápidos -->
        <div class="flex items-center gap-2">
          <input 
            type="range" min="0" max="100" value="${item.porcentaje}"
            onchange="actualizarPorcentaje(${item.id}, this.value)"
            class="w-full h-2 bg-stone-200 rounded-lg cursor-pointer"
          />
          <button 
            onclick="actualizarPorcentaje(${item.id}, 100)"
            title="Llenar al 100%"
            class="text-[11px] bg-white border border-stone-300 px-2 py-1 rounded-md font-semibold hover:bg-stone-100">
            100%
          </button>
        </div>
      </div>
    `;

    if (esAgua) contAgua.innerHTML += cardHTML;
    else contGas.innerHTML += cardHTML;
  });
}

async function toggleEnUso(id, nuevoEstado) {
  await supabaseClient
    .from("mantenimiento_recursos")
    .update({ en_uso: nuevoEstado, actualizado_en: new Date().toISOString() })
    .eq("id", id);

  cargarMantenimiento();
}

async function actualizarPorcentaje(id, nuevoPorcentaje) {
  await supabaseClient
    .from("mantenimiento_recursos")
    .update({
      porcentaje: parseInt(nuevoPorcentaje, 10),
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", id);

  cargarMantenimiento();
}

// ==========================================
// 2. MÓDULO LAVANDERÍA (-2% DIARIO Y ALARMA <= 20%)
// ==========================================
function calcularNivelActual(porcentajeBase, fechaBaseStr) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fechaBase = new Date(fechaBaseStr + "T00:00:00");
  const diffTiempo = hoy - fechaBase;
  const diasTranscurridos = Math.max(0, Math.floor(diffTiempo / (1000 * 60 * 60 * 24)));
  const descuento = diasTranscurridos * 2; // 2% diario
  return Math.max(0, porcentajeBase - descuento);
}

async function cargarLavanderia() {
  const { data, error } = await supabaseClient
    .from("lavanderia_insumos")
    .select("*")
    .order("id", { ascending: true });

  if (error) return console.error("Error cargando lavandería:", error);

  const contLav = document.getElementById("contenedor-lavanderia");
  const panelAlarmas = document.getElementById("panel-alarmas");
  const listaAlarmas = document.getElementById("lista-alarmas");
  const badgeAlertas = document.getElementById("badge-alertas");
  const textoAlertas = document.getElementById("texto-alertas");

  contLav.innerHTML = "";
  listaAlarmas.innerHTML = "";
  let alertasCriticas = [];

  data.forEach((prod) => {
    const nivelReal = calcularNivelActual(prod.porcentaje_base, prod.fecha_base);
    const esCritico = nivelReal <= 20;

    if (esCritico) {
      alertasCriticas.push(`${prod.nombre} está al ${nivelReal}% (Solicitar reposición)`);
    }

    const cardHTML = `
      <div class="bg-white p-4 rounded-2xl border-2 transition-all card-shadow flex flex-col justify-between ${
        esCritico ? "border-red-400 bg-red-50/30" : "border-stone-200/80"
      }">
        <div>
          <div class="flex items-center justify-between mb-1">
            <h4 class="font-bold text-slate-800 text-base">${prod.nombre}</h4>
            ${
              esCritico
                ? `<span class="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full">PEDIR SUMINISTRO</span>`
                : `<span class="bg-emerald-50 text-emerald-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">ÓPTIMO</span>`
            }
          </div>
          <p class="text-xs text-slate-400 mb-4">Rendimiento: ${prod.duracion_texto}</p>

          <div class="flex items-end justify-between mb-1.5">
            <span class="text-xs text-slate-500">Disponible hoy</span>
            <span class="text-2xl font-bold ${esCritico ? "text-red-600" : "text-slate-800"}">${nivelReal}%</span>
          </div>

          <div class="w-full bg-stone-200 rounded-full h-2.5 mb-4 overflow-hidden">
            <div class="${esCritico ? "bg-red-500" : "bg-teal-500"} h-2.5 rounded-full transition-all" style="width: ${nivelReal}%"></div>
          </div>
        </div>

        <div class="pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
          <button 
            onclick="ajustarManualLavanderia(${prod.id}, ${nivelReal})"
            class="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer">
            Ajustar %
          </button>
          <button 
            onclick="reabastecerProducto(${prod.id}, '${prod.nombre}')"
            class="bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer">
            Reponer 100%
          </button>
        </div>
      </div>
    `;
    contLav.innerHTML += cardHTML;
  });

  // Gestión de Alarmas Visuales
  if (alertasCriticas.length > 0) {
    panelAlarmas.classList.remove("hidden");
    badgeAlertas.classList.remove("hidden");
    textoAlertas.textContent = `${alertasCriticas.length} alerta(s) de suministro`;
    alertasCriticas.forEach((msg) => {
      const li = document.createElement("li");
      li.textContent = msg;
      listaAlarmas.appendChild(li);
    });
  } else {
    panelAlarmas.classList.add("hidden");
    badgeAlertas.classList.add("hidden");
  }
}

async function reabastecerProducto(id, nombre) {
  if (!confirm(`¿Confirmar ingreso de nuevo suministro de ${nombre} al 100%?`)) return;

  const hoyISO = new Date().toISOString().split("T")[0];
  await supabaseClient
    .from("lavanderia_insumos")
    .update({
      porcentaje_base: 100,
      fecha_base: hoyISO,
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", id);

  cargarLavanderia();
}

async function ajustarManualLavanderia(id, nivelActual) {
  const nuevoValor = prompt(`Ingrese el porcentaje físico real observado (Actual estimado: ${nivelActual}%):`, nivelActual);
  if (nuevoValor === null || isNaN(nuevoValor) || nuevoValor < 0 || nuevoValor > 100) return;

  const hoyISO = new Date().toISOString().split("T")[0];
  await supabaseClient
    .from("lavanderia_insumos")
    .update({
      porcentaje_base: parseInt(nuevoValor, 10),
      fecha_base: hoyISO,
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", id);

  cargarLavanderia();
}

function formatearFecha(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  return d.toLocaleDateString("es-VE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}