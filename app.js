const GOOGLE_SHEET_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbyx3BgnhoWqEWSlYfKC6SrPEPqV9BxOoQtLbqRdzokhdCMAgbLwICtq3zmqlE6-XBgb/exec";

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

/* ===================== LOCAL STORAGE ===================== */
const LS_NUM_BASE     = "tn_last_num_v1";       // {sector:"05", started:true, hsInicio:"12:01:02"}
const LS_NUM_PAY_BASE = "tn_last_num_pay_v1";   // payload del último EMPECE numérico (para terminar rápido)
const LS_DEAD_BASE    = "tn_last_dead_v1";      // {dead:"LIMP", started:true, hsInicio:"..."}

function lsGet(key, fallback=null){
  try{ const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch{ return fallback; }
}
function lsSet(key, val){ localStorage.setItem(key, JSON.stringify(val)); }
function lsDel(key){ localStorage.removeItem(key); }

function empKeyFromSelected(list){
  const arr = (list || []).map(x => String(x).trim()).filter(Boolean).sort();
  return arr.join("|"); // ordenado => no importa el orden
}
function lsKey(base){
  const k = empKeyFromSelected(empleadosSeleccionados);
  return `${base}::${k || "__global__"}`;
}
function lsGetK(base, fallback=null){ return lsGet(lsKey(base), fallback); }
function lsSetK(base, val){ lsSet(lsKey(base), val); }
function lsDelK(base){ lsDel(lsKey(base)); }

function getLocks(){
  return {
    dead:   lsGetK(LS_DEAD_BASE, null),
    num:    lsGetK(LS_NUM_BASE, null),
    numPay: lsGetK(LS_NUM_PAY_BASE, null)
  };
}

/* ===================== HELPERS ===================== */
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

/* ===================== Botón Terminar rápido (solo UI) ===================== */
function removeQuickFinishBtn(){
  const b = document.getElementById("quickFinishBtn");
  if(b) b.remove();
}

function renderQuickFinishBtn(){
  removeQuickFinishBtn();

  // solo lo mostramos cuando estamos en optionsScreen visible
  if(optionsScreen.classList.contains("hidden")) return;

  const { dead, num, numPay } = getLocks();
  if(dead?.started) return;                 // si hay tiempo muerto, no se ofrece
  if(!num?.started) return;                // si no hay sector iniciado, no se ofrece
  if(!numPay || numPay.sector !== num.sector) return;

  const btn = document.createElement("button");
  btn.id = "quickFinishBtn";
  btn.type = "button";
  btn.textContent = `Terminar rápido sector ${num.sector}`;
  btn.style.cssText =
    "width:100%;margin-top:12px;padding:12px;border-radius:12px;border:none;background:#1e293b;color:#fff;font-weight:800;cursor:pointer;";

  btn.addEventListener("click", () => {
    // forzar selección sector
    quick = null;
    quickGrid.querySelectorAll(".option").forEach(o => o.classList.remove("active"));
    disableGrid(tipoGrid, false);

    const n = Number(num.sector);
    tipoSeleccionado = n;

    tipoGrid.querySelectorAll(".option").forEach(o => {
      const nn = Number(o.getAttribute("data-tipo"));
      o.classList.toggle("active", nn === n);
    });

    setUnidad(n);

    // restaurar modo usado en el EMPECE
    const usedNoCode = !!numPay.usedNoCode;
    noCodeChk.checked = usedNoCode;
    optionsScreen.classList.toggle("no-code-mode", usedNoCode);

    if(usedNoCode){
      formBody.classList.remove("mode-code");
      formBody.classList.add("mode-nocode");
      detailInput.value = numPay.Descripcion || "";
      codeInput.value = "";
    }else{
      formBody.classList.remove("mode-nocode");
      formBody.classList.add("mode-code");
      codeInput.value = (numPay.Cod || "");
      detailInput.value = "";
    }

    // acción Terminé
    accion = "TERMINE";
    btnTermine.classList.add("active");
    btnEmpece.classList.remove("active");

    qtyInput.value = "";

    applyAccionUI();
    applyLocksToUI();
    validateForm();
    qtyInput.focus();
  });

  // lo insertamos debajo del header del optionsScreen
  const anchor = optionsScreen.querySelector(".screen-head");
  anchor.insertAdjacentElement("afterend", btn);
}

/* ---------- etiquetas dentro de 01-09 ---------- */
function applyTipoLabels(){
  const labels = {
    1:"Corte", 2:"Grampeado", 3:"Encolado",
    4:"Montaje", 5:"Gancho", 6:"Emblistado",
    7:"Contraido", 8:"Deco", 9:"Loeke"
  };

  tipoGrid.querySelectorAll("[data-tipo]").forEach(el => {
    const n = Number(el.getAttribute("data-tipo"));
    const code = String(n).padStart(2,"0");
    const lab = labels[n] || "";
    el.innerHTML = `
      <div style="font-size:18px;font-weight:800;">${code}</div>
      <div style="font-size:11px;opacity:.75;margin-top:4px;">${lab}</div>
    `;
  });
}

/* ===================== BLOQUEOS ===================== */
function applyLocksToUI(){
  const { dead, num } = getLocks();

  // Si hay tiempo muerto iniciado: bloquear TODO excepto ese quick + Terminé
  if(dead?.started){
    disableGrid(tipoGrid, true);

    quickGrid.querySelectorAll(".option").forEach(o => {
      const q = o.getAttribute("data-quick");
      if(q === dead.dead) o.classList.remove("disabled");
      else o.classList.add("disabled");
    });

    // forzar quick
    quick = dead.dead;
    quickGrid.querySelectorAll(".option").forEach(o => o.classList.toggle("active", o.getAttribute("data-quick") === dead.dead));

    // limpiar sector
    tipoSeleccionado = null;
    tipoGrid.querySelectorAll(".option").forEach(o => o.classList.remove("active"));

    applyModes();

    // solo Terminé
    accion = "TERMINE";
    btnTermine.classList.add("active");
    btnEmpece.classList.remove("active");
    btnEmpece.disabled = true;
    btnTermine.disabled = false;

    validateForm();
    renderQuickFinishBtn();
    return;
  } else {
    btnEmpece.disabled = false;
    btnTermine.disabled = false;
  }

  // Si hay sector iniciado: solo habilitar ese sector, pero quick permitido
  if(num?.started){
    disableGrid(quickGrid, false);

    tipoGrid.querySelectorAll(".option").forEach(o => {
      const n = Number(o.getAttribute("data-tipo"));
      const code = sector2(n);
      if(code === num.sector) o.classList.remove("disabled");
      else o.classList.add("disabled");
    });
  } else {
    // libre total (según selección actual)
    quickGrid.querySelectorAll(".option").forEach(o => o.classList.remove("disabled"));
    tipoGrid.querySelectorAll(".option").forEach(o => o.classList.remove("disabled"));

    if(quick !== null) disableGrid(tipoGrid, true);
    if(tipoSeleccionado !== null) disableGrid(quickGrid, true);
  }

  validateForm();
  renderQuickFinishBtn();
}

/* ===================== EMPLEADOS ===================== */
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

    // actualizar bloqueos y botón rápido según combinación de empleados
    applyLocksToUI();
  });
});

