const GOOGLE_SHEET_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbyx3BgnhoWqEWSlYfKC6SrPEPqV9BxOoQtLbqRdzokhdCMAgbLwICtq3zmqlE6-XBgb/exec";

let empleadosSeleccionados = [];
let tipoSeleccionado = null;     // 1..10
let accion = null;               // "EMPECE" | "TERMINE" | null
let quick = null;                // quick codes

const empleadoScreen = document.getElementById("empleadoScreen");
const optionsScreen  = document.getElementById("optionsScreen");

const acceptEmpleadoBtn = document.getElementById("acceptEmpleadoBtn");
const backBtn = document.getElementById("backBtn");
const sendBtn = document.getElementById("sendBtn");

const tipoGrid  = document.getElementById("tipoGrid");     // 01–09
const quickGrid = document.getElementById("quickGrid");    // Limp/Mov/Baño
const extraGrid = document.getElementById("extraGrid");    // 3 quick + Armado Pedido (10)

const noCodeChk  = document.getElementById("noCodeChk");
const btnEmpece  = document.getElementById("btnEmpece");
const btnTermine = document.getElementById("btnTermine");

const formBody        = document.getElementById("formBody");
const codeInput       = document.getElementById("codeInput");
const detailInput     = document.getElementById("detailInput");
const qtyBox          = document.getElementById("qtyBox");
const unitTitle       = document.getElementById("unitTitle");
const unitSlotHeader  = document.getElementById("unitSlotHeader");
const qtyInput        = document.getElementById("qtyInput");
const hintText        = document.getElementById("hintText");

/* ===================== LOCAL STORAGE ===================== */
const LS_LAST2_BASE    = "tn_last2_Pellegrini_v1";
const LS_NUM_BASE      = "tn_last_num_Pellegrini_v1";
const LS_NUM_PAY_BASE  = "tn_last_num_pay_Pellegrini_v1";
const LS_DEAD_BASE     = "tn_last_dead_Pellegrini_v1";
const LS_DEAD_PAY_BASE = "tn_last_dead_pay_Pellegrini_v1";

function lsGet(key, fallback=null){
  try{ const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch{ return fallback; }
}
function lsSet(key, val){ localStorage.setItem(key, JSON.stringify(val)); }
function lsDel(key){ localStorage.removeItem(key); }

function empKeyFromSelected(list){
  const arr = (list || []).map(x => String(x).trim()).filter(Boolean).sort();
  return arr.join("|");
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
    dead:    lsGetK(LS_DEAD_BASE, null),
    deadPay: lsGetK(LS_DEAD_PAY_BASE, null),
    num:     lsGetK(LS_NUM_BASE, null),
    numPay:  lsGetK(LS_NUM_PAY_BASE, null),
  };
}

/* ===================== HELPERS ===================== */
function onlyDigits(el){ el.value = (el.value || "").replace(/[^\d]/g, ""); }
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
function isArmadoPedido(){
  return quick === null && Number(tipoSeleccionado) === 10;
}

/* ====== UNIDAD DINÁMICA ====== */
function setUnidad(n){
  const { num } = getLocks();

  // Si hay pendiente del 10 (Armado Pedido), mantener N°NP
  if(num?.started && num.sector === "10"){
    unitTitle.innerText = "N°NP";
    return;
  }

  // Si estás en Armado Pedido
  if(Number(n) === 10){
    unitTitle.innerText = "N°NP";
    return;
  }

  // Sectores 01–09
  if([1,2,8].includes(Number(n))) unitTitle.innerText = "Uni";
  else if([3,4,5,6,7].includes(Number(n))) unitTitle.innerText = "Cajas";
  else if(Number(n) === 9) unitTitle.innerText = "KG";
  else unitTitle.innerText = "Uni";
}

function disableGrid(gridEl, disabled){
  if(!gridEl) return;
  gridEl.querySelectorAll(".option").forEach(o => {
    if(disabled) o.classList.add("disabled");
    else o.classList.remove("disabled");
  });
}

