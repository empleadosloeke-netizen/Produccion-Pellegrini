const GOOGLE_SHEET_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbyx3BgnhoWqEWSlYfKC6SrPEPqV9BxOoQtLbqRdzokhdCMAgbLwICtq3zmqlE6-XBgb/exec";

let empleadosSeleccionados = [];
let tipoSeleccionado = null;
let accion = null;
let quick = null;

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

/* ================= LOCAL STORAGE ================= */
const LS_NUM_BASE     = "tn_last_num_v1";
const LS_NUM_PAY_BASE = "tn_last_num_pay_v1";
const LS_DEAD_BASE    = "tn_last_dead_v1";

function lsGet(key,f=null){try{const v=localStorage.getItem(key);return v?JSON.parse(v):f}catch{return f}}
function lsSet(key,v){localStorage.setItem(key,JSON.stringify(v))}
function lsDel(key){localStorage.removeItem(key)}

function empKeyFromSelected(list){
  return list.map(x=>x.trim()).sort().join("|");
}
function lsKey(base){return base+"::"+(empKeyFromSelected(empleadosSeleccionados)||"__global__")}
function lsGetK(base,f=null){return lsGet(lsKey(base),f)}
function lsSetK(base,v){lsSet(lsKey(base),v)}
function lsDelK(base){lsDel(lsKey(base))}

/* ================= TERMINAR RÁPIDO ================= */
function renderQuickFinishButton(){
  let existing = document.getElementById("quickFinishBtn");
  if(existing) existing.remove();

  const num = lsGetK(LS_NUM_BASE);
  const numPay = lsGetK(LS_NUM_PAY_BASE);
  const dead = lsGetK(LS_DEAD_BASE);

  if(!num?.started || dead?.started) return;

  const btn = document.createElement("button");
  btn.id = "quickFinishBtn";
  btn.textContent = `Terminar rápido sector ${num.sector}`;
  btn.style.cssText = "width:100%;margin-top:10px;padding:12px;border-radius:12px;border:none;background:#1e293b;color:#fff;font-weight:800;";

  btn.onclick = () => {
    empleadoScreen.classList.add("hidden");
    optionsScreen.classList.remove("hidden");

    quick = null;
    tipoSeleccionado = Number(num.sector);

    tipoGrid.querySelectorAll(".option").forEach(o=>{
      o.classList.toggle("active", o.getAttribute("data-tipo")===num.sector);
    });

    const usedNoCode = numPay.usedNoCode;
    noCodeChk.checked = usedNoCode;

    if(usedNoCode){
      formBody.classList.remove("mode-code");
      formBody.classList.add("mode-nocode");
      detailInput.value = numPay.Descripcion || "";
    }else{
      formBody.classList.remove("mode-nocode");
      formBody.classList.add("mode-code");
      codeInput.value = numPay.Cod || "";
    }

    accion = "TERMINE";
    btnTermine.classList.add("active");
    btnEmpece.classList.remove("active");

    qtyInput.value = "";
  };

  empleadoScreen.appendChild(btn);
}

/* ================= HELPERS ================= */
function nowAR(){
  const d = new Date();
  return {
    Dia: d.toLocaleDateString("es-AR",{timeZone:"America/Argentina/Buenos_Aires"}),
    Hora: d.toLocaleTimeString("es-AR",{timeZone:"America/Argentina/Buenos_Aires"})
  };
}
function accionLabel(){return accion==="EMPECE"?"Empecé":accion==="TERMINE"?"Terminé":""}
function sector2(n){return String(n).padStart(2,"0")}

/* ================= ENVÍO ================= */
async function postRow(payload){
  const r = await fetch(GOOGLE_SHEET_WEBAPP_URL,{
    method:"POST",
    headers:{"Content-Type":"text/plain;charset=utf-8"},
    body:JSON.stringify(payload)
  });
  const txt=await r.text();
  const out=JSON.parse(txt);
  if(!out.ok) throw new Error(out.error||"Error");
}

sendBtn.addEventListener("click",async()=>{
  const locksDead = lsGetK(LS_DEAD_BASE);
  const locksNum = lsGetK(LS_NUM_BASE);

  if(locksDead?.started && !(quick===locksDead.dead && accion==="TERMINE")){
    alert("Debés terminar el tiempo muerto en curso");
    return;
  }

  if(locksNum?.started && quick===null && sector2(tipoSeleccionado)!==locksNum.sector){
    alert("Debés terminar el sector en curso");
    return;
  }

  const t=nowAR();
  const Sector = quick?quick:sector2(tipoSeleccionado);

  let Cod="",Descripcion="",Cant="",HsInicio="";

  if(accion==="TERMINE"){
    if(quick){
      const d=lsGetK(LS_DEAD_BASE);
      if(d?.started) HsInicio=d.hsInicio||"";
    }else{
      const n=lsGetK(LS_NUM_BASE);
      if(n?.started) HsInicio=n.hsInicio||"";
    }
  }

  if(quick){
    if(quick==="MOV") Descripcion=detailInput.value.trim();
  }else{
    if(noCodeChk.checked) Descripcion=detailInput.value.trim();
    else Cod=codeInput.value.trim();
    if(accion==="TERMINE") Cant=qtyInput.value.trim();
  }

  const base={Dia:t.Dia,Hora:t.Hora,Sector,Cod,EmpeceTermine:accionLabel(),Cant,Descripcion,HsInicio};

  try{
    for(const emp of empleadosSeleccionados){
      await postRow({...base,Empleado:emp});
    }

    if(quick){
      if(accion==="EMPECE") lsSetK(LS_DEAD_BASE,{dead:quick,started:true,hsInicio:base.Hora});
      else lsDelK(LS_DEAD_BASE);
    }else{
      const sec=sector2(tipoSeleccionado);
      if(accion==="EMPECE"){
        lsSetK(LS_NUM_BASE,{sector:sec,started:true,hsInicio:base.Hora});
        lsSetK(LS_NUM_PAY_BASE,{sector:sec,Cod,Descripcion,usedNoCode:noCodeChk.checked});
      }else{
        lsDelK(LS_NUM_BASE);
        lsDelK(LS_NUM_PAY_BASE);
      }
    }

    alert("Reporte enviado");
    location.reload();

  }catch(e){
    alert("Error al enviar");
  }
});

/* ================= INIT ================= */
renderQuickFinishButton();
