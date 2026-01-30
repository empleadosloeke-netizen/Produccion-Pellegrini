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
const LS_LAST2      = "tn_last2_v1";          // últimos 2 envíos (con empleado)
const LS_NUM        = "tn_last_num_v1";       // {sector:"05", started:true}
const LS_NUM_PAY    = "tn_last_num_pay_v1";   // payload del último EMPECE numérico (para terminar rápido)
const LS_DEAD       = "tn_last_dead_v1";      // {dead:"LIMP", started:true}

function lsGet(key, fallback=null){
  try{ const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch{ return fallback; }
}
function lsSet(key, val){ localStorage.setItem(key, JSON.stringify(val)); }
function lsDel(key){ localStorage.removeItem(key); }

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

/* ---------- panel de estado (inyectado por JS) ---------- */
function ensureStatusPanel(){
  let box = document.getElementById("statusPanel");
  if(box) return box;

  box = document.createElement("div");
  box.id = "statusPanel";
  box.style.cssText =
    "margin:10px 0 8px;padding:10px;border-radius:12px;background:#0b1220;border:1px solid rgba(255,255,255,.08);font-size:12px;line-height:1.35;opacity:.95";

  const title = document.createElement("div");
  title.style.cssText = "font-weight:800;margin-bottom:6px;font-size:12px;opacity:.9";
  title.textContent = "Últimos registros";

  const last2 = document.createElement("div");
  last2.id = "statusLast2";
  last2.style.cssText = "display:flex;flex-direction:column;gap:4px;margin-bottom:8px;";

  const quickAction = document.createElement("div");
  quickAction.id = "statusQuickAction";
  quickAction.style.cssText = "margin:8px 0 10px; display:none;";

  const locks = document.createElement("div");
  locks.id = "statusLocks";
  locks.style.cssText = "opacity:.85";

  box.appendChild(title);
  box.appendChild(last2);
  box.appendChild(quickAction);
  box.appendChild(locks);

  const anchor = optionsScreen.querySelector(".screen-head");
  anchor.insertAdjacentElement("afterend", box);
  return box;
}

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

function getLocks(){
  return {
    dead: lsGet(LS_DEAD, null),
    num:  lsGet(LS_NUM, null),
    numPay: lsGet(LS_NUM_PAY, null)
  };
}

function pushLast2Rows(rows){
  const cur = lsGet(LS_LAST2, []);
  const next = [...cur, ...rows].slice(-2);
  lsSet(LS_LAST2, next);
}

function renderStatus(){
  ensureStatusPanel();

  const last2 = lsGet(LS_LAST2, []);
  const { dead, num, numPay } = getLocks();

  const $last2 = document.getElementById("statusLast2");
  const $locks = document.getElementById("statusLocks");
  const $qa    = document.getElementById("statusQuickAction");

  $last2.innerHTML = "";
  if(!last2.length){
    const d = document.createElement("div");
    d.style.opacity = ".7";
    d.textContent = "Sin registros aún.";
    $last2.appendChild(d);
  }else{
    last2.slice(-2).reverse().forEach(r => {
      const d = document.createElement("div");
      d.textContent = formatMiniRow(r);
      $last2.appendChild(d);
    });
  }

  // Botón "Terminar rápido" si hay sector iniciado (y no hay tiempo muerto bloqueando)
  $qa.innerHTML = "";
  $qa.style.display = "none";
  if(!dead?.started && num?.started && numPay?.sector === num.sector){
    $qa.style.display = "block";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = `Terminar rápido sector ${num.sector}`;
    btn.style.cssText =
      "width:100%;padding:12px;border-radius:12px;border:none;background:#1e293b;color:#fff;font-weight:800;cursor:pointer;";

    btn.addEventListener("click", () => {
      // fuerza selección sector y carga datos del último EMPECE de ese sector
      quick = null;
      quickGrid.querySelectorAll(".option").forEach(o => o.classList.remove("active"));

      const n = Number(num.sector);
      tipoSeleccionado = n;
      tipoGrid.querySelectorAll(".option").forEach(o => {
        const nn = Number(o.getAttribute("data-tipo"));
        o.classList.toggle("active", nn === n);
      });

      setUnidad(n);

      // restaurar modo código/no-código según último EMPECE
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

      // poner acción Terminé
      accion = "TERMINE";
      btnTermine.classList.add("active");
      btnEmpece.classList.remove("active");

      // cantidad vacía para que la carguen
      qtyInput.value = "";
      applyAccionUI();
      applyLocksToUI();
      validateForm();
      qtyInput.focus();
    });

    $qa.appendChild(btn);
  }

  const lines = [];
  if(dead?.started){
    lines.push(`⛔ Tiempo muerto en curso: ${dead.dead}. Solo podés marcar “Terminé” en ese mismo.`);
  }else{
    lines.push(`✅ Tiempo muerto: libre`);
  }

  if(num?.started){
    lines.push(`⛔ Sector en curso: ${num.sector}. Solo podés terminar ese sector (pero sí podés usar Limp/Mov/Baño).`);
  }else{
    lines.push(`✅ Sector 01–09: libre`);
  }

  $locks.innerHTML = lines.map(x => `<div>${x}</div>`).join("");
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

/* ---------- reglas de bloqueo ---------- */
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
    // libre total (según estado actual)
    quickGrid.querySelectorAll(".option").forEach(o => o.classList.remove("disabled"));
    tipoGrid.querySelectorAll(".option").forEach(o => o.classList.remove("disabled"));

    if(quick !== null) disableGrid(tipoGrid, true);
    if(tipoSeleccionado !== null) disableGrid(quickGrid, true);
  }

  validateForm();
}