function allQuickOptions(){
  return Array.from(document.querySelectorAll('[data-quick]'));
}
function setQuickDisabledAll(disabled){
  allQuickOptions().forEach(o => {
    if(disabled) o.classList.add("disabled");
    else o.classList.remove("disabled");
  });
}
function setQuickDisabledExcept(allowedQuick){
  allQuickOptions().forEach(o => {
    const q = o.getAttribute("data-quick");
    if(q === allowedQuick) o.classList.remove("disabled");
    else o.classList.add("disabled");
  });
}
function setQuickActive(quickValue){
  allQuickOptions().forEach(o => {
    o.classList.toggle("active", o.getAttribute("data-quick") === quickValue);
  });
}

function clearActiveSectors(){
  tipoGrid?.querySelectorAll(".option").forEach(o => o.classList.remove("active"));
  extraGrid?.querySelectorAll("[data-tipo]").forEach(o => o.classList.remove("active"));
}
function setActiveSector(n){
  clearActiveSectors();
  tipoGrid?.querySelectorAll("[data-tipo]").forEach(o => {
    const nn = Number(o.getAttribute("data-tipo"));
    if(nn === n) o.classList.add("active");
  });
  extraGrid?.querySelectorAll("[data-tipo]").forEach(o => {
    const nn = Number(o.getAttribute("data-tipo"));
    if(nn === n) o.classList.add("active");
  });
}

/* al tocar QUICK, limpiar sector */
function clearSectorSelectionForQuick(){
  if(tipoSeleccionado === null) return;
  tipoSeleccionado = null;
  clearActiveSectors();
}

/* ===================== ETIQUETAS 01–09 ===================== */
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

/* ===================== ÚLTIMOS 2 REPORTES ===================== */
function formatMiniRow(r){
  const parts = [
    r.Hora || "",
    r.Empleado || "",
    r.Sector || "",
    (r.Cod ? `Cod:${r.Cod}` : ""),
    (r.EmpeceTermine || ""),
    (r.Descripcion ? `“${r.Descripcion}”` : "")
  ].filter(Boolean);
  return parts.join(" · ");
}

function pushLast2Rows(rows){
  const cur = lsGetK(LS_LAST2_BASE, []);
  const next = [...cur, ...(rows || [])].slice(-2);
  lsSetK(LS_LAST2_BASE, next);
  renderLast2Panel();
}

function renderLast2Panel(){
  const box = document.getElementById("last2Container");
  if(!box) return;

  const last2 = lsGetK(LS_LAST2_BASE, []);

  box.innerHTML = `
    <div style="background:#0b1220;border-radius:12px;padding:10px;font-size:12px;border:1px solid rgba(255,255,255,.08);">
      <div style="font-weight:800;margin-bottom:6px;opacity:.9;">Últimos 2 reportes</div>
      <div id="last2List" style="display:flex;flex-direction:column;gap:4px;opacity:.95;"></div>
    </div>
  `;

  const list = document.getElementById("last2List");
  if(!last2 || !last2.length){
    list.innerHTML = `<div style="opacity:.7">Sin registros</div>`;
    return;
  }

  last2.slice(-2).reverse().forEach(r => {
    const d = document.createElement("div");
    d.textContent = formatMiniRow(r);
    list.appendChild(d);
  });
}

/* ===================== AUTOCOMPLETAR PENDIENTE (Terminé + foco) ===================== */
function selectAccionTermineAndFocusQty(){
  accion = "TERMINE";
  btnTermine.classList.add("active");
  btnEmpece.classList.remove("active");

  applyAccionUI();
  validateForm();

  setTimeout(() => qtyInput?.focus(), 0);
}

