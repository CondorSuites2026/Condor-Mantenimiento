document.addEventListener("DOMContentLoaded", () => {
  const inputFecha = document.getElementById("cisterna-fecha");
  if (inputFecha) {
    inputFecha.value = obtenerFechaLocalISO();
  }

  const formCisterna = document.getElementById("form-cisterna");
  if (formCisterna) {
    formCisterna.addEventListener("submit", registrarCisterna);
  }

  cargarTodo();
});

async function cargarTodo() {
  await Promise.all([
    cargarMantenimiento(),
    cargarLavanderia(),
    cargarCisternas(),
  ]);
}

function obtenerFechaLocalISO(fechaObj = new Date()) {
  const anio = fechaObj.getFullYear();
  const mes = String(fechaObj.getMonth() + 1).padStart(2, "0");
  const dia = String(fechaObj.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

function calcularPorcentajeGas(porcentajeBase, fechaBaseStr) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fechaBase = new Date(fechaBaseStr + "T00:00:00");
  const diasTranscurridos = Math.max(0, Math.floor((hoy - fechaBase) / (1000 * 60 * 60 * 24)));
  const descuento = diasTranscurridos * 2;
  return Math.max(0, porcentajeBase - descuento);
}

// ==========================================
// 1. AGUA (MANUAL) Y GAS (-2% DIARIO)
// ==========================================
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
            onclick="actualizarRecursoManual(${item.id}, 100)"
            class="text-[11px] bg-white border border-stone-300 px-2.5 py-1 rounded-md font-bold hover:bg-stone-100 cursor-pointer">
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

// ==========================================
// 2. REGISTRO DIARIO DE CISTERNAS (SEMANAL / MENSUAL)
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

  if (error) {
    console.error("Error registrando cisterna:", error);
    return;
  }

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

  // Inicio de semana actual (Lunes)
  const inicioSemana = new Date(hoy);
  const diaSemana = inicioSemana.getDay(); // 0 = Domingo, 1 = Lunes...
  const diffLunes = diaSemana === 0 ? -6 : 1 - diaSemana;
  inicioSemana.setDate(inicioSemana.getDate() + diffLunes);
  const inicioSemanaISO = obtenerFechaLocalISO(inicioSemana);

  // Prefijo del mes actual (YYYY-MM)
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

  const contLav = document.getElementById("contenedor-lavanderia");
  contLav.innerHTML = "";
  const alertasLav = [];

  data.forEach((prod) => {
    const porcentaje = prod.porcentaje;
    const esCritico = porcentaje <= 20;

    if (esCritico) {
      alertasLav.push(`Lavandería - ${prod.nombre} al ${porcentaje}% (Solicitar suministro)`);
    }

    contLav.innerHTML += `
      <div class="bg-white p-4 rounded-2xl border-2 transition-all card-shadow flex flex-col justify-between ${
        esCritico ? "border-red-400 bg-red-50/30" : "border-stone-200/80"
      }">
        <div>
          <div class="flex items-center justify-between mb-1">
            <h4 class="font-bold text-slate-800 text-base">${prod.nombre}</h4>
            ${
              esCritico
                ? `<span class="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full">ALERTA ≤ 20%</span>`
                : `<span class="bg-emerald-50 text-emerald-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">ÓPTIMO</span>`
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
  const todas = [...(window._alertasGas || []), ...(window._alertasLav || [])];
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