function initLocalStateUI(){
  applyTipoLabels();
  renderStatus();
  applyLocksToUI();
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
  renderStatus();
  applyLocksToUI();
});

backBtn.addEventListener("click", () => {
  optionsScreen.classList.add("hidden");
  empleadoScreen.classList.remove("hidden");
  validateForm();
});

/* ---------- sector 01–09 (TOGGLE) ---------- */
tipoGrid.querySelectorAll('[data-tipo]').forEach(el => {
  el.addEventListener("click", () => {
    // si quick está seleccionado, no permitir sector
    if(quick !== null) return;

    const n = Number(el.getAttribute("data-tipo"));

    // si clickeo el mismo sector activo => deseleccionar
    if(tipoSeleccionado === n){
      tipoSeleccionado = null;
      el.classList.remove("active");
      disableGrid(quickGrid, false);
      applyModes();
      applyLocksToUI();
      validateForm();
      return;
    }

    // seleccionar sector
    tipoGrid.querySelectorAll(".option").forEach(o => o.classList.remove("active"));
    el.classList.add("active");
    tipoSeleccionado = n;

    setUnidad(tipoSeleccionado);
    disableGrid(quickGrid, true);

    applyModes();
    applyLocksToUI();
    validateForm();
  });
});

/* ---------- quick Limp/Mov/Baño ---------- */
quickGrid.querySelectorAll('[data-quick]').forEach(el => {
  el.addEventListener("click", () => {
    // si hay sector seleccionado, no permitir quick
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
      disableGrid(tipoGrid, true);
    }

    applyModes();
    applyLocksToUI();
    validateForm();
  });
});