function autofillPendingIfAny(){
  const { dead, deadPay, num, numPay } = getLocks();

  // MOV pendiente
  if(dead?.started && dead.dead === "MOV"){
    if(quick === "MOV" && !isFilled(detailInput.value) && deadPay?.Descripcion){
      detailInput.value = deadPay.Descripcion;
    }
    selectAccionTermineAndFocusQty();
    return;
  }

  // sector pendiente (solo si estás en sector)
  if(num?.started && quick === null && tipoSeleccionado !== null){
    const sec = sector2(tipoSeleccionado);
    if(sec === num.sector && numPay && numPay.sector === sec){

      // si es Armado Pedido, NO autocompleta código (porque no se usa)
      if(Number(tipoSeleccionado) === 10){
        selectAccionTermineAndFocusQty();
        return;
      }

      const usedNoCode = !!numPay.usedNoCode;

      noCodeChk.checked = usedNoCode;
      optionsScreen.classList.toggle("no-code-mode", usedNoCode);

      if(usedNoCode){
        formBody.classList.remove("mode-code");
        formBody.classList.add("mode-nocode");
        if(!isFilled(detailInput.value) && isFilled(numPay.Descripcion)) detailInput.value = numPay.Descripcion;
        codeInput.value = "";
      }else{
        formBody.classList.remove("mode-nocode");
        formBody.classList.add("mode-code");
        if(!isFilled(codeInput.value) && isFilled(numPay.Cod)) codeInput.value = numPay.Cod;
        detailInput.value = "";
      }

      selectAccionTermineAndFocusQty();
      return;
    }
  }
}

/* ===================== ACCIONES: bloquear Terminé si no hay pendiente ===================== */
function updateAccionButtons(){
  const { dead, num } = getLocks();

  btnEmpece.disabled = false;
  btnTermine.disabled = false;

  // dead pendiente => solo terminar ese dead
  if(dead?.started){
    btnEmpece.disabled = true;
    btnTermine.disabled = !(quick !== null && quick === dead.dead);
    return;
  }

  // sector pendiente => Terminé solo en ese sector
  if(num?.started){
    if(quick === null && tipoSeleccionado !== null){
      const sec = sector2(tipoSeleccionado);
      const isSame = (sec === num.sector);
      btnEmpece.disabled = isSame;
      btnTermine.disabled = !isSame;
      return;
    }
    if(quick !== null){
      btnEmpece.disabled = false;
      btnTermine.disabled = true; // no hay dead pendiente
      return;
    }
  }

  // no hay pendientes
  if(quick === null && tipoSeleccionado !== null){
    btnEmpece.disabled = false;
    btnTermine.disabled = true;
    return;
  }
  if(quick !== null){
    btnEmpece.disabled = false;
    btnTermine.disabled = true;
    return;
  }
}

/* ===================== UI especial Armado Pedido ===================== */
function applyArmadoPedidoUI(){
  const armado = isArmadoPedido();
  const headLeft = optionsScreen.querySelector(".head-left");

  if(armado){
    optionsScreen.classList.add("armado-head");
    optionsScreen.classList.add("armado-np-row");

    if(headLeft) headLeft.style.display = "none";

    noCodeChk.checked = false;
    noCodeChk.disabled = true;
    optionsScreen.classList.remove("no-code-mode");

    codeInput.style.display = "none";
    detailInput.style.display = "none";

    let lbl = qtyBox.querySelector(".npLabel");
    if(!lbl){
      lbl = document.createElement("div");
      lbl.className = "npLabel";
      lbl.textContent = "N°NP";
      qtyBox.prepend(lbl);
    }

    qtyInput.placeholder = "";
    unitTitle.innerText = "N°NP";

    qtyBox.style.gridColumn = "1 / 4";
  }else{
    optionsScreen.classList.remove("armado-head");
    optionsScreen.classList.remove("armado-np-row");

    if(headLeft) headLeft.style.removeProperty("display");

    noCodeChk.disabled = false;

    if(quick === null){
      codeInput.style.removeProperty("display");
      detailInput.style.removeProperty("display");
    }

    const lbl = qtyBox.querySelector(".npLabel");
    if(lbl) lbl.remove();

    qtyInput.placeholder = "Cantidad";
    qtyBox.style.removeProperty("grid-column");
  }
}

