const GOOGLE_SHEET_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbyvUBHcjf8pl-9wOZK7ADTYiVlLXr49h-dC6f_WH4JpQDpU9LibIT_952x9WDiuEb-LfQ/exec";

let empleadosSeleccionados = [];
let tipoSeleccionado = null;
let accion = null;      // "EMPECE" | "TERMINE" | null
let quick = null;       // "LIMP" | "MOV" | "BANO" | null

const empleadoScreen = document.getElementById("empleadoScreen");
const optionsScreen  = document.getElementById("optionsScreen");

const acceptEmpleadoBtn = document.getElementById("acceptEmpleadoBtn");
const backBtn = document.getElementById("backBtn");
const sendBtn = document.getElementById("sendBtn");

const tipoGrid = document.getElementById("tipoGrid");
const quickGrid = document.getElementById("quickGrid");

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

/* ---------- helpers ---------- */
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
function isFilled(str){ return (str || "").trim().length > 0; }
function sector2(n){ return String(n).padStart(2,"0"); }
function nowAR(){
  const d = new Date();
  const Dia  = d.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
  const Hora = d.toLocaleTimeString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
  return { Dia, Hora };
}
function accionLabel(){
  if(accion === "EMPECE") return "Empecé";
  if(accion === "TERMINE") return "Terminé";
  return "";
}

/* ---------- empleados ---------- */
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

/* ---------- sector 01–09 ---------- */
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

/* ---------- Quick buttons: Limp/Mov/Baño (independientes de 07/08/09) ---------- */
quickGrid.querySelectorAll('[data-quick]').forEach(el => {
  el.addEventListener("click", () => {
    const q = el.getAttribute("data-quick");

    // toggle
    if(quick === q){
      quick = null;
      el.classList.remove("active");
    }else{
      quick = q;
      quickGrid.querySelectorAll(".option").forEach(o => o.classList.remove("active"));
      el.classList.add("active");
    }

    applyQuickUI();
    validateForm();
  });
});

function applyQuickUI(){
  const isQuick = quick !== null;
  optionsScreen.classList.toggle("quick-mode", isQuick);

  // reset inputs
  codeInput.value = "";
  detailInput.value = "";
  qtyInput.value = "";

  if(isQuick){
    // quick anula el flujo de código/cantidad
    noCodeChk.checked = true;
    noCodeChk.disabled = true;

    // modo no-code (para poder usar detail si es MOV)
    formBody.classList.remove("mode-code");
    formBody.classList.add("mode-nocode");

    // ocultar unidad siempre en quick
    if(unitSlotHeader.contains(unitTitle)) unitSlotHeader.innerHTML = "";
    if(qtyBox.contains(unitTitle)) qtyBox.removeChild(unitTitle);

    // cantidad nunca en quick
    formBody.classList.add("qty-hidden");
    formBody.classList.remove("qty-right");

    // Limp/Baño: no escribir nada
    if(quick === "LIMP" || quick === "BANO"){
      detailInput.style.display = "none";
    }

    // Mov: requiere descripción
    if(quick === "MOV"){
      detailInput.style.display = "block";
      detailInput.placeholder = "Descripción (qué hizo)";
    }
  }else{
    // vuelve normal
    noCodeChk.disabled = false;
    detailInput.style.display = "block";
    detailInput.placeholder = "Detalle / Observación";

    // respetar checkbox para modo
    if(noCodeChk.checked){
      formBody.classList.remove("mode-code");
      formBody.classList.add("mode-nocode");
      optionsScreen.classList.add("no-code-mode");
    }else{
      formBody.classList.remove("mode-nocode");
      formBody.classList.add("mode-code");
      optionsScreen.classList.remove("no-code-mode");
    }
  }

  applyAccionUI(); // re-evalúa cantidad/unidad según acción
}

/* ---------- toggle “no hay código” ---------- */
noCodeChk.addEventListener("change", () => {
  if(quick !== null){
    noCodeChk.checked = true; // quick lo fuerza
    return;
  }

  const noHayCodigo = noCodeChk.checked;
  optionsScreen.classList.toggle("no-code-mode", noHayCodigo);

  if(noHayCodigo){
    codeInput.value = "";
    formBody.classList.remove("mode-code");
    formBody.classList.add("mode-nocode");
  }else{
    detailInput.value = "";
    onlyDigits(codeInput);
    formBody.classList.remove("mode-nocode");
    formBody.classList.add("mode-code");
  }

  applyAccionUI();
  validateForm();
});