/* ---------- checkbox no code ---------- */
noCodeChk.addEventListener("change", () => {
  // si quick está activo, no se puede cambiar
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

/* ---------- Empecé / Terminé ---------- */
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

/* ---------- aplicar modos (normal vs quick) ---------- */
function applyModes(){
  // limpiar inputs para evitar basura
  codeInput.value = "";
  detailInput.value = "";
  qtyInput.value = "";

  if(quick !== null){
    // quick: fuerza no-code (pero sin checkbox editable)
    optionsScreen.classList.add("quick-mode");
    optionsScreen.classList.remove("no-code-mode");

    noCodeChk.checked = true;
    noCodeChk.disabled = true;

    // layout: usamos mode-nocode para poder usar detail si MOV
    formBody.classList.remove("mode-code");
    formBody.classList.add("mode-nocode");

    // MOV requiere descripción, Limp/Baño no
    if(quick === "MOV"){
      detailInput.style.display = "block";
      detailInput.placeholder = "Descripción (qué hizo)";
    }else{
      detailInput.style.display = "none";
      detailInput.placeholder = "Detalle / Observación";
    }

    // cantidad nunca en quick
    formBody.classList.add("qty-hidden");
    formBody.classList.remove("qty-right");

    // unidad nunca en quick
    if(unitSlotHeader.contains(unitTitle)) unitSlotHeader.innerHTML = "";
    if(qtyBox.contains(unitTitle)) qtyBox.removeChild(unitTitle);

  }else{
    // normal: habilita checkbox
    optionsScreen.classList.remove("quick-mode");
    noCodeChk.disabled = false;

    // no forzar display en normal (lo maneja el CSS por mode-code/mode-nocode)
    detailInput.style.removeProperty("display");
    detailInput.placeholder = "Detalle / Observación";

    // respetar checkbox
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
  // quick: ya está fijo
  if(quick !== null){
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

/* ---------- validación (con locks) ---------- */
function validateForm(){
  const { dead, num } = getLocks();

  // Si hay tiempo muerto iniciado, solo se puede terminar ese mismo
  if(dead?.started){
    const okArea = (quick === dead.dead);
    const okAcc  = (accion === "TERMINE");
    const okMov  = (dead.dead === "MOV") ? isFilled(detailInput.value) : true;

    const allOk = okArea && okAcc && okMov;
    sendBtn.disabled = !allOk;
    if(hintText) hintText.textContent = allOk ? "Listo para finalizar tiempo muerto" : "Debés terminar el tiempo muerto en curso";
    return;
  }

  // Reglas normales
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

  // Si hay sector iniciado, NO permitir terminar otro sector distinto (pero quick sí)
  if(num?.started && quick === null){
    const sel = sector2(tipoSeleccionado);
    if(sel !== num.sector){
      sendBtn.disabled = true;
      if(hintText) hintText.textContent = `Debés terminar el sector ${num.sector} (o usar Limp/Mov/Baño).`;
      return;
    }
  }

  // quick rules
  if(quick !== null){
    const ok = (quick === "MOV") ? isFilled(detailInput.value) : true;
    sendBtn.disabled = !ok;
    if(hintText) hintText.textContent = ok ? "Listo para enviar" : "Completá la Descripción";
    return;
  }

  // normal rules
  const noHayCodigo = noCodeChk.checked;
  const codOk = noHayCodigo ? isFilled(detailInput.value) : isFilled(codeInput.value);
  const cantOk = (accion === "TERMINE") ? isFilled(qtyInput.value) : true;

  const allOk = codOk && cantOk;
  sendBtn.disabled = !allOk;
  if(hintText) hintText.textContent = allOk ? "Listo para enviar" : "Completá lo que falta";
}

/* ---------- envío ---------- */
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

  // reglas consistencia
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
    // Limp/Baño: nada; Mov: descripción
    if(quick === "MOV") Descripcion = (detailInput.value || "").trim();
  }else{
    const noHayCodigo = noCodeChk.checked;
    usedNoCode = noHayCodigo;
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

    const rowsForLast2 = [];

    for(const emp of empleadosSeleccionados){
      const payload = { ...base, Empleado: emp };
      await postRow(payload);

      rowsForLast2.push({
        Hora: payload.Hora,
        Empleado: payload.Empleado,
        Sector: payload.Sector,
        Cod: payload.Cod,
        EmpeceTermine: payload.EmpeceTermine,
        Descripcion: payload.Descripcion
      });
    }

    // guardar últimos 2 (con empleado)
    pushLast2Rows(rowsForLast2);

    // ---- guardar / liberar estados ----

    // Tiempo muerto
    if(quick !== null){
      if(accion === "EMPECE"){
        lsSet(LS_DEAD, { dead: quick, started: true, at: Date.now() });
      }else if(accion === "TERMINE"){
        const d = lsGet(LS_DEAD, null);
        if(d?.started && d.dead === quick) lsDel(LS_DEAD);
      }
    }

    // Sector numérico
    if(quick === null && tipoSeleccionado !== null){
      const sec = sector2(tipoSeleccionado);

      if(accion === "EMPECE"){
        lsSet(LS_NUM, { sector: sec, started: true, at: Date.now() });

        // guardar payload de "empecé" para terminar rápido
        lsSet(LS_NUM_PAY, {
          sector: sec,
          Cod,
          Descripcion,
          usedNoCode,
          at: Date.now()
        });

      }else if(accion === "TERMINE"){
        const n = lsGet(LS_NUM, null);
        if(n?.started && n.sector === sec) lsDel(LS_NUM);

        const p = lsGet(LS_NUM_PAY, null);
        if(p?.sector === sec) lsDel(LS_NUM_PAY);
      }
    }

    renderStatus();
    applyLocksToUI();

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

initLocalStateUI();