/* ===================== BLOQUEOS ===================== */
function applyLocksToUI(){
  const { dead, num } = getLocks();

  if(dead?.started){
    disableGrid(tipoGrid, true);
    extraGrid?.querySelectorAll("[data-tipo]").forEach(o => o.classList.add("disabled"));

    setQuickDisabledExcept(dead.dead);

    quick = dead.dead;
    setQuickActive(dead.dead);

    tipoSeleccionado = null;
    clearActiveSectors();

    // forzar Terminé
    accion = "TERMINE";
    btnTermine.classList.add("active");
    btnEmpece.classList.remove("active");

    applyModes();
    autofillPendingIfAny();
    updateAccionButtons();
    validateForm();
    return;
  }

  // sector pendiente: solo ese sector habilitado (incluye 10) + quick disponible
  if(num?.started){
    setQuickDisabledAll(false);

    tipoGrid.querySelectorAll(".option").forEach(o => {
      const n = Number(o.getAttribute("data-tipo"));
      const code = sector2(n);
      if(code === num.sector) o.classList.remove("disabled");
      else o.classList.add("disabled");
    });

    extraGrid?.querySelectorAll("[data-tipo]").forEach(o => {
      const n = Number(o.getAttribute("data-tipo"));
      const code = sector2(n);
      if(code === num.sector) o.classList.remove("disabled");
      else o.classList.add("disabled");
    });
  } else {
    // libre total
    setQuickDisabledAll(false);
    tipoGrid.querySelectorAll(".option").forEach(o => o.classList.remove("disabled"));
    extraGrid?.querySelectorAll(".option").forEach(o => o.classList.remove("disabled"));

    // si elegiste quick, bloquea sectores
    if(quick !== null){
      disableGrid(tipoGrid, true);
      extraGrid?.querySelectorAll("[data-tipo]").forEach(o => o.classList.add("disabled"));
    }
  }

  applyArmadoPedidoUI();
  autofillPendingIfAny();
  updateAccionButtons();
  validateForm();
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

    renderLast2Panel();
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
  validateForm();
});

/* ===================== SECTOR 01–09 ===================== */
tipoGrid.querySelectorAll('[data-tipo]').forEach(el => {
  el.addEventListener("click", () => {
    if(quick !== null) return;

    const n = Number(el.getAttribute("data-tipo"));
    const locks = getLocks();

    if(tipoSeleccionado === n){
      if(locks.num?.started && sector2(n) === locks.num.sector) return;

      tipoSeleccionado = null;
      el.classList.remove("active");

      accion = null;
      btnEmpece.classList.remove("active");
      btnTermine.classList.remove("active");

      applyModes();
      applyLocksToUI();
      validateForm();
      return;
    }

    setActiveSector(n);
    tipoSeleccionado = n;

    setUnidad(n);

    accion = null;
    btnEmpece.classList.remove("active");
    btnTermine.classList.remove("active");

    setQuickDisabledAll(false);

    applyModes();
    applyLocksToUI();
    validateForm();
  });
});

/* ===================== SECTOR 10 (Armado Pedido) ===================== */
if(extraGrid){
  extraGrid.querySelectorAll('[data-tipo]').forEach(el => {
    el.addEventListener("click", () => {
      if(quick !== null) return;

      const n = Number(el.getAttribute("data-tipo"));
      const locks = getLocks();

      if(tipoSeleccionado === n){
        if(locks.num?.started && sector2(n) === locks.num.sector) return;

        tipoSeleccionado = null;
        el.classList.remove("active");

        accion = null;
        btnEmpece.classList.remove("active");
        btnTermine.classList.remove("active");

        applyModes();
        applyLocksToUI();
        validateForm();
        return;
      }

      setActiveSector(n);
      tipoSeleccionado = n;

      setUnidad(n);

      accion = null;
      btnEmpece.classList.remove("active");
      btnTermine.classList.remove("active");

      setQuickDisabledAll(false);

      applyModes();
      applyLocksToUI();
      validateForm();
    });
  });
}