acceptEmpleadoBtn.addEventListener("click", () => {
  empleadoScreen.classList.add("hidden");
  optionsScreen.classList.remove("hidden");
  validateForm();
  applyLocksToUI();
});

backBtn.addEventListener("click", () => {
  optionsScreen.classList.add("hidden");
  empleadoScreen.classList.remove("hidden");
  removeQuickFinishBtn();
  validateForm();
  applyLocksToUI();
});

/* ===================== SECTOR 01–09 (TOGGLE) ===================== */
tipoGrid.querySelectorAll('[data-tipo]').forEach(el => {
  el.addEventListener("click", () => {
    if(quick !== null) return;

    const n = Number(el.getAttribute("data-tipo"));

    // toggle off
    if(tipoSeleccionado === n){
      tipoSeleccionado = null;
      el.classList.remove("active");
      disableGrid(quickGrid, false);
      applyModes();
      applyLocksToUI();
      validateForm();
      return;
    }

    // seleccionar
    tipoGrid.querySelectorAll(".option").forEach(o => o.classList.remove("active"));
    el.classList.add("active");
    tipoSeleccionado = n;

    setUnidad(tipoSeleccionado);

    // si elijo sector => bloqueo quick
    disableGrid(quickGrid, true);

    applyModes();
    applyLocksToUI();
    validateForm();
  });
});

