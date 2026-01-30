const GOOGLE_SHEET_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbyvUBHcjf8pl-9wOZK7ADTYiVlLXr49h-dC6f_WH4JpQDpU9LibIT_952x9WDiuEb-LfQ/exec";

let empleadosSeleccionados = [];
let tipoSeleccionado = null;

// SIEMPRE deben elegir (aunque “no hay código”)
let accion = null; // "EMPECE" | "TERMINE" | null

const empleadoScreen = document.getElementById("empleadoScreen");
const optionsScreen  = document.getElementById("optionsScreen");

const acceptEmpleadoBtn = document.getElementById("acceptEmpleadoBtn");
const backBtn = document.getElementById("backBtn");
const sendBtn = document.getElementById("sendBtn");

const tipoGrid = document.getElementById("tipoGrid");

const noCodeChk = document.getElementById("noCodeChk");
const btnEmpece = document.getElementById("btnEmpece");
const btnTermine = document.getElementById("btnTermine");

const formBody = document.getElementById("formBody");
const codeInput = document.getElementById("codeInput");
const detailInput = document.getElementById("detailInput");
const qtyBox = document.getElementById("qtyBox");
const unitTitle = document.getElementById("unitTitle");
const unitSlotHeader = document.getElementById("unitSlotHeader");
const qtyInput = document.getElementById("qtyInput");
const hintText = document.getElementById("hintText");

/* ---------------- helpers input ---------------- */
function onlyDigits(el){
  el.value = (el.value || "").replace(/[^\d]/g, "");
}

function onlyNumberWithComma(el){
  let v = (el.value || "");
  v = v.replace(/[^\d,]/g, "");
  const firstComma = v.indexOf(",");
  if(firstComma !== -1){
    v = v.slice(0, firstComma + 1) + v.slice(firstComma + 1).replace(/,/g, "");
  }
  el.value = v;
}

function isFilled(str){
  return (str || "").trim().length > 0;
}

function sector2(n){
  return String(n).padStart(2,"0");
}

function nowAR(){
  const d = new Date();
  const Dia  = d.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
  const Hora = d.toLocaleTimeString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
  return { Dia, Hora };
}

/* ---------------- empleados ---------------- */
document.querySelectorAll('[data-emp]').forEach(el => {
  el.addEventListener("click", () => {
    const n = el.getAttribute("data-emp");
    if(empleadosSeleccionados.includes(n)){
      empleadosSeleccionados = empleadosSeleccionados.filter(x => x !== n);
      el.classList.remove("active");
    }else{
      if(empleadosSeleccionados.length >= 2){
        alert("Máximo 2 personas");
        return;
      }
      empleadosSeleccionados.push(n);
      el.classList.add("active");
    }
    acceptEmpleadoBtn.disabled = (empleadosSeleccionados.length === 0);
  });
});

acceptEmpleadoBtn.addEventListener("click", () => {
  empleadoScreen.classList.add("hidden");
  optionsScreen.classList.remove("hidden");
  validateForm();
});

backBtn.addEventListener("click", () => {
  optionsScreen.classList.add("hidden");
  empleadoScreen.classList.remove("hidden");
  validateForm();
});

/* ---------------- sector 01–09 ---------------- */
tipoGrid.querySelectorAll('[data-tipo]').forEach(el => {
  el.addEventListener("click", () => {
    tipoGrid.querySelectorAll(".option").forEach(o => o.classList.remove("active"));
    el.classList.add("active");
    tipoSeleccionado = Number(el.getAttribute("data-tipo"));
    setUnidad(tipoSeleccionado);
    validateForm();
  });
});

function setUnidad(n){
  if([1,2,8].includes(n)) unitTitle.innerText = "Uni";
  if([3,4,5,6,7].includes(n)) unitTitle.innerText = "Cajas";
  if(n === 9) unitTitle.innerText = "KG";
}

/* ---------------- toggle “no hay código” ---------------- */
noCodeChk.addEventListener("change", () => {
  const noHayCodigo = noCodeChk.checked;

  // clase para CSS (Terminé al lado de Empecé solo en no-code)
  optionsScreen.classList.toggle("no-code-mode", noHayCodigo);

  // limpiar inputs según modo
  if(noHayCodigo){
    codeInput.value = "";
  }else{
    detailInput.value = "";
    onlyDigits(codeInput);
  }

  // cambiar modo layout (solo cambia qué input se ve)
  if(noHayCodigo){
    formBody.classList.remove("mode-code");
    formBody.classList.add("mode-nocode");
  }else{
    formBody.classList.remove("mode-nocode");
    formBody.classList.add("mode-code");
  }

  // aplicar UI según acción elegida (y reglas de cantidad)
  applyAccionUI();
  validateForm();
});

/* ---------------- Empecé / Terminé ---------------- */
btnEmpece.addEventListener("click", () => {
  accion = "EMPECE";
  btnEmpece.classList.add("active");
  btnTermine.classList.remove("active");

  // Empecé => NO cantidad (ni título ni cuadro)
  qtyInput.value = "";
  applyAccionUI();
  validateForm();
});

