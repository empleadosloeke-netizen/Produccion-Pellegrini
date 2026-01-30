const GOOGLE_SHEET_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbyvUBHcjf8pl-9wOZK7ADTYiVlLXr49h-dC6f_WH4JpQDpU9LibIT_952x9WDiuEb-LfQ/exec";

let empleadosSeleccionados = [];
let tipoSeleccionado = null;     // 1..9
let accion = null;               // "EMPECE" | "TERMINE" | null
let quick = null;                // "LIMP" | "MOV" | "BANO" | null

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
function setUnidad(n){
  if([1,2,8].includes(n)) unitTitle.innerText = "Uni";
  if([3,4,5,6,7].includes(n)) unitTitle.innerText = "Cajas";
  if(n === 9) unitTitle.innerText = "KG";
}
function disableGrid(gridEl, disabled){
  gridEl.querySelectorAll(".option").forEach(o => {
    if(disabled) o.classList.add("disabled");
    else o.classList.remove("disabled");
  });
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

/* ---------- sector 01–09 (toggle) ---------- */
tipoGrid.querySelectorAll('[data-tipo]').forEach(el => {
  el.addEventListener("click", () => {
    if(quick !== null) return;

    const n = Number(el.getAttribute("data-tipo"));

    // toggle: si clickeo el mismo => deselecciona y habilita quick
    if(tipoSeleccionado === n){
      tipoSeleccionado = null;
      el.classList.remove("active");
      disableGrid(quickGrid, false);
      applyModes();
      validateForm();
      return;
    }

    tipoGrid.querySelectorAll(".option").forEach(o => o.classList.remove("active"));
    el.classList.add("active");
    tipoSeleccionado = n;

    setUnidad(tipoSeleccionado);

    // si elijo sector => bloqueo quick
    disableGrid(quickGrid, true);

    applyModes();
    validateForm();
  });
});

/* ---------- quick Limp/Mov/Baño ---------- */
quickGrid.querySelectorAll('[data-quick]').forEach(el => {
  el.addEventListener("click", () => {
    if(tipoSeleccionado !== null) return;

    const q = el.getAttribute("data-quick");
    if(quick === q){
      quick = null;
      el.classList.remove("active");
      disableGrid(tipoGrid, false);
    }else{
      quick = q;
      quickGrid.querySelectorAll(".option").forEach(o => o.classList.remove("active"));
      el.classList.add("active");

      // si elijo quick => bloqueo sector
      disableGrid(tipoGrid, true);
    }

    applyModes();
    validateForm();
  });
});

/* ---------- checkbox no code ---------- */
noCodeChk.addEventListener("change", () => {
  if(quick !== null){
    noCodeChk.checked = true;
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

/* ---------- aplicar modos (normal vs quick) ---------- */
function applyModes(){
  codeInput.value = "";
  detailInput.value = "";
  qtyInput.value = "";

  if(quick !== null){
    optionsScreen.classList.add("quick-mode");
    optionsScreen.classList.remove("no-code-mode");

    noCodeChk.checked = true;
    noCodeChk.disabled = true;

    formBody.classList.remove("mode-code");
    formBody.classList.add("mode-nocode");

    if(quick === "MOV"){
      detailInput.style.display = "block";
      detailInput.placeholder = "Descripción (qué hizo)";
    }else{
      detailInput.style.display = "none";
      detailInput.placeholder = "Detalle / Observación";
    }

    formBody.classList.add("qty-hidden");
    formBody.classList.remove("qty-right");

    if(unitSlotHeader.contains(unitTitle)) unitSlotHeader.innerHTML = "";
    if(qtyBox.contains(unitTitle)) qtyBox.removeChild(unitTitle);

  }else{
    optionsScreen.classList.remove("quick-mode");
    noCodeChk.disabled = false;

    // NO forzar display en normal (CSS manda)
    detailInput.style.removeProperty("display");
    detailInput.placeholder = "Detalle / Observación";

    if(noCodeChk.checked){
      optionsScreen.classList.add("no-code-mode");
      formBody.classList.remove("mode-code");
      formBody.classList.add("mode-nocode");
    }else{
      optionsScreen.classList.remove("no-code-mode");
      formBody.classList.remove("mode-nocode");
      formBody.classList.add("mode-code");
    }

    applyAccionUI();
  }
}

/* ---------- UI según acción ---------- */
function applyAccionUI(){
  if(quick !== null) return;

  const noHayCodigo = noCodeChk.checked;
  formBody.classList.remove("qty-hidden", "qty-right");

  if(accion === "TERMINE"){
    if(noHayCodigo){
      if(unitTitle.parentElement !== qtyBox) qtyBox.prepend(unitTitle);
      unitSlotHeader.innerHTML = "";
    }else{
      formBody.classList.add("qty-right");
      unitSlotHeader.innerHTML = "";
      unitSlotHeader.appendChild(unitTitle);
    }
  }else{
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
  const areaOk = (tipoSeleccionado !== null) || (quick !== null);
  const accionOk = (accion === "EMPECE" || accion === "TERMINE");

  if(!areaOk){
    sendBtn.disabled = true;
    if(hintText) hintText.textContent = "Elegí 01–09 o Limp/Mov/Baño";
    return;
  }
  if(!accionOk){
    sendBtn.disabled = true;
    if(hintText) hintText.textContent = "Elegí Empecé o Terminé";
    return;
  }

  if(quick !== null){
    const ok = (quick === "MOV") ? isFilled(detailInput.value) : true;
    sendBtn.disabled = !ok;
    if(hintText) hintText.textContent = ok ? "Listo para enviar" : "Completá la Descripción";
    return;
  }

  const noHayCodigo = noCodeChk.checked;
  const codOk = noHayCodigo ? isFilled(detailInput.value) : isFilled(codeInput.value);
  const cantOk = (accion === "TERMINE") ? isFilled(qtyInput.value) : true;

  const allOk = codOk && cantOk;
  sendBtn.disabled = !allOk;
  if(hintText) hintText.textContent = allOk ? "Listo para enviar" : "Completá lo que falta";
}

/* ---------- envío (NO-CORS) ---------- */
/*
  IMPORTANTE:
  - mode:"no-cors" evita el bloqueo CORS del navegador.
  - PERO la respuesta es "opaque": no se puede leer ni saber si guardó.
  - Para producción con confirmación real, conviene n8n (camino A).
*/
async function postRow(payload){
  await fetch(GOOGLE_SHEET_WEBAPP_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });

  // No podemos validar respuesta. Si no tiró error, asumimos OK.
  return { ok: true };
}

sendBtn.addEventListener("click", async () => {
  validateForm();
  if(sendBtn.disabled){
    alert("Faltan datos.");
    return;
  }

  const t = nowAR();
  const Sector = (quick !== null) ? quick : sector2(tipoSeleccionado);
  const EmpeceTermine = accionLabel();

  let Cod = "";
  let Cant = "";
  let Descripcion = "";

  if(quick !== null){
    if(quick === "MOV") Descripcion = (detailInput.value || "").trim();
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
applyModes();
applyAccionUI();
validateForm();