/* ===================== QUICK Limp/Mov/Baño ===================== */
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
    applyLocksToUI();
    validateForm();
  });
});

/* ===================== CHECKBOX NO CODE ===================== */
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
  applyLocksToUI();
  validateForm();
});

/* ===================== Empecé / Terminé ===================== */
btnEmpece.addEventListener("click", () => {
  accion = "EMPECE";
  btnEmpece.classList.add("active");
  btnTermine.classList.remove("active");

  qtyInput.value = "";
  applyAccionUI();
  applyLocksToUI();
  validateForm();
});

btnTermine.addEventListener("click", () => {
  accion = "TERMINE";
  btnTermine.classList.add("active");
  btnEmpece.classList.remove("active");

  applyAccionUI();
  applyLocksToUI();
  validateForm();
});

/* ===================== MODOS ===================== */
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

/* ===================== UI según acción ===================== */
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

/* ===================== INPUTS ===================== */
codeInput.addEventListener("input", () => {
  if(quick === null && !noCodeChk.checked) onlyDigits(codeInput);
  validateForm();
});
detailInput.addEventListener("input", validateForm);
qtyInput.addEventListener("input", () => {
  onlyNumberWithComma(qtyInput);
  validateForm();
});

/* ===================== VALIDACIÓN (con locks) ===================== */
function validateForm(){
  const { dead, num } = getLocks();

  // si hay tiempo muerto iniciado => solo terminar ese mismo
  if(dead?.started){
    const okArea = (quick === dead.dead);
    const okAcc  = (accion === "TERMINE");
    const okMov  = (dead.dead === "MOV") ? isFilled(detailInput.value) : true;

    const allOk = okArea && okAcc && okMov;
    sendBtn.disabled = !allOk;
    if(hintText) hintText.textContent = allOk ? "Listo para finalizar tiempo muerto" : "Debés terminar el tiempo muerto en curso";
    return;
  }

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

  // si hay sector iniciado y estás en sector => solo ese sector
  if(num?.started && quick === null){
    const sel = sector2(tipoSeleccionado);
    if(sel !== num.sector){
      sendBtn.disabled = true;
      if(hintText) hintText.textContent = `Debés terminar el sector ${num.sector} (o usar Limp/Mov/Baño).`;
      return;
    }
  }

  // quick
  if(quick !== null){
    const ok = (quick === "MOV") ? isFilled(detailInput.value) : true;
    sendBtn.disabled = !ok;
    if(hintText) hintText.textContent = ok ? "Listo para enviar" : "Completá la Descripción";
    return;
  }

  // normal
  const noHayCodigo = noCodeChk.checked;
  const codOk = noHayCodigo ? isFilled(detailInput.value) : isFilled(codeInput.value);
  const cantOk = (accion === "TERMINE") ? isFilled(qtyInput.value) : true;

  const allOk = codOk && cantOk;
  sendBtn.disabled = !allOk;
  if(hintText) hintText.textContent = allOk ? "Listo para enviar" : "Completá lo que falta";
}

/* ===================== ENVÍO ===================== */
async function postRow(payload){
  const r = await fetch(GOOGLE_SHEET_WEBAPP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });

  const txt = await r.text();
  let out;
  try { out = JSON.parse(txt); }
  catch { out = { ok:false, error:"Respuesta no JSON: " + String(txt).slice(0,180) }; }

  if(!out.ok) throw new Error(out.error || "No se pudo guardar");
  return out;
}