btnTermine.addEventListener("click", () => {
  accion = "TERMINE";
  btnTermine.classList.add("active");
  btnEmpece.classList.remove("active");

  applyAccionUI();
  validateForm();
});

function applyAccionUI(){
  const noHayCodigo = noCodeChk.checked;

  // reseteo clases de cantidad
  formBody.classList.remove("qty-hidden", "qty-right");

  if(accion === "TERMINE"){
    // Mostrar cantidad
    if(noHayCodigo){
      // No hay código => cantidad centrada y unidad arriba del cuadro
      if(unitTitle.parentElement !== qtyBox){
        qtyBox.prepend(unitTitle);
      }
      unitSlotHeader.innerHTML = "";
      // qty visible (sin qty-hidden)
    }else{
      // Hay código => cantidad a la derecha + unidad en header
      formBody.classList.add("qty-right");
      unitSlotHeader.innerHTML = "";
      unitSlotHeader.appendChild(unitTitle);
    }
  }else{
    // EMPECE o null => ocultar cantidad y ocultar unidad
    formBody.classList.add("qty-hidden");
    if(unitSlotHeader.contains(unitTitle)) unitSlotHeader.innerHTML = "";
    if(qtyBox.contains(unitTitle)) qtyBox.removeChild(unitTitle);
  }

  // Si aún no eligieron acción, también ocultamos cantidad/unidad
  if(accion === null){
    formBody.classList.add("qty-hidden");
    if(unitSlotHeader.contains(unitTitle)) unitSlotHeader.innerHTML = "";
    if(qtyBox.contains(unitTitle)) qtyBox.removeChild(unitTitle);
  }
}

/* ---------------- restricciones de input ---------------- */
codeInput.addEventListener("input", () => {
  // cuando hay código -> solo números
  if(!noCodeChk.checked) onlyDigits(codeInput);
  validateForm();
});

detailInput.addEventListener("input", validateForm);

qtyInput.addEventListener("input", () => {
  onlyNumberWithComma(qtyInput);
  validateForm();
});

/* ---------------- validación ---------------- */
function validateForm(){
  const areaOk = (tipoSeleccionado !== null);
  const accionOk = (accion === "EMPECE" || accion === "TERMINE");

  const noHayCodigo = noCodeChk.checked;

  // Código/Descripción obligatorios según modo
  const codOk = noHayCodigo ? isFilled(detailInput.value) : isFilled(codeInput.value);

  // Cantidad: SOLO si Terminé
  const cantOk = (accion === "TERMINE") ? isFilled(qtyInput.value) : true;

  const allOk = areaOk && accionOk && codOk && cantOk;
  sendBtn.disabled = !allOk;

  if(hintText){
    if(allOk){
      hintText.textContent = "Listo para enviar";
    }else{
      if(!areaOk) {
        hintText.textContent = "Elegí el Área";
      } else if(!accionOk){
        hintText.textContent = "Elegí Empecé o Terminé";
      } else if(!codOk){
        hintText.textContent = noHayCodigo ? "Completá la Descripción" : "Completá el Código";
      } else if(!cantOk){
        hintText.textContent = "Completá la Cantidad";
      } else {
        hintText.textContent = "Completá los datos";
      }
    }
  }
}

/* ---------------- envío a Apps Script ---------------- */
async function postRow(payload){
  const r = await fetch(GOOGLE_SHEET_WEBAPP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const out = await r.json().catch(() => ({ ok:false, error:"Respuesta inválida" }));
  if(!out.ok) throw new Error(out.error || "No se pudo guardar");
  return out;
}

sendBtn.addEventListener("click", async () => {
  validateForm();
  if(sendBtn.disabled){
    alert("Faltan datos.");
    return;
  }

  const t = nowAR();
  const noHayCodigo = noCodeChk.checked;

  const Sector = sector2(tipoSeleccionado);
  const Cod = noHayCodigo ? "" : (codeInput.value || "").trim();
  const Descripcion = noHayCodigo ? (detailInput.value || "").trim() : "";
  const Cant = (accion === "TERMINE") ? (qtyInput.value || "").trim() : "";

  const base = { Dia: t.Dia, Hora: t.Hora, Sector, Cod, Cant, Descripcion };

  try{
    sendBtn.disabled = true;

    // 2 nombres => 2 filas
    for(const emp of empleadosSeleccionados){
      await postRow({ ...base, Empleado: emp });
    }

    alert("Reporte enviado correctamente");
    location.reload();
  }catch(e){
    alert("No se pudo enviar. Revisá WiFi o avisá al supervisor.");
    sendBtn.disabled = false;
  }
});

/* estado inicial */
optionsScreen.classList.toggle("no-code-mode", noCodeChk.checked);
applyAccionUI();
validateForm();
