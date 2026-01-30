const GOOGLE_SHEET_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbyvUBHcjf8pl-9wOZK7ADTYiVlLXr49h-dC6f_WH4JpQDpU9LibIT_952x9WDiuEb-LfQ/exec";

let empleadosSeleccionados = [];
let tipoSeleccionado = null;
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
function isSpecialSector(n){
  return [7,8,9].includes(Number(n));
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

/* ---------- sector ---------- */
tipoGrid.querySelectorAll('[data-tipo]').forEach(el => {
  el.addEventListener("click", () => {
    tipoGrid.querySelectorAll(".option").forEach(o => o.classList.remove("active"));
    el.classList.add("active");

    tipoSeleccionado = Number(el.getAttribute("data-tipo"));

    setUnidad(tipoSeleccionado);
    applySectorRules();
    validateForm();
  });
});

function setUnidad(n){
  if([1,2,8].includes(n)) unitTitle.innerText = "Uni";
  if([3,4,5,6,7].includes(n)) unitTitle.innerText = "Cajas";
  if(n === 9) unitTitle.innerText = "KG";
}

/* ---------- toggle no code ---------- */
noCodeChk.addEventListener("change", () => {
  // si es sector especial, no se permite
  if(isSpecialSector(tipoSeleccionado)){
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

/* ---------- reglas por sector ---------- */
function applySectorRules(){
  const special = isSpecialSector(tipoSeleccionado);
  optionsScreen.classList.toggle("special-sector", special);

  if(special){
    // en 07/08/09 siempre "No hay código"
    noCodeChk.checked = true;
    noCodeChk.disabled = true;
    optionsScreen.classList.add("no-code-mode");

    // siempre modo no-code para poder usar detail si corresponde
    formBody.classList.remove("mode-code");
    formBody.classList.add("mode-nocode");

    // limpiar todo
    codeInput.value = "";
    qtyInput.value = "";

    // ocultar unidad siempre en especiales
    if(unitSlotHeader.contains(unitTitle)) unitSlotHeader.innerHTML = "";
    if(qtyBox.contains(unitTitle)) qtyBox.removeChild(unitTitle);

    // mostrar/ocultar descripción según cuál:
    // 07 Limp y 09 Baño => NO escribir nada
    // 08 Mov => descripción obligatoria
    if(tipoSeleccionado === 8){
      detailInput.placeholder = "Descripción (qué hizo)";
      detailInput.style.display = "block";
    }else{
      detailInput.value = "";
      detailInput.style.display = "none";
    }

    // cantidad: solo si Terminé? -> NO. Para 07/08/09 nunca.
    formBody.classList.add("qty-hidden");
    formBody.classList.remove("qty-right");

  }else{
    // sector normal
    noCodeChk.disabled = false;
    detailInput.style.display = "block";
    detailInput.placeholder = "Detalle / Observación";

    // aplicar modo según checkbox
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

  applyAccionUI();
}

/* ---------- UI según acción ---------- */
function applyAccionUI(){
  const noHayCodigo = noCodeChk.checked;
  const special = isSpecialSector(tipoSeleccionado);

  formBody.classList.remove("qty-hidden", "qty-right");

  // En sectores especiales:
  // - 07 Limp / 09 Baño: nada para completar (solo acción)
  // - 08 Mov: solo descripción (y acción)
  // - cantidad nunca aparece
  if(special){
    formBody.classList.add("qty-hidden");
    if(unitSlotHeader.contains(unitTitle)) unitSlotHeader.innerHTML = "";
    if(qtyBox.contains(unitTitle)) qtyBox.removeChild(unitTitle);
    return;
  }

  // Sector normal
  if(accion === "TERMINE"){
    // Terminé => cantidad visible
    if(noHayCodigo){
      // no-code => unidad arriba de cantidad centrada
      if(unitTitle.parentElement !== qtyBox) qtyBox.prepend(unitTitle);
      unitSlotHeader.innerHTML = "";
      // qty visible (sin qty-hidden)
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

    // Empecé => cantidad no aplica
    qtyInput.value = "";
  }

  // si no eligieron acción aún
  if(accion === null){
    formBody.classList.add("qty-hidden");
    if(unitSlotHeader.contains(unitTitle)) unitSlotHeader.innerHTML = "";
    if(qtyBox.contains(unitTitle)) qtyBox.removeChild(unitTitle);
  }
}

/* ---------- restricciones inputs ---------- */
codeInput.addEventListener("input", () => {
  if(!noCodeChk.checked) onlyDigits(codeInput);
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
  const noHayCodigo = noCodeChk.checked;
  const special = isSpecialSector(tipoSeleccionado);

  let codOk = false;
  let cantOk = true;

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

  if(special){
    // 07 Limp y 09 Baño: nada
    if(tipoSeleccionado === 7 || tipoSeleccionado === 9){
      codOk = true;
    }
    // 08 Mov: descripción obligatoria
    if(tipoSeleccionado === 8){
      codOk = isFilled(detailInput.value);
    }

    // cantidad nunca
    cantOk = true;

  }else{
    // sector normal: código o descripción según checkbox
    codOk = noHayCodigo ? isFilled(detailInput.value) : isFilled(codeInput.value);

    // cantidad solo si Terminé
    cantOk = (accion === "TERMINE") ? isFilled(qtyInput.value) : true;
  }

  const allOk = areaOk && accionOk && codOk && cantOk;
  sendBtn.disabled = !allOk;

  if(hintText){
    hintText.textContent = allOk ? "Listo para enviar" : "Completá lo que falta";
  }
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
  const special = isSpecialSector(tipoSeleccionado);

  const Sector = sector2(tipoSeleccionado);
  const EmpeceTermine = accionLabel();

  let Cod = "";
  let Descripcion = "";
  let Cant = "";

  if(special){
    // 07 Limp / 09 Baño: todo vacío
    if(tipoSeleccionado === 8){
      Descripcion = (detailInput.value || "").trim();
    }
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
applySectorRules();
applyAccionUI();
validateForm();