sendBtn.addEventListener("click", async () => {
  validateForm();
  if(sendBtn.disabled){
    alert("Faltan datos.");
    return;
  }

  const locks = getLocks();

  if(locks.dead?.started){
    if(!(quick === locks.dead.dead && accion === "TERMINE")){
      alert(`Tenés un tiempo muerto en curso (${locks.dead.dead}). Debés terminar ese mismo.`);
      return;
    }
  }

  if(locks.num?.started && quick === null){
    const sel = sector2(tipoSeleccionado);
    if(sel !== locks.num.sector){
      alert(`Tenés un sector en curso (${locks.num.sector}). Debés terminar ese sector (o usar Limp/Mov/Baño).`);
      return;
    }
  }

  const t = nowAR();
  const Sector = (quick !== null) ? quick : sector2(tipoSeleccionado);
  const EmpeceTermine = accionLabel();

  let Cod = "";
  let Cant = "";
  let Descripcion = "";
  let usedNoCode = false;

  if(quick !== null){
    if(quick === "MOV") Descripcion = (detailInput.value || "").trim();
  }else{
    const noHayCodigo = noCodeChk.checked;
    usedNoCode = noHayCodigo;
    Cod = noHayCodigo ? "" : (codeInput.value || "").trim();
    Descripcion = noHayCodigo ? (detailInput.value || "").trim() : "";
    Cant = (accion === "TERMINE") ? (qtyInput.value || "").trim() : "";
  }

  // ====== HsInicio SOLO para "Terminé" ======
  let HsInicio = "";
  if(accion === "TERMINE"){
    if(quick !== null){
      if(locks.dead?.started && locks.dead.dead === quick){
        HsInicio = locks.dead.hsInicio || "";
      }
    }else{
      const sec = sector2(tipoSeleccionado);
      if(locks.num?.started && locks.num.sector === sec){
        HsInicio = locks.num.hsInicio || "";
      }
    }
  }

  const base = { Dia: t.Dia, Hora: t.Hora, Sector, Cod, EmpeceTermine, Cant, Descripcion, HsInicio };

  try{
    sendBtn.disabled = true;

    for(const emp of empleadosSeleccionados){
      await postRow({ ...base, Empleado: emp });
    }

    // tiempo muerto (por combinación) + hsInicio cuando EMPECE
    if(quick !== null){
      if(accion === "EMPECE"){
        lsSetK(LS_DEAD_BASE, { dead: quick, started: true, hsInicio: base.Hora, at: Date.now() });
      }else if(accion === "TERMINE"){
        const d = lsGetK(LS_DEAD_BASE, null);
        if(d?.started && d.dead === quick) lsDelK(LS_DEAD_BASE);
      }
    }

    // sector numérico (por combinación) + hsInicio cuando EMPECE
    if(quick === null && tipoSeleccionado !== null){
      const sec = sector2(tipoSeleccionado);

      if(accion === "EMPECE"){
        lsSetK(LS_NUM_BASE, { sector: sec, started: true, hsInicio: base.Hora, at: Date.now() });
        lsSetK(LS_NUM_PAY_BASE, { sector: sec, Cod, Descripcion, usedNoCode, at: Date.now() });
      }else if(accion === "TERMINE"){
        const n = lsGetK(LS_NUM_BASE, null);
        if(n?.started && n.sector === sec) lsDelK(LS_NUM_BASE);

        const p = lsGetK(LS_NUM_PAY_BASE, null);
        if(p?.sector === sec) lsDelK(LS_NUM_PAY_BASE);
      }
    }

    // actualizar botón rápido (por si cambia el estado)
    renderQuickFinishBtn();

    alert("Reporte enviado correctamente");
    location.reload();

  }catch(e){
    alert("No se pudo enviar. Revisá WiFi o avisá al supervisor.");
    sendBtn.disabled = false;
  }
});

/* ===================== INIT ===================== */
applyTipoLabels();

optionsScreen.classList.toggle("no-code-mode", noCodeChk.checked);
applyModes();
applyAccionUI();
validateForm();

// si ya hay locks guardados para esa combinación, aplicar
applyLocksToUI();

// crea el botón rápido si corresponde (en optionsScreen cuando se abra)
renderQuickFinishBtn();