/* ===================== QUICK (incluye 3 nuevos) ===================== */
document.querySelectorAll('[data-quick]').forEach(el => {
  el.addEventListener("click", () => {
    const locks = getLocks();

    // permitir pasar a quick aunque esté seleccionado un sector
    if(tipoSeleccionado !== null){
      clearSectorSelectionForQuick();
      disableGrid(tipoGrid, false);
      extraGrid?.querySelectorAll("[data-tipo]").forEach(o => o.classList.remove("disabled"));
    }

    const q = el.getAttribute("data-quick");

    // toggle off
    if(quick === q){
      quick = null;
      el.classList.remove("active");

      accion = null;
      btnEmpece.classList.remove("active");
      btnTermine.classList.remove("active");

      disableGrid(tipoGrid, false);
      extraGrid?.querySelectorAll("[data-tipo]").forEach(o => o.classList.remove("disabled"));

      if(!(locks.num?.started && locks.num.sector === "10")){
        unitTitle.innerText = "Uni";
      }

      applyModes();
      applyLocksToUI();
      validateForm();
      return;
    }

    quick = q;
    setQuickActive(q);

    // ✅ NO heredar acción anterior
    accion = null;
    btnEmpece.classList.remove("active");
    btnTermine.classList.remove("active");

    // bloquear sectores
    disableGrid(tipoGrid, true);
    extraGrid?.querySelectorAll("[data-tipo]").forEach(o => o.classList.add("disabled"));

    if(!(locks.num?.started && locks.num.sector === "10")){
      unitTitle.innerText = "Uni";
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

  if(isArmadoPedido()){
    noCodeChk.checked = false;
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
  if(btnEmpece.disabled) return;

  accion = "EMPECE";
  btnEmpece.classList.add("active");
  btnTermine.classList.remove("active");

  qtyInput.value = "";
  applyAccionUI();
  applyLocksToUI();
  validateForm();
});

btnTermine.addEventListener("click", () => {
  if(btnTermine.disabled) return;

  accion = "TERMINE";
  btnTermine.classList.add("active");
  btnEmpece.classList.remove("active");

  applyAccionUI();
  applyLocksToUI();
  validateForm();

  setTimeout(() => qtyInput?.focus(), 0);
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

    // ✅ Solo MOV muestra detalle. El resto: NO.
    if(quick === "MOV"){
      detailInput.style.display = "block";
      detailInput.placeholder = "Descripción (qué hizo)";
    }else{
      detailInput.style.display = "none";
      detailInput.value = "";
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

  applyArmadoPedidoUI();
  updateAccionButtons();
}

/* ===================== UI según acción ===================== */
function applyAccionUI(){
  if(quick !== null) return;

  if(isArmadoPedido()){
    codeInput.style.display = "none";
    detailInput.style.display = "none";

    formBody.classList.remove("qty-hidden", "qty-right");
    if(accion === "TERMINE"){
      formBody.classList.add("qty-right");
      qtyBox.style.gridColumn = "1 / 4";
      qtyInput.placeholder = "";
      unitTitle.innerText = "N°NP";
    }else{
      formBody.classList.add("qty-hidden");
      qtyInput.value = "";
    }
    return;
  }

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

/* ===================== VALIDACIÓN ===================== */
function validateForm(){
  updateAccionButtons();

  const { dead, num } = getLocks();

  // dead pendiente => solo terminar ese dead
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

  if(!areaOk){
    sendBtn.disabled = true;
    if(hintText) hintText.textContent = "Elegí 01–10 o un quick";
    return;
  }

  // QUICK: exige acción
  if(quick !== null){
    const accionOk = (accion === "EMPECE" || accion === "TERMINE");
    if(!accionOk){
      sendBtn.disabled = true;
      if(hintText) hintText.textContent = "Elegí Empecé o Terminé";
      return;
    }

    const ok = (quick === "MOV") ? isFilled(detailInput.value) : true;
    sendBtn.disabled = !ok;
    if(hintText) hintText.textContent = ok ? "Listo para enviar" : "Completá la Descripción";
    return;
  }

  // sector pendiente: si estás en sector, debe ser ese
  if(num?.started && quick === null){
    const sel = sector2(tipoSeleccionado);
    if(sel !== num.sector){
      sendBtn.disabled = true;
      if(hintText) hintText.textContent = `Debés terminar el sector ${num.sector} (o usar quick).`;
      return;
    }
  }

  const accionOk = (accion === "EMPECE" || accion === "TERMINE");
  if(!accionOk){
    sendBtn.disabled = true;
    if(hintText) hintText.textContent = "Elegí Empecé o Terminé";
    return;
  }

  // Armado Pedido
  if(isArmadoPedido()){
    const cantOk = (accion === "TERMINE") ? isFilled(qtyInput.value) : true;
    sendBtn.disabled = !cantOk;
    if(hintText) hintText.textContent = cantOk ? "Listo para enviar" : "Completá N°NP";
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

function goToEmpleadoScreenAndReset(){
  // volver a pantalla 1
  optionsScreen.classList.add("hidden");
  empleadoScreen.classList.remove("hidden");

  // reset selección
  quick = null;
  tipoSeleccionado = null;
  accion = null;

  // limpiar activos
  setQuickActive("__none__");
  clearActiveSectors();
  btnEmpece.classList.remove("active");
  btnTermine.classList.remove("active");

  // reset form
  noCodeChk.checked = false;
  optionsScreen.classList.remove("no-code-mode");
  codeInput.value = "";
  detailInput.value = "";
  qtyInput.value = "";

  // limpiar empleados
  document.querySelectorAll('[data-emp]').forEach(el => el.classList.remove("active"));
  empleadosSeleccionados = [];
  acceptEmpleadoBtn.disabled = true;

  renderLast2Panel();

  // revalidar
  applyModes();
  applyAccionUI();
  applyLocksToUI();
  validateForm();
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
      alert(`Tenés un sector en curso (${locks.num.sector}). Debés terminar ese sector (o usar quick).`);
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
    if(isArmadoPedido()){
      Cod = "";
      Descripcion = "";
      usedNoCode = false;
      Cant = (accion === "TERMINE") ? (qtyInput.value || "").trim() : "";
    }else{
      const noHayCodigo = noCodeChk.checked;
      usedNoCode = noHayCodigo;
      Cod = noHayCodigo ? "" : (codeInput.value || "").trim();
      Descripcion = noHayCodigo ? (detailInput.value || "").trim() : "";
      Cant = (accion === "TERMINE") ? (qtyInput.value || "").trim() : "";
    }
  }

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

    pushLast2Rows(
      empleadosSeleccionados.map(emp => ({
        Hora: base.Hora,
        Empleado: emp,
        Sector: base.Sector,
        Cod: base.Cod,
        EmpeceTermine: base.EmpeceTermine,
        Descripcion: base.Descripcion
      }))
    );

    // cookies dead
    if(quick !== null){
      if(accion === "EMPECE"){
        lsSetK(LS_DEAD_BASE, { dead: quick, started: true, hsInicio: base.Hora, at: Date.now() });
        if(quick === "MOV"){
          lsSetK(LS_DEAD_PAY_BASE, { dead:"MOV", Descripcion, at: Date.now() });
        }else{
          lsDelK(LS_DEAD_PAY_BASE);
        }
      }else if(accion === "TERMINE"){
        const d = lsGetK(LS_DEAD_BASE, null);
        if(d?.started && d.dead === quick) lsDelK(LS_DEAD_BASE);
        if(quick === "MOV") lsDelK(LS_DEAD_PAY_BASE);
      }
    }

    // cookies sector
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

    alert("Reporte enviado correctamente");

    // ✅ volver a la 1ra pantalla (sin reload)
    goToEmpleadoScreenAndReset();

  }catch(e){
    alert("No se pudo enviar. Revisá WiFi o avisá al supervisor.");
    sendBtn.disabled = false;
  }
});

/* ===================== INIT ===================== */
applyTipoLabels();
renderLast2Panel();

optionsScreen.classList.toggle("no-code-mode", noCodeChk.checked);
applyModes();
applyAccionUI();
validateForm();
applyLocksToUI();