/* ---------- Empecé / Terminé ---------- */
btnEmpece.addEventListener("click", () => {
  accion = "EMPECE";
  btnEmpece.classList.add("active");
  btnTermine.classList.remove("active");

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

/* ---------- UI según acción ---------- */
function applyAccionUI(){
  const noHayCodigo = noCodeChk.checked;

  // si está en quick: cantidad nunca, unidad nunca
  if(quick !== null){
    formBody.classList.add("qty-hidden");
    formBody.classList.remove("qty-right");
    if(unitSlotHeader.contains(unitTitle)) unitSlotHeader.innerHTML = "";
    if(qtyBox.contains(unitTitle)) qtyBox.removeChild(unitTitle);
    return;
  }

  formBody.classList.remove("qty-hidden", "qty-right");

  if(accion === "TERMINE"){
    // Terminé => cantidad visible
    if(noHayCodigo){
      // no-code => unidad arriba de cantidad centrada
      if(unitTitle.parentElement !== qtyBox) qtyBox.prepend(unitTitle);
      unitSlotHeader.innerHTML = "";
    }else{
      // con código => cantidad derecha + unidad en header
      formBody.classList.add("qty-right");
      unitSlotHeader.innerHTML = "";
      unitSlotHeader.appendChild(unitTitle);
    }
  }else{
    // Empecé o null => ocultar cantidad y unidad
    formBody.classList.add("qty-hidden");
    if(unitSlotHeader.contains(unitTitle)) unitSlotHeader.innerHTML = "";
    if(qtyBox.contains(unitTitle)) qtyBox.removeChild(unitTitle);
    qtyInput.value = "";
  }

  if(accion === null){
    formBody.classList.add("qty-hidden");
    if(unitSlotHeader.contains(unitTitle)) unitSlotHeader.innerHTML = "";
    if(qtyBox.contains(unitTitle)) qtyBox.removeChild(unitTitle);
  }
}

/* ---------- restricciones inputs ---------- */
codeInput.addEventListener("input", () => {
  if(quick === null && !noCodeChk.checked) onlyDigits(codeInput);
  validateForm();
});
detailInput.addEventListener("input", validateForm);
qtyInput.addEventListener("input", () => {
  onlyNumberWithComma(qtyInput);
  validateForm();
});

/* ---------- validación ---------- */
function validateForm(){
  const areaOk = (tipoSeleccionado !== null);
  const accionOk = (accion === "EMPECE" || accion === "TERMINE");

  if(!areaOk){
    sendBtn.disabled = true;
    if(hintText) hintText.textContent = "Elegí el Área";
    return;
  }
  if(!accionOk){
    sendBtn.disabled = true;
    if(hintText) hintText.textContent = "Elegí Empecé o Terminé";
    return;
  }

  let codOk = true;
  let cantOk = true;

  // QUICK MODE
  if(quick !== null){
    // Limp/Baño: nada
    if(quick === "LIMP" || quick === "BANO"){
      codOk = true;
      cantOk = true;
    }
    // Mov: requiere descripción
    if(quick === "MOV"){
      codOk = isFilled(detailInput.value);
      cantOk = true;
    }

    const allOk = areaOk && accionOk && codOk && cantOk;
    sendBtn.disabled = !allOk;
    if(hintText) hintText.textContent = allOk ? "Listo para enviar" : "Completá lo que falta";
    return;
  }

  // NORMAL MODE
  const noHayCodigo = noCodeChk.checked;
  codOk = noHayCodigo ? isFilled(detailInput.value) : isFilled(codeInput.value);
  cantOk = (accion === "TERMINE") ? isFilled(qtyInput.value) : true;

  const allOk = areaOk && accionOk && codOk && cantOk;
  sendBtn.disabled = !allOk;
  if(hintText) hintText.textContent = allOk ? "Listo para enviar" : "Completá lo que falta";
}

/* ---------- envío: FIX CORS (evita preflight) ---------- */
async function postRow(payload){
  const r = await fetch(GOOGLE_SHEET_WEBAPP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });

  const txt = await r.text();

  let out;
  try { out = JSON.parse(txt); }
  catch {
    console.error("Respuesta NO JSON:", txt);
    out = { ok:false, error:"Respuesta no JSON (ver consola). Inicio: " + String(txt).slice(0,180) };
  }

  if(!out.ok){
    console.error("Respuesta error:", out);
    throw new Error(out.error || "No se pudo guardar");
  }
  return out;
}

sendBtn.addEventListener("click", async () => {
  validateForm();
  if(sendBtn.disabled){
    alert("Faltan datos.");
    return;
  }

  const t = nowAR();
  const Sector = sector2(tipoSeleccionado);
  const EmpeceTermine = accionLabel();

  let Cod = "";
  let Cant = "";
  let Descripcion = "";

  if(quick !== null){
    // Limp/Baño: todo vacío
    if(quick === "MOV"){
      Descripcion = (detailInput.value || "").trim();
    } else {
      Descripcion = ""; // nada
    }
    // opcional: si querés registrar qué fue quick, lo metemos en Descripcion o Cod.
    // Por ahora queda vacío tal como pediste.
  }else{
    const noHayCodigo = noCodeChk.checked;
    Cod = noHayCodigo ? "" : (codeInput.value || "").trim();
    Descripcion = noHayCodigo ? (detailInput.value || "").trim() : "";
    Cant = (accion === "TERMINE") ? (qtyInput.value || "").trim() : "";
  }

  const base = {
    Dia: t.Dia,
    Hora: t.Hora,
    Sector,
    Cod,
    EmpeceTermine,
    Cant,
    Descripcion
  };

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

/* ---------- init ---------- */
optionsScreen.classList.toggle("no-code-mode", noCodeChk.checked);
applyQuickUI();
applyAccionUI();
validateForm();
