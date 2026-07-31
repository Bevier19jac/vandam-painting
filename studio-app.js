/* ============================================================
   VAN DAM DESIGN STUDIO — application module
   Tabs, shared state, multi-surface workspaces (interior +
   exterior), quiz, planner, saved designs, exports.
   Requires: site-config.js (VDP_CONFIG), studio-core.js (VDPCore)
   ============================================================ */
(function(){
"use strict";
var C = window.VDPCore, CFG = window.VDP_CONFIG;
var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
var SITE_URL = "bevier19jac.github.io/vandam-painting";

/* ---------------- tiny helpers ---------------- */
function $(sel, root){ return (root||document).querySelector(sel); }
function $$(sel, root){ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); }
function el(tag, cls, html){ var e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; }
function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
function lsGet(k,fb){ try{ var v=JSON.parse(localStorage.getItem(k)); return v==null?fb:v; }catch(e){ return fb; } }
function lsSet(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); return true; }catch(e){ return false; } }
var toastEl, toastT;
function toast(msg){
  if(!toastEl){ toastEl=el("div","toast"); toastEl.setAttribute("role","status"); document.body.appendChild(toastEl); }
  toastEl.textContent=msg; toastEl.classList.add("show");
  clearTimeout(toastT); toastT=setTimeout(function(){ toastEl.classList.remove("show"); },3400);
}
function confirmBox(msg){ return window.confirm(msg); } // clear, native, accessible

/* ---------------- router / tabs ---------------- */
var TABS = ["interior","exterior","quiz","planner","saved"];
var current = null;
var inited = {};
function tabFromHash(){
  var h = (location.hash||"").replace("#","");
  return TABS.indexOf(h) !== -1 ? h : "interior";
}
function activate(tab, viaHash){
  if (TABS.indexOf(tab)===-1) tab = "interior";
  if (current === tab) return;
  current = tab;
  TABS.forEach(function(t){
    var btn = $("#tab-"+t), panel = $("#panel-"+t);
    var on = t===tab;
    btn.setAttribute("aria-selected", on?"true":"false");
    btn.tabIndex = on?0:-1;
    btn.classList.toggle("on", on);
    if (on){ panel.hidden=false; if(!REDUCED){ panel.classList.remove("stroke-in"); void panel.offsetWidth; panel.classList.add("stroke-in"); } }
    else panel.hidden = true;
  });
  if (!inited[tab]){ inited[tab]=true; INIT[tab](); }
  else if (RESUME[tab]) RESUME[tab]();
  if (!viaHash && location.hash !== "#"+tab){
    try{ history.pushState(null,"","#"+tab); }catch(e){ location.hash = tab; }
  }
  var btn = $("#tab-"+tab);
  if (btn && btn.scrollIntoView) btn.scrollIntoView({block:"nearest", inline:"center", behavior: REDUCED?"auto":"smooth"});
}
function wireTabs(){
  var list = $("#tablist");
  TABS.forEach(function(t){
    $("#tab-"+t).addEventListener("click", function(){ activate(t); });
  });
  list.addEventListener("keydown", function(e){
    var idx = TABS.indexOf(current);
    var go = null;
    if (e.key==="ArrowRight") go = TABS[(idx+1)%TABS.length];
    if (e.key==="ArrowLeft") go = TABS[(idx-1+TABS.length)%TABS.length];
    if (e.key==="Home") go = TABS[0];
    if (e.key==="End") go = TABS[TABS.length-1];
    if (go){ e.preventDefault(); activate(go); $("#tab-"+go).focus(); }
  });
  window.addEventListener("hashchange", function(){ activate(tabFromHash(), true); });
}

/* ================================================================
   WORKSPACE — shared engine for Interior + Exterior studios
   ================================================================ */
var MAX_WORK = 1400;
function Workspace(kind){
  this.kind = kind; // 'interior' | 'exterior'
  this.project = this.blankProject();
  this.imgCanvas = null;
  this.layers = {};       // surfaceId -> canvas
  this.activeId = null;
  this.mode = "empty";    // empty | trace | paint
  this.compare = false; this.dividerPct = 0.55; this.holding = false;
  this.pointer = { down:false, moved:false, dragIdx:-1, downPos:null };
  this.rebuildT = null;
  this.root = null;
}
Workspace.prototype.blankProject = function(){
  return { id: "p"+Math.random().toString(36).slice(2,9), name: "", type: this.kind||"interior",
    photo: null, surfaces: [], lighting: "original", permanent: {}, schemes: [], quiz: null,
    createdAt: Date.now(), updatedAt: Date.now() };
};

/* ---------- markup template (built once per workspace) ---------- */
Workspace.prototype.buildHTML = function(){
  var k = this.kind, ext = k==="exterior";
  return '' +
  '<div class="up-stage">' +
    '<h2 class="step-title">'+(ext ? "See the curb appeal before the first ladder goes up." : "See it before we paint it.")+'</h2>' +
    '<p class="step-sub">'+(ext ? "Upload a photo of the house, trace the siding, trim, doors and shutters, and try coordinated exterior schemes." :
      "Upload a room photo, trace each surface — walls, ceiling, trim, cabinets — and color them independently.")+'</p>' +
    '<div class="drop" role="button" tabindex="0" aria-label="Upload a photo. Press Enter to choose a file, or drag and drop one here.">' +
      '<svg width="44" height="44" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 16V4m0 0l-4 4m4-4l4 4" stroke="#f2731f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="#94a0b5" stroke-width="2" stroke-linecap="round"/></svg>' +
      '<div class="big">Drop a photo here, or tap to choose one</div>' +
      '<div class="hint">JPEG, PNG, or WebP · up to 25 MB</div></div>' +
    '<input type="file" class="file-in sr-only" accept="image/jpeg,image/png,image/webp" tabindex="-1" aria-hidden="true">' +
    '<input type="file" class="cam-in sr-only" accept="image/*" capture="environment" tabindex="-1" aria-hidden="true">' +
    '<div class="up-actions">' +
      '<button class="btn btn-soft b-cam" type="button">📷&nbsp; Take a photo</button>' +
      '<button class="btn btn-ghost b-example" type="button">Try the example '+(ext?"house":"room")+'</button>' +
    '</div>' +
    '<div class="err" role="alert"></div>' +
    '<p class="privacy"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2L4 6v6c0 5 3.4 8.4 8 10 4.6-1.6 8-5 8-10V6l-8-4z" stroke="#f2731f" stroke-width="2"/></svg>' +
      'Your photo stays on your device unless you choose to include it with an estimate request.</p>' +
  '</div>' +

  '<div class="ws hidden">' +
    '<div class="ws-left">' +
      '<div class="canvas-card">' +
        '<div class="canvas-wrap">' +
          '<canvas class="view"></canvas>' +
          '<div class="divider-line" role="slider" tabindex="0" aria-label="Before and after divider" aria-valuemin="0" aria-valuemax="100" aria-valuenow="55"></div>' +
          '<div class="loupe"><canvas class="loupe-c" width="110" height="110"></canvas></div>' +
          '<div class="mixing" aria-hidden="true"><span class="mix-brush"></span>Mixing your colors…</div>' +
        '</div>' +
        '<div class="canvas-note"></div>' +
        '<div class="light-row" role="group" aria-label="Lighting preview">' +
          '<span class="light-lab">Lighting preview:</span>' +
          '<button class="chip lt on" data-lt="original" type="button">Original</button>' +
          '<button class="chip lt" data-lt="daylight" type="button">Daylight</button>' +
          '<button class="chip lt" data-lt="evening" type="button">Evening</button>' +
          '<button class="chip lt" data-lt="overcast" type="button">Overcast</button>' +
        '</div>' +
        '<p class="disclaimer">Lighting Preview is an approximation. Real paint color changes with room orientation, bulbs, sheen, weather, and time of day.</p>' +
        '<div class="tool-row view-actions">' +
          '<button class="btn btn-soft small b-compare" type="button" aria-pressed="false">⇆ Compare</button>' +
          '<button class="btn btn-soft small b-hold" type="button">👁 Hold: before</button>' +
          '<button class="btn btn-soft small b-full" type="button">⛶ Full screen</button>' +
          '<button class="btn btn-soft small b-download" type="button">↓ Preview</button>' +
          '<button class="btn btn-soft small b-board" type="button">▤ Project board</button>' +
          '<button class="btn btn-soft small b-share" type="button">↗ Share</button>' +
        '</div>' +
      '</div>' +
    '</div>' +

    '<div class="ws-right">' +
      '<div class="panel surf-panel">' +
        '<div class="panel-head"><h3>Surfaces</h3>' +
          '<button class="btn btn-orange small b-add" type="button">+ Add surface</button></div>' +
        '<p class="sub surf-hint">Trace your first surface to get started.</p>' +
        '<ul class="surf-list" role="list"></ul>' +
        '<div class="trace-tools hidden">' +
          '<p class="sub trace-status">Tap around the surface edges.</p>' +
          '<div class="tool-row">' +
            '<button class="btn btn-soft small b-undo" type="button">↩︎ Undo</button>' +
            '<button class="btn btn-soft small b-restart-trace" type="button">Start over</button>' +
            '<button class="btn btn-soft small b-close" type="button" disabled>Close shape</button>' +
            '<button class="btn btn-ghost small b-whole" type="button">Whole photo</button>' +
            '<button class="btn btn-ghost small b-cancel-trace" type="button">Cancel</button>' +
          '</div>' +
        '</div>' +
        '<div class="proj-row">' +
          '<input class="proj-name" type="text" maxlength="40" placeholder="Name this project (optional)" aria-label="Project name">' +
          '<button class="btn btn-soft small b-save" type="button">💾 Save</button>' +
          '<button class="btn btn-ghost small b-newphoto" type="button">↞ New photo</button>' +
        '</div>' +
        '<p class="sub save-note">Saved designs stay on this device only.</p>' +
      '</div>' +

      '<div class="panel color-panel hidden">' +
        '<div class="panel-head"><h3 class="cp-title">Color</h3></div>' +
        '<p class="sub cp-for"></p>' +
        '<input class="search c-search" type="search" placeholder="Search colors…" aria-label="Search colors">' +
        '<div class="chiprow fam-chips" role="group" aria-label="Color families"></div>' +
        '<div class="swatches sw-grid" role="listbox" aria-label="Paint colors"></div>' +
        '<div class="custom-row">' +
          '<input type="color" class="c-custom" value="#8a9a7e" aria-label="Custom color picker">' +
          '<input type="text" class="c-hex" placeholder="#HEX" maxlength="7" aria-label="Hex color code">' +
          '<button class="btn btn-soft small b-hex" type="button">Apply</button>' +
        '</div>' +
        '<div class="recent-wrap hidden"><p class="sub" style="margin:8px 0 5px">Recent</p><div class="swatches r-grid"></div></div>' +
        '<div class="sel-info">' +
          '<span class="dot sel-dot"></span>' +
          '<span class="sel-text"><b class="sel-name">—</b><small class="sel-meta"></small><span class="trim sel-trim"></span></span>' +
          '<button class="favbtn b-fav" aria-label="Save color to favorites" aria-pressed="false" type="button">♥</button>' +
        '</div>' +
        '<div class="slider-row"><label><span>Paint intensity</span><span class="iv">100%</span></label>' +
          '<input type="range" class="r-int" min="20" max="100" value="100" aria-label="Paint intensity"></div>' +
        '<div class="slider-row"><label><span>Brightness</span><span class="bv">0</span></label>' +
          '<input type="range" class="r-bri" min="-20" max="20" value="0" aria-label="Brightness adjustment"></div>' +
      '</div>' +

      '<div class="panel scheme-panel hidden">' +
        '<div class="panel-head"><h3>Coordinated schemes</h3></div>' +
        (ext ?
          '<details class="perm-box"><summary>Tell us your permanent colors (roof, brick…)</summary>' +
          '<p class="sub">We’ll rank the schemes that usually coordinate — a starting point, not a scientific match.</p>' +
          '<div class="perm-grid">' +
            '<label>Roof <select class="perm-roof"><option value="">Not sure</option><option value="black">Black / dark gray</option><option value="gray">Gray</option><option value="warm">Brown / warm</option><option value="green">Green</option></select></label>' +
            '<label>Brick <select class="perm-brick"><option value="">None</option><option value="red">Red / orange</option><option value="brown">Brown</option><option value="painted">Painted</option></select></label>' +
            '<label>Stone <select class="perm-stone"><option value="">None</option><option value="warm">Warm stone</option><option value="cool">Gray stone</option></select></label>' +
            '<label>Style <select class="perm-style"><option value="">Either</option><option value="traditional">Traditional</option><option value="modern">Modern</option></select></label>' +
            '<label>Setting <select class="perm-setting"><option value="">Open</option><option value="wooded">Wooded lot</option></select></label>' +
          '</div></details>' : '') +
        '<div class="scheme-list"></div>' +
        (ext ?
          '<div class="opt-box">' +
            '<div class="panel-head"><h3 style="font-size:18px">Compare options</h3>' +
              '<button class="btn btn-soft small b-snap" type="button">Save as option</button></div>' +
            '<div class="opt-chips"></div>' +
            '<div class="tool-row"><button class="btn btn-ghost small b-compare-opts" type="button" disabled>Side-by-side</button></div>' +
          '</div>' +
          '<div class="tool-row"><button class="btn btn-soft small b-door-play" type="button">🚪 Front-door playground</button></div>'
          : '') +
      '</div>' +

      '<div class="cta-card est-card hidden">' +
        '<h3>Love the direction?</h3>' +
        '<p>Let Bryan see it and provide a clear, written estimate.</p>' +
        '<label class="inc-row"><input type="checkbox" class="inc-dl" checked> Download my preview so I can show Bryan</label>' +
        '<button class="btn btn-orange b-estimate" type="button" style="width:100%">Request This Transformation</button>' +
        '<button class="btn btn-ghost small b-to-planner" type="button" style="width:100%;margin-top:10px">Build my full painting plan →</button>' +
      '</div>' +
    '</div>' +
  '</div>' +
  '<div class="cmp-modal hidden" role="dialog" aria-modal="true" aria-label="Compare schemes"><div class="cmp-card">' +
    '<button class="modal-close b-cmp-close" aria-label="Close comparison" type="button">✕</button>' +
    '<h3 class="cmp-title">Your options</h3><div class="cmp-grid"></div></div></div>';
};

/* ---------- init & photo ---------- */
Workspace.prototype.init = function(rootId){
  var self = this;
  this.root = $(rootId);
  this.root.innerHTML = this.buildHTML();
  this.view = $(".view", this.root);
  this.vctx = this.view.getContext("2d");
  this.wrap = $(".canvas-wrap", this.root);

  // photo intake
  var drop = $(".drop", this.root), fi = $(".file-in", this.root), ci = $(".cam-in", this.root);
  drop.addEventListener("click", function(){ fi.click(); });
  drop.addEventListener("keydown", function(e){ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); fi.click(); } });
  ["dragover","dragenter"].forEach(function(ev){ drop.addEventListener(ev, function(e){ e.preventDefault(); drop.classList.add("over"); }); });
  ["dragleave","drop"].forEach(function(ev){ drop.addEventListener(ev, function(e){ e.preventDefault(); drop.classList.remove("over"); }); });
  drop.addEventListener("drop", function(e){ var f=e.dataTransfer&&e.dataTransfer.files[0]; if(f) self.loadFile(f); });
  fi.addEventListener("change", function(){ if(fi.files[0]) self.loadFile(fi.files[0]); fi.value=""; });
  ci.addEventListener("change", function(){ if(ci.files[0]) self.loadFile(ci.files[0]); ci.value=""; });
  $(".b-cam", this.root).addEventListener("click", function(){ ci.click(); });
  $(".b-example", this.root).addEventListener("click", function(){
    var img = new Image();
    img.onload = function(){ self.acceptImage(img, img.width, img.height); };
    img.onerror = function(){ self.err("Could not load the example image."); };
    img.src = self.kind==="exterior" ? "assets/example-exterior.jpg" : "assets/example-room.jpg";
  });

  // canvas pointer
  this.wrap.addEventListener("pointerdown", function(e){ self.onDown(e); });
  this.wrap.addEventListener("pointermove", function(e){ self.onMove(e); });
  this.wrap.addEventListener("pointerup", function(e){ self.onUp(e); });
  this.wrap.addEventListener("pointercancel", function(){ self.pointer.down=false; self.pointer.dragIdx=-1; self.hideLoupe(); });

  // trace tools
  $(".b-undo",this.root).addEventListener("click", function(){ self.traceUndo(); });
  $(".b-restart-trace",this.root).addEventListener("click", function(){ self.traceReset(); });
  $(".b-close",this.root).addEventListener("click", function(){ self.closeTrace(); });
  $(".b-whole",this.root).addEventListener("click", function(){ self.wholePhoto(); });
  $(".b-cancel-trace",this.root).addEventListener("click", function(){ self.cancelTrace(); });
  $(".b-add",this.root).addEventListener("click", function(){ self.addSurfaceFlow(); });
  $(".b-newphoto",this.root).addEventListener("click", function(){
    if (self.project.surfaces.length && !confirmBox("Start over with a new photo? Unsaved surfaces will be lost.")) return;
    self.resetAll();
  });
  $(".b-save",this.root).addEventListener("click", function(){ self.saveProject(); });
  $(".proj-name",this.root).addEventListener("input", function(e){ self.project.name = e.target.value; });

  // view actions
  $(".b-compare",this.root).addEventListener("click", function(){ self.toggleCompare(); });
  var hb = $(".b-hold",this.root);
  hb.addEventListener("pointerdown", function(e){ e.preventDefault(); self.holding=true; self.render(); });
  ["pointerup","pointerleave"].forEach(function(ev){ hb.addEventListener(ev, function(){ if(self.holding){ self.holding=false; self.render(); } }); });
  hb.addEventListener("keydown", function(e){ if(e.key===" "||e.key==="Enter"){ self.holding=true; self.render(); } });
  hb.addEventListener("keyup", function(){ if(self.holding){ self.holding=false; self.render(); } });
  $(".b-full",this.root).addEventListener("click", function(){ self.toggleFullscreen(this); });
  $(".b-download",this.root).addEventListener("click", function(){ self.downloadPreview().then(function(){ toast("Preview downloaded"); }); });
  $(".b-board",this.root).addEventListener("click", function(){ self.exportBoard(); });
  $(".b-share",this.root).addEventListener("click", function(){ self.share(); });
  var div = $(".divider-line",this.root);
  div.addEventListener("keydown", function(e){
    if (e.key==="ArrowLeft"){ self.dividerPct=Math.max(.05,self.dividerPct-.05); self.positionDivider(); self.render(); }
    if (e.key==="ArrowRight"){ self.dividerPct=Math.min(.95,self.dividerPct+.05); self.positionDivider(); self.render(); }
  });

  // lighting
  $$(".lt", this.root).forEach(function(b){
    b.addEventListener("click", function(){
      $$(".lt", self.root).forEach(function(x){ x.classList.remove("on"); });
      b.classList.add("on");
      self.project.lighting = b.dataset.lt;
      self.render();
    });
  });

  // color panel
  this.famActive = "All";
  $(".c-search",this.root).addEventListener("input", function(){ self.renderSwatches(); });
  $(".c-custom",this.root).addEventListener("input", function(e){ self.setColor(self.customColor(e.target.value)); });
  $(".b-hex",this.root).addEventListener("click", function(){ self.applyHexInput(); });
  $(".c-hex",this.root).addEventListener("keydown", function(e){ if(e.key==="Enter") self.applyHexInput(); });
  $(".b-fav",this.root).addEventListener("click", function(){ self.toggleFav(); });
  $(".r-int",this.root).addEventListener("input", function(e){
    var s=self.active(); if(!s) return;
    s.intensity = e.target.value/100;
    $(".iv",self.root).textContent = e.target.value+"%";
    self.render(); self.renderSurfList();
  });
  $(".r-bri",this.root).addEventListener("input", function(e){
    var s=self.active(); if(!s) return;
    s.brightness = +e.target.value;
    $(".bv",self.root).textContent = (e.target.value>0?"+":"")+e.target.value;
    self.queueLayer(s.id);
  });

  // schemes
  this.renderSchemes();
  if (this.kind==="exterior") this.renderOptions();
  if (this.kind==="exterior"){
    $$(".perm-box select", this.root).forEach(function(sel){
      sel.addEventListener("change", function(){ self.readPermanent(); self.renderSchemes(); });
    });
    $(".b-snap",this.root).addEventListener("click", function(){ self.snapshotOption(); });
    $(".b-compare-opts",this.root).addEventListener("click", function(){ self.compareOptions(); });
    $(".b-door-play",this.root).addEventListener("click", function(){ self.doorPlay(); });
    $(".b-cmp-close",this.root).addEventListener("click", function(){ $(".cmp-modal",self.root).classList.add("hidden"); });
  }

  // estimate
  $(".b-estimate",this.root).addEventListener("click", function(){ self.estimate(); });
  $(".b-to-planner",this.root).addEventListener("click", function(){
    Planner.importFromStudio(self);
    activate("planner");
  });

  this.renderChips();
  this.renderSwatches();
  this.renderRecents();
  this.refreshUI();
};

Workspace.prototype.err = function(msg){
  var e = $(".err", this.root);
  if (msg){ e.textContent=msg; e.classList.add("show"); } else e.classList.remove("show");
};
Workspace.prototype.loadFile = function(file){
  var self=this; this.err(null);
  var v = C.validateImageFile(file);
  if (!v.ok){ this.err(v.error); return; }
  if (window.createImageBitmap){
    createImageBitmap(file,{imageOrientation:"from-image"}).then(function(bmp){
      self.acceptImage(bmp,bmp.width,bmp.height); if(bmp.close) bmp.close();
    }).catch(function(){ self.loadURL(file); });
  } else this.loadURL(file);
};
Workspace.prototype.loadURL = function(file){
  var self=this, url=URL.createObjectURL(file), img=new Image();
  img.onload=function(){ self.acceptImage(img,img.width,img.height); URL.revokeObjectURL(url); };
  img.onerror=function(){ URL.revokeObjectURL(url); self.err("That image could not be read. Try another photo."); };
  img.src=url;
};
Workspace.prototype.acceptImage = function(src,w,h){
  var fit = C.fitWithin(w,h,MAX_WORK);
  var c = document.createElement("canvas"); c.width=fit.w; c.height=fit.h;
  c.getContext("2d").drawImage(src,0,0,fit.w,fit.h);
  this.imgCanvas = c;
  // small copy for save/restore
  var sfit = C.fitWithin(fit.w,fit.h,800);
  var sc = document.createElement("canvas"); sc.width=sfit.w; sc.height=sfit.h;
  sc.getContext("2d").drawImage(c,0,0,sfit.w,sfit.h);
  this.project.photo = sc.toDataURL("image/jpeg",0.72);
  this.project.surfaces = []; this.layers = {}; this.activeId=null;
  this.view.width=fit.w; this.view.height=fit.h;
  $(".up-stage",this.root).classList.add("hidden");
  $(".ws",this.root).classList.remove("hidden");
  this.addSurfaceFlow(true);
  this.render();
};
Workspace.prototype.resetAll = function(){
  this.project = this.blankProject();
  this.imgCanvas=null; this.layers={}; this.activeId=null; this.mode="empty";
  $(".proj-name",this.root).value="";
  $(".up-stage",this.root).classList.remove("hidden");
  $(".ws",this.root).classList.add("hidden");
  this.refreshUI();
};

/* ---------- surfaces ---------- */
Workspace.prototype.active = function(){
  var id=this.activeId, out=null;
  this.project.surfaces.forEach(function(s){ if(s.id===id) out=s; });
  return out;
};
Workspace.prototype.addSurfaceFlow = function(first){
  var types = C.SURFACE_TYPES[this.kind];
  var used = {};
  this.project.surfaces.forEach(function(s){ used[s.type]=(used[s.type]||0)+1; });
  var def = first ? types[0] : (types.filter(function(t){ return !used[t]; })[0] || types[types.length-1]);
  var pick = this.pickType(types, def);
  if (!pick) return;
  var s = C.makeSurface(pick, used[pick] ? pick+" "+(used[pick]+1) : pick);
  this.project.surfaces.push(s);
  this.activeId = s.id;
  this.startTrace();
};
Workspace.prototype.pickType = function(types, def){
  // lightweight native chooser to stay dependable + accessible
  var msg = "Which surface is this?\n" + types.map(function(t,i){ return (i+1)+". "+t; }).join("\n");
  var ans = window.prompt(msg, String(types.indexOf(def)+1));
  if (ans===null) return null;
  var n = parseInt(ans,10);
  if (n>=1 && n<=types.length) return types[n-1];
  var match = types.filter(function(t){ return t.toLowerCase().indexOf(String(ans).toLowerCase())!==-1; })[0];
  return match || def;
};
Workspace.prototype.startTrace = function(){
  this.mode="trace"; this.compare=false; this.hideCompareUI();
  $(".trace-tools",this.root).classList.remove("hidden");
  $(".color-panel",this.root).classList.add("hidden");
  $(".scheme-panel",this.root).classList.add("hidden");
  $(".est-card",this.root).classList.add("hidden");
  this.traceStatus();
  $(".canvas-note",this.root).textContent = "Tap around the edges — drag any point to fine-tune. Tap your first point to close.";
  this.render(); this.renderSurfList();
};
Workspace.prototype.traceStatus = function(){
  var s=this.active(); if(!s) return;
  var n=s.points.length, txt;
  if (s.closed) txt = "Selection closed ✓ — drag points to fine-tune.";
  else if (!n) txt = "Tap the photo to place the first point on “"+s.name+"”.";
  else if (n<3) txt = n+" point"+(n>1?"s":"")+" — keep going around the surface.";
  else txt = n+" points — tap the first point or “Close shape” to finish.";
  $(".trace-status",this.root).textContent = txt;
  $(".b-close",this.root).disabled = s.closed || n<3;
};
Workspace.prototype.traceUndo = function(){
  var s=this.active(); if(!s) return;
  if (s.closed) s.closed=false; else s.points.pop();
  delete this.layers[s.id];
  this.traceStatus(); this.render();
};
Workspace.prototype.traceReset = function(){
  var s=this.active(); if(!s) return;
  s.points=[]; s.closed=false; delete this.layers[s.id];
  this.traceStatus(); this.render();
};
Workspace.prototype.cancelTrace = function(){
  var s=this.active();
  if (s && !s.closed){
    this.project.surfaces = this.project.surfaces.filter(function(x){ return x.id!==s.id; });
    this.activeId = this.project.surfaces.length ? this.project.surfaces[this.project.surfaces.length-1].id : null;
  }
  this.mode = this.project.surfaces.length ? "paint" : "empty";
  this.refreshUI(); this.render();
};
Workspace.prototype.wholePhoto = function(){
  var s=this.active(); if(!s) return;
  var w=this.view.width,h=this.view.height,m=Math.round(Math.min(w,h)*0.02);
  s.points=[[m,m],[w-m,m],[w-m,h-m],[m,h-m]];
  this.closeTrace();
};
Workspace.prototype.closeTrace = function(){
  var s=this.active(); if(!s || s.points.length<3) return;
  s.closed=true;
  if (C.polygonArea(s.points) < this.view.width*this.view.height*0.002)
    toast("That selection is very small — you can re-edit it any time.");
  this.finishStroke(s);
  if (!s.color) s.color = this.defaultColorFor(s);
  this.queueLayer(s.id);
  this.mode="paint";
  this.refreshUI();
  this.selectSurface(s.id);
};
Workspace.prototype.defaultColorFor = function(s){
  var role = C.roleForType(s.type);
  var pick = { main:"Greige Stone", accent:"Ink Navy", trim:"Classic White", ceiling:"Gallery White", door:"Terracotta Pot", secondary:"Mushroom" }[role] || "Garden Sage";
  var found=null;
  C.PALETTE.forEach(function(c){ if(c.name===pick) found=c; });
  return found || C.PALETTE[21];
};
Workspace.prototype.finishStroke = function(s){
  if (REDUCED) return;
  var self=this, t0=null, DUR=420;
  var pts = s.points;
  function frame(t){
    if(!t0) t0=t;
    var k = Math.min(1,(t-t0)/DUR);
    self.render();
    var ctx=self.vctx;
    ctx.save();
    ctx.lineWidth=Math.max(3,self.view.width/300);
    ctx.strokeStyle="#f2731f"; ctx.lineCap="round";
    ctx.beginPath();
    var total=pts.length;
    var upto = Math.max(1, Math.floor(total*k));
    ctx.moveTo(pts[0][0],pts[0][1]);
    for(var i=1;i<=upto && i<total;i++) ctx.lineTo(pts[i][0],pts[i][1]);
    if (k>=1){ ctx.closePath(); }
    ctx.stroke(); ctx.restore();
    if (k<1) requestAnimationFrame(frame);
    else setTimeout(function(){ self.render(); }, 120);
  }
  requestAnimationFrame(frame);
};
Workspace.prototype.selectSurface = function(id){
  this.activeId=id; this.mode="paint";
  var s=this.active(); if(!s) return;
  $(".trace-tools",this.root).classList.add("hidden");
  $(".color-panel",this.root).classList.remove("hidden");
  $(".scheme-panel",this.root).classList.remove("hidden");
  $(".est-card",this.root).classList.remove("hidden");
  $(".cp-for",this.root).textContent = "Painting: "+s.name;
  $(".r-int",this.root).value = Math.round(s.intensity*100);
  $(".iv",this.root).textContent = Math.round(s.intensity*100)+"%";
  $(".r-bri",this.root).value = s.brightness;
  $(".bv",this.root).textContent = (s.brightness>0?"+":"")+s.brightness;
  if (s.color) this.reflectColor(s.color);
  $(".canvas-note",this.root).textContent = "Every surface keeps its real lighting and texture.";
  this.renderSurfList(); this.render();
};
Workspace.prototype.renderSurfList = function(){
  var self=this;
  var ul = $(".surf-list",this.root);
  var list = this.project.surfaces;
  $(".surf-hint",this.root).style.display = list.length ? "none" : "";
  ul.innerHTML="";
  list.forEach(function(s, idx){
    var li = el("li","surf-item"+(s.id===self.activeId?" on":""));
    li.innerHTML =
      '<button class="s-dot" title="Change color" aria-label="Change color of '+esc(s.name)+'" style="background:'+(s.color?s.color.hex:"transparent")+'">'+(s.color?"":"?")+'</button>' +
      '<span class="s-name" title="'+esc(s.type)+'">'+esc(s.name)+(s.closed?"":' <em>(tracing)</em>')+'</span>' +
      '<span class="s-btns">' +
        '<button class="sb s-up" aria-label="Move '+esc(s.name)+' up" '+(idx===0?"disabled":"")+'>▲</button>' +
        '<button class="sb s-down" aria-label="Move '+esc(s.name)+' down" '+(idx===list.length-1?"disabled":"")+'>▼</button>' +
        '<button class="sb s-eye" aria-label="'+(s.visible?"Hide":"Show")+' '+esc(s.name)+'" aria-pressed="'+(!s.visible)+'">'+(s.visible?"👁":"🚫")+'</button>' +
        '<button class="sb s-lock" aria-label="'+(s.locked?"Unlock":"Lock")+' '+esc(s.name)+'" aria-pressed="'+(s.locked)+'">'+(s.locked?"🔒":"🔓")+'</button>' +
        '<button class="sb s-edit" aria-label="Edit selection of '+esc(s.name)+'">✎</button>' +
        '<button class="sb s-ren" aria-label="Rename '+esc(s.name)+'">✏️</button>' +
        '<button class="sb s-dup" aria-label="Duplicate '+esc(s.name)+'">⧉</button>' +
        '<button class="sb s-del" aria-label="Delete '+esc(s.name)+'">🗑</button>' +
      '</span>';
    li.addEventListener("click", function(e){
      if (e.target.closest(".sb")) return;
      if (s.closed) self.selectSurface(s.id);
    });
    $(".s-dot",li).addEventListener("click", function(){ if(s.closed) self.selectSurface(s.id); });
    $(".s-up",li).addEventListener("click", function(){ self.reorder(idx, idx-1); });
    $(".s-down",li).addEventListener("click", function(){ self.reorder(idx, idx+1); });
    $(".s-eye",li).addEventListener("click", function(){ s.visible=!s.visible; self.renderSurfList(); self.render(); });
    $(".s-lock",li).addEventListener("click", function(){ s.locked=!s.locked; self.renderSurfList(); toast(s.locked?"“"+s.name+"” locked — schemes won’t change it.":"“"+s.name+"” unlocked"); });
    $(".s-edit",li).addEventListener("click", function(){ self.activeId=s.id; s.closed && (s.closed=true); self.startTrace(); });
    $(".s-ren",li).addEventListener("click", function(){
      var name = window.prompt("Rename surface:", s.name);
      if (name){ s.name=name.slice(0,40); self.renderSurfList(); if(s.id===self.activeId) $(".cp-for",self.root).textContent="Painting: "+s.name; }
    });
    $(".s-dup",li).addEventListener("click", function(){
      var copy = C.makeSurface(s.type, s.name+" copy");
      copy.points = s.points.map(function(p){ return [p[0]+14,p[1]+14]; });
      copy.closed = s.closed; copy.color = s.color; copy.intensity=s.intensity; copy.brightness=s.brightness;
      self.project.surfaces.splice(idx+1,0,copy);
      if (copy.closed) self.queueLayer(copy.id);
      self.renderSurfList(); self.render();
    });
    $(".s-del",li).addEventListener("click", function(){
      if (!confirmBox("Delete “"+s.name+"”?")) return;
      self.project.surfaces = self.project.surfaces.filter(function(x){ return x.id!==s.id; });
      delete self.layers[s.id];
      if (self.activeId===s.id){ self.activeId = self.project.surfaces.length?self.project.surfaces[0].id:null; }
      if (!self.project.surfaces.length){ self.mode="paint"; $(".color-panel",self.root).classList.add("hidden"); }
      self.renderSurfList(); self.render();
    });
    ul.appendChild(li);
  });
};
Workspace.prototype.reorder = function(from,to){
  var a=this.project.surfaces;
  if (to<0||to>=a.length) return;
  var x=a.splice(from,1)[0]; a.splice(to,0,x);
  this.renderSurfList(); this.render();
};
Workspace.prototype.refreshUI = function(){
  var has=this.project.surfaces.length>0, tracing=this.mode==="trace";
  $(".trace-tools",this.root).classList.toggle("hidden", !tracing);
  $(".color-panel",this.root).classList.toggle("hidden", tracing || !has);
  $(".scheme-panel",this.root).classList.toggle("hidden", tracing || !has);
  $(".est-card",this.root).classList.toggle("hidden", tracing || !has);
  this.renderSurfList();
  if (tracing) this.traceStatus();
};

/* ---------- pointer handling ---------- */
Workspace.prototype.pos = function(e){
  var r=this.view.getBoundingClientRect();
  var cx=e.touches?e.touches[0].clientX:e.clientX, cy=e.touches?e.touches[0].clientY:e.clientY;
  return { x:(cx-r.left)*(this.view.width/r.width), y:(cy-r.top)*(this.view.height/r.height) };
};
Workspace.prototype.onDown = function(e){
  if (this.compare){ this.dragDiv=true; this.moveDivider(e); return; }
  if (this.mode!=="trace") return;
  if (e.button && e.button!==0) return;
  var s=this.active(); if(!s) return;
  this.pointer.down=true; this.pointer.moved=false;
  this.pointer.downPos=this.pos(e);
  var tol=this.view.width*0.03+8;
  this.pointer.dragIdx=this.nearIdx(s,this.pointer.downPos,tol);
  if (this.pointer.dragIdx!==-1 && e.pointerType==="touch") this.showLoupe(this.pointer.downPos,e.clientX,e.clientY);
  if (this.wrap.setPointerCapture) try{ this.wrap.setPointerCapture(e.pointerId); }catch(err){}
};
Workspace.prototype.onMove = function(e){
  if (this.compare && this.dragDiv){ this.moveDivider(e); return; }
  if (!this.pointer.down || this.mode!=="trace") return;
  var s=this.active(); if(!s) return;
  var p=this.pos(e);
  if (this.pointer.dragIdx!==-1){
    this.pointer.moved=true;
    s.points[this.pointer.dragIdx]=[Math.max(0,Math.min(this.view.width,p.x)),Math.max(0,Math.min(this.view.height,p.y))];
    if (s.closed) this.queueLayer(s.id, 300);
    if (e.pointerType==="touch") this.showLoupe(p,e.clientX,e.clientY);
    this.render();
  } else if (this.pointer.downPos && Math.hypot(p.x-this.pointer.downPos.x,p.y-this.pointer.downPos.y)>12){
    this.pointer.moved=true;
  }
};
Workspace.prototype.onUp = function(e){
  if (this.compare){ this.dragDiv=false; return; }
  this.hideLoupe();
  if (!this.pointer.down || this.mode!=="trace") return;
  this.pointer.down=false;
  var s=this.active(); if(!s) return;
  var wasDrag=this.pointer.dragIdx!==-1 && this.pointer.moved;
  var tapped=this.pointer.dragIdx;
  this.pointer.dragIdx=-1;
  if (wasDrag){ this.traceStatus(); this.render(); return; }
  if (this.pointer.moved) return;
  if (s.closed) return;
  var p=this.pos(e);
  if (s.points.length>=3 && tapped===0){ this.closeTrace(); return; }
  if (tapped!==-1) return;
  s.points.push([p.x,p.y]);
  this.traceStatus(); this.render();
};
Workspace.prototype.nearIdx = function(s,p,tol){
  for(var i=0;i<s.points.length;i++){
    if (Math.hypot(s.points[i][0]-p.x,s.points[i][1]-p.y)<tol) return i;
  }
  return -1;
};
Workspace.prototype.showLoupe = function(p,cx,cy){
  var l=$(".loupe",this.root), r=this.wrap.getBoundingClientRect();
  l.style.display="block";
  l.style.left=Math.min(r.width-120,Math.max(10,cx-r.left-55))+"px";
  l.style.top=(cy-r.top-150)+"px";
  var ctx=$(".loupe-c",this.root).getContext("2d");
  ctx.imageSmoothingEnabled=false;
  ctx.clearRect(0,0,110,110);
  ctx.drawImage(this.view,p.x-27,p.y-27,55,55,0,0,110,110);
  ctx.strokeStyle="#f2731f"; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(55,40); ctx.lineTo(55,70); ctx.moveTo(40,55); ctx.lineTo(70,55); ctx.stroke();
};
Workspace.prototype.hideLoupe = function(){ $(".loupe",this.root).style.display="none"; };

/* ---------- layers & render ---------- */
Workspace.prototype.queueLayer = function(id, delay){
  var self=this;
  clearTimeout(this.rebuildT);
  this.rebuildT=setTimeout(function(){ self.buildLayer(id); }, delay==null?120:delay);
};
Workspace.prototype.buildLayer = function(id){
  var s=null; this.project.surfaces.forEach(function(x){ if(x.id===id) s=x; });
  if (!s || !s.closed || !s.color || !this.imgCanvas) return;
  var w=this.view.width,h=this.view.height;
  var mix=$(".mixing",this.root); mix.classList.add("show");
  var self=this;
  setTimeout(function(){
    var mask=document.createElement("canvas"); mask.width=w; mask.height=h;
    var mc=mask.getContext("2d");
    var feather=Math.max(1.5,w/500);
    if (mc.filter!==undefined) mc.filter="blur("+feather+"px)";
    mc.fillStyle="#fff"; mc.beginPath();
    mc.moveTo(s.points[0][0],s.points[0][1]);
    for(var i=1;i<s.points.length;i++) mc.lineTo(s.points[i][0],s.points[i][1]);
    mc.closePath(); mc.fill();
    var maskData=mask.getContext("2d").getImageData(0,0,w,h).data;
    var src=self.imgCanvas.getContext("2d").getImageData(0,0,w,h);
    var sd=src.data;
    var lums=[];
    for(var q=0;q<sd.length;q+=4*97){ if(maskData[q+3]>200) lums.push(C.luminance(sd[q],sd[q+1],sd[q+2])); }
    lums.sort(function(a,b){return a-b;});
    var mid=lums.length?lums[Math.floor(lums.length/2)]:0.72;
    var target=C.hexToRgb(s.color.hex);
    var t=C.rgbToHsl(target.r,target.g,target.b);
    var bright=s.brightness/100;
    var out=new ImageData(w,h), od=out.data;
    for(var p=0;p<sd.length;p+=4){
      var a=maskData[p+3]; if(!a) continue;
      var L=(0.299*sd[p]+0.587*sd[p+1]+0.114*sd[p+2])/255;
      var newL=Math.max(0.02,Math.min(0.98,t.l+(L-mid)*0.85+bright));
      var rgb=C.hslToRgb(t.h,t.s,newL);
      od[p]=rgb.r; od[p+1]=rgb.g; od[p+2]=rgb.b; od[p+3]=a;
    }
    var layer=document.createElement("canvas"); layer.width=w; layer.height=h;
    layer.getContext("2d").putImageData(out,0,0);
    self.layers[id]=layer;
    mix.classList.remove("show");
    self.render();
  }, 30);
};
Workspace.prototype.composite = function(ctx, w, h, skipLighting){
  ctx.drawImage(this.imgCanvas,0,0,w,h);
  var self=this;
  this.project.surfaces.forEach(function(s){
    if (!s.visible || !s.closed || !self.layers[s.id]) return;
    ctx.globalAlpha = s.intensity;
    ctx.drawImage(self.layers[s.id],0,0,w,h);
    ctx.globalAlpha = 1;
  });
  if (!skipLighting){
    C.lightingOps(this.project.lighting).forEach(function(op){
      ctx.save();
      ctx.globalCompositeOperation = op.op;
      ctx.globalAlpha = op.alpha;
      ctx.fillStyle = op.color;
      ctx.fillRect(0,0,w,h);
      ctx.restore();
    });
  }
};
Workspace.prototype.render = function(){
  if (!this.imgCanvas) return;
  var ctx=this.vctx, w=this.view.width, h=this.view.height;
  ctx.clearRect(0,0,w,h);
  if (this.holding){ ctx.drawImage(this.imgCanvas,0,0); }
  else if (this.compare){
    ctx.drawImage(this.imgCanvas,0,0);
    var cut=w*this.dividerPct;
    ctx.save(); ctx.beginPath(); ctx.rect(cut,0,w-cut,h); ctx.clip();
    this.composite(ctx,w,h);
    ctx.restore();
    ctx.save();
    ctx.font="600 "+Math.max(12,w/60)+"px Inter, sans-serif";
    ctx.fillStyle="rgba(13,19,32,.7)"; ctx.fillRect(10,10,76,30);
    ctx.fillStyle="#f4efe6"; ctx.fillText("BEFORE",18,30);
    ctx.fillStyle="#e2591f"; ctx.fillRect(w-80,10,70,30);
    ctx.fillStyle="#fff"; ctx.fillText("AFTER",w-70,30);
    ctx.restore();
  } else {
    this.composite(ctx,w,h);
  }
  if (this.mode==="trace") this.drawPoly(ctx);
};
Workspace.prototype.drawPoly = function(ctx){
  var s=this.active(); if(!s||!s.points.length) return;
  ctx.save();
  ctx.lineWidth=Math.max(2,this.view.width/450);
  ctx.strokeStyle="#f2731f";
  ctx.setLineDash(s.closed?[]:[8,6]);
  ctx.beginPath();
  ctx.moveTo(s.points[0][0],s.points[0][1]);
  for(var i=1;i<s.points.length;i++) ctx.lineTo(s.points[i][0],s.points[i][1]);
  if (s.closed) ctx.closePath();
  ctx.stroke();
  if (s.closed){ ctx.fillStyle="rgba(242,115,31,.13)"; ctx.fill(); }
  var r=Math.max(6,this.view.width/160);
  s.points.forEach(function(p,i){
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(p[0],p[1],r,0,7);
    ctx.fillStyle=i===0?"#f2731f":"#f4efe6"; ctx.fill();
    ctx.strokeStyle="#0d1320"; ctx.lineWidth=2; ctx.stroke();
  });
  ctx.restore();
};

/* ---------- compare / fullscreen ---------- */
Workspace.prototype.toggleCompare = function(){
  this.compare=!this.compare;
  var d=$(".divider-line",this.root);
  d.style.display=this.compare?"block":"none";
  $(".b-compare",this.root).setAttribute("aria-pressed",this.compare?"true":"false");
  if (this.compare) this.positionDivider();
  this.render();
};
Workspace.prototype.hideCompareUI = function(){
  this.compare=false;
  $(".divider-line",this.root).style.display="none";
  $(".b-compare",this.root).setAttribute("aria-pressed","false");
};
Workspace.prototype.positionDivider = function(){
  var d=$(".divider-line",this.root);
  d.style.left=(this.dividerPct*100)+"%";
  d.setAttribute("aria-valuenow",Math.round(this.dividerPct*100));
};
Workspace.prototype.moveDivider = function(e){
  var r=this.wrap.getBoundingClientRect();
  var x=(e.touches?e.touches[0].clientX:e.clientX)-r.left;
  this.dividerPct=Math.max(.05,Math.min(.95,x/r.width));
  this.positionDivider(); this.render();
};
Workspace.prototype.toggleFullscreen = function(btn){
  var card=$(".canvas-card",this.root);
  if (card.classList.contains("fullscreen-mode")){
    card.classList.remove("fullscreen-mode");
    if (document.fullscreenElement) document.exitFullscreen().catch(function(){});
    btn.textContent="⛶ Full screen";
  } else {
    card.classList.add("fullscreen-mode");
    if (card.requestFullscreen) card.requestFullscreen().catch(function(){});
    btn.textContent="✕ Exit full screen";
  }
};

/* ---------- color panel ---------- */
Workspace.prototype.reflectColor = function(c){
  $(".sel-dot",this.root).style.background=c.hex;
  $(".sel-name",this.root).textContent=c.name;
  $(".sel-meta",this.root).textContent=(c.family||"Custom")+" · "+(c.undertone||"custom")+" · "+c.hex.toUpperCase();
  var trim=C.trimFor(c.undertone);
  $(".sel-trim",this.root).innerHTML="Trim pairing: <i style=\"background:"+trim.hex+"\"></i> "+trim.name;
  $(".c-custom",this.root).value=c.hex;
  $(".c-hex",this.root).value=c.hex.toUpperCase();
  var favs=lsGet("vdp-favs",[]);
  var b=$(".b-fav",this.root);
  b.classList.toggle("on",favs.indexOf(c.hex)!==-1);
  b.setAttribute("aria-pressed",favs.indexOf(c.hex)!==-1?"true":"false");
  this.markSwatches();
};
Workspace.prototype.setColor = function(c){
  var s=this.active(); if(!s){ toast("Trace a surface first, then pick its color."); return; }
  if (s.locked){ toast("“"+s.name+"” is locked."); return; }
  s.color=c;
  this.reflectColor(c);
  this.pushRecent(c);
  this.renderSurfList();
  this.queueLayer(s.id);
};
Workspace.prototype.customColor = function(hex){
  var found=null;
  C.PALETTE.forEach(function(c){ if(c.hex.toLowerCase()===hex.toLowerCase()) found=c; });
  if (found) return found;
  return { name:"Custom "+hex.toUpperCase(), hex:hex, family:"Custom", undertone:C.undertoneOfHex(hex) };
};
Workspace.prototype.applyHexInput = function(){
  var v=$(".c-hex",this.root).value.trim();
  if (v && v[0]!=="#") v="#"+v;
  if (!C.hexToRgb(v)){ toast("That doesn’t look like a valid hex code (e.g. #8A9A7E)."); return; }
  this.setColor(this.customColor(v));
};
Workspace.prototype.renderChips = function(){
  var self=this, elc=$(".fam-chips",this.root);
  elc.innerHTML="";
  var fams=C.FAMILIES ? C.FAMILIES.slice() : ["All"];
  if (lsGet("vdp-favs",[]).length) fams.splice(1,0,"♥ Favorites");
  fams.forEach(function(f){
    var b=el("button","chip"+(f===self.famActive?" on":""),esc(f));
    b.type="button";
    b.addEventListener("click",function(){ self.famActive=f; self.renderChips(); self.renderSwatches(); });
    elc.appendChild(b);
  });
};
Workspace.prototype.renderSwatches = function(){
  var self=this, grid=$(".sw-grid",this.root);
  var q=$(".c-search",this.root).value.trim().toLowerCase();
  var favs=lsGet("vdp-favs",[]);
  grid.innerHTML="";
  var list=C.PALETTE.filter(function(c){
    if (self.famActive==="♥ Favorites" && favs.indexOf(c.hex)===-1) return false;
    if (self.famActive!=="All" && self.famActive!=="♥ Favorites" && c.family!==self.famActive) return false;
    if (q && (c.name+" "+c.family+" "+c.undertone).toLowerCase().indexOf(q)===-1) return false;
    return true;
  });
  list.forEach(function(c){
    var b=el("button","sw"+(favs.indexOf(c.hex)!==-1?" isfav":""));
    b.type="button"; b.style.background=c.hex; b.title=c.name+" "+c.hex;
    b.setAttribute("aria-label",c.name+", "+c.family);
    b.dataset.hex=c.hex;
    b.innerHTML='<span class="fav">♥</span>';
    b.addEventListener("click",function(){ self.setColor(c); });
    grid.appendChild(b);
  });
  if (!list.length) grid.innerHTML='<p style="grid-column:1/-1;color:var(--muted);font-size:13px">No colors match.</p>';
  this.markSwatches();
};
Workspace.prototype.markSwatches = function(){
  var s=this.active(), hex=s&&s.color?s.color.hex:null;
  $$(".sw-grid .sw",this.root).forEach(function(x){ x.classList.toggle("sel",x.dataset.hex===hex); });
};
Workspace.prototype.pushRecent = function(c){
  var r=lsGet("vdp-recent",[]).filter(function(x){ return x.hex!==c.hex; });
  r.unshift({name:c.name,hex:c.hex,family:c.family,undertone:c.undertone});
  lsSet("vdp-recent",r.slice(0,8));
  this.renderRecents();
};
Workspace.prototype.renderRecents = function(){
  var self=this, r=lsGet("vdp-recent",[]);
  $(".recent-wrap",this.root).classList.toggle("hidden",!r.length);
  var g=$(".r-grid",this.root); g.innerHTML="";
  r.forEach(function(c){
    var b=el("button","sw"); b.type="button"; b.style.background=c.hex; b.title=c.name;
    b.setAttribute("aria-label","Recent: "+c.name);
    b.addEventListener("click",function(){ self.setColor(c); });
    g.appendChild(b);
  });
};
Workspace.prototype.toggleFav = function(){
  var s=this.active(); if(!s||!s.color) return;
  var f=lsGet("vdp-favs",[]), i=f.indexOf(s.color.hex);
  if (i===-1){ f.push(s.color.hex); toast("Saved to favorites"); } else f.splice(i,1);
  lsSet("vdp-favs",f);
  this.reflectColor(s.color); this.renderChips(); this.renderSwatches();
};

/* ---------- schemes ---------- */
Workspace.prototype.readPermanent = function(){
  if (this.kind!=="exterior") return;
  this.project.permanent = {
    roof: $(".perm-roof",this.root).value, brick: $(".perm-brick",this.root).value,
    stone: $(".perm-stone",this.root).value, style: $(".perm-style",this.root).value,
    setting: $(".perm-setting",this.root).value
  };
};
Workspace.prototype.renderSchemes = function(){
  var self=this, box=$(".scheme-list",this.root);
  var favs=lsGet("vdp-schemefavs",[]);
  var list;
  if (this.kind==="exterior"){
    var ranked=C.rankExteriorSchemes(this.project.permanent);
    list=ranked.map(function(r,i){ return { s:r.scheme, best:i<3 && r.score>0 }; });
  } else {
    list=C.schemesFor("interior").map(function(s){ return { s:s, best:false }; });
  }
  box.innerHTML="";
  list.forEach(function(item){
    var s=item.s;
    var dots=["main","accent","trim","door","secondary"].filter(function(k){return s.colors[k];})
      .map(function(k){ return '<i style="background:'+s.colors[k].hex+'" title="'+esc(k+": "+s.colors[k].name)+'"></i>'; }).join("");
    var card=el("div","scheme-card");
    card.innerHTML =
      '<div class="sc-top"><b>'+esc(s.name)+'</b>'+(item.best?'<span class="best">Good match</span>':"")+
      '<button class="sb sc-fav" aria-label="Save scheme" aria-pressed="'+(favs.indexOf(s.key)!==-1)+'">'+(favs.indexOf(s.key)!==-1?"♥":"♡")+'</button></div>' +
      '<div class="sc-dots">'+dots+'</div>' +
      '<p class="sc-why">'+esc(s.why)+'</p>' +
      '<button class="btn btn-soft small sc-apply" type="button">Apply to my surfaces</button>';
    $(".sc-apply",card).addEventListener("click",function(){ self.applySchemeUI(s); });
    $(".sc-fav",card).addEventListener("click",function(){
      var f=lsGet("vdp-schemefavs",[]), i=f.indexOf(s.key);
      if (i===-1){ f.push(s.key); toast("Scheme saved to this device"); } else f.splice(i,1);
      lsSet("vdp-schemefavs",f); self.renderSchemes();
    });
    box.appendChild(card);
  });
};
Workspace.prototype.applySchemeUI = function(scheme){
  var self=this;
  var colored=this.project.surfaces.filter(function(s){ return s.color && s.closed; }).length;
  if (!this.project.surfaces.filter(function(s){return s.closed;}).length){
    toast("Trace at least one surface first — then a scheme can color it."); return;
  }
  if (colored && !confirmBox("Apply “"+scheme.name+"”? This recolors your unlocked surfaces (locked ones keep their color).")) return;
  var assigns=C.applyScheme(this.project.surfaces, scheme);
  assigns.forEach(function(a){
    self.project.surfaces.forEach(function(s){
      if (s.id===a.id && s.closed){ s.color=a.color; self.queueLayerNow(s.id); }
    });
  });
  var act=this.active();
  if (act && act.color) this.reflectColor(act.color);
  this.renderSurfList();
  toast("“"+scheme.name+"” applied — tweak any surface after.");
};
Workspace.prototype.queueLayerNow = function(id){
  var self=this;
  setTimeout(function(){ self.buildLayer(id); }, 20);
};

/* ---------- exterior options (A/B/C) & door playground ---------- */
Workspace.prototype.snapshotOption = function(){
  if (this.project.schemes.length>=3){ toast("You already have three options — delete or overwrite one."); }
  var letter="ABC"[Math.min(this.project.schemes.length,2)];
  var name=window.prompt("Name this option:", "Option "+letter);
  if (name===null) return;
  var colors={};
  this.project.surfaces.forEach(function(s){ if(s.color) colors[s.id]={name:s.color.name,hex:s.color.hex,family:s.color.family,undertone:s.color.undertone}; });
  var snap={ id:"o"+Math.random().toString(36).slice(2,7), name:(name||("Option "+letter)).slice(0,24), colors:colors, fav:false };
  if (this.project.schemes.length>=3) this.project.schemes[2]=snap;
  else this.project.schemes.push(snap);
  this.renderOptions();
  toast("Saved “"+snap.name+"” — keep designing, then compare.");
};
Workspace.prototype.renderOptions = function(){
  var self=this, box=$(".opt-chips",this.root);
  if (!box) return;
  box.innerHTML="";
  this.project.schemes.forEach(function(o,idx){
    var chip=el("span","opt-chip");
    chip.innerHTML='<button class="oc-apply" type="button" title="Apply this option">'+esc(o.name)+'</button>' +
      '<button class="sb oc-fav" aria-label="Favorite '+esc(o.name)+'" aria-pressed="'+o.fav+'">'+(o.fav?"★":"☆")+'</button>' +
      '<button class="sb oc-ren" aria-label="Rename '+esc(o.name)+'">✏️</button>' +
      '<button class="sb oc-dup" aria-label="Duplicate '+esc(o.name)+'">⧉</button>' +
      '<button class="sb oc-del" aria-label="Delete '+esc(o.name)+'">✕</button>';
    $(".oc-apply",chip).addEventListener("click",function(){ self.applyOption(o); });
    $(".oc-fav",chip).addEventListener("click",function(){
      self.project.schemes.forEach(function(x){ x.fav = x.id===o.id ? !x.fav : false; });
      self.renderOptions();
    });
    $(".oc-ren",chip).addEventListener("click",function(){
      var n=window.prompt("Rename option:",o.name); if(n){ o.name=n.slice(0,24); self.renderOptions(); }
    });
    $(".oc-dup",chip).addEventListener("click",function(){
      if (self.project.schemes.length>=3){ toast("Three options max — delete one first."); return; }
      self.project.schemes.push({ id:"o"+Math.random().toString(36).slice(2,7), name:(o.name+" copy").slice(0,24), colors:JSON.parse(JSON.stringify(o.colors)), fav:false });
      self.renderOptions();
    });
    $(".oc-del",chip).addEventListener("click",function(){
      if (!confirmBox("Delete “"+o.name+"”?")) return;
      self.project.schemes=self.project.schemes.filter(function(x){return x.id!==o.id;});
      self.renderOptions();
    });
    box.appendChild(chip);
  });
  $(".b-compare-opts",this.root).disabled = this.project.schemes.length<2;
};
Workspace.prototype.applyOption = function(o){
  var self=this;
  this.project.surfaces.forEach(function(s){
    if (o.colors[s.id]){ s.color=o.colors[s.id]; self.queueLayerNow(s.id); }
  });
  var act=this.active(); if(act&&act.color) this.reflectColor(act.color);
  this.renderSurfList();
  toast("“"+o.name+"” applied");
};
Workspace.prototype.renderSchemeTo = function(colors, size){
  // temporarily swap colors, render composite to an offscreen canvas
  var self=this;
  var keep={};
  this.project.surfaces.forEach(function(s){ keep[s.id]=s.color; if(colors[s.id]) s.color=colors[s.id]; });
  // rebuild layers synchronously at low res
  var scale=size/this.view.width;
  var w=size, h=Math.round(this.view.height*scale);
  var out=document.createElement("canvas"); out.width=w; out.height=h;
  var ctx=out.getContext("2d");
  ctx.drawImage(this.imgCanvas,0,0,w,h);
  this.project.surfaces.forEach(function(s){
    if (!s.closed || !s.color || !s.visible) return;
    var mask=document.createElement("canvas"); mask.width=w; mask.height=h;
    var mc=mask.getContext("2d");
    if (mc.filter!==undefined) mc.filter="blur(1px)";
    mc.fillStyle="#fff"; mc.beginPath();
    mc.moveTo(s.points[0][0]*scale,s.points[0][1]*scale);
    for(var i=1;i<s.points.length;i++) mc.lineTo(s.points[i][0]*scale,s.points[i][1]*scale);
    mc.closePath(); mc.fill();
    var md=mask.getContext("2d").getImageData(0,0,w,h).data;
    var img=ctx.getImageData(0,0,w,h), d=img.data;
    var lums=[];
    for(var q=0;q<d.length;q+=4*53){ if(md[q+3]>200) lums.push(C.luminance(d[q],d[q+1],d[q+2])); }
    lums.sort(function(a,b){return a-b;});
    var mid=lums.length?lums[Math.floor(lums.length/2)]:0.72;
    var tt=C.hexToRgb(s.color.hex), t=C.rgbToHsl(tt.r,tt.g,tt.b);
    for(var p=0;p<d.length;p+=4){
      var a=md[p+3]; if(!a) continue;
      var L=(0.299*d[p]+0.587*d[p+1]+0.114*d[p+2])/255;
      var newL=Math.max(0.02,Math.min(0.98,t.l+(L-mid)*0.85));
      var rgb=C.hslToRgb(t.h,t.s,newL);
      var f=(a/255)*s.intensity;
      d[p]=rgb.r*f+d[p]*(1-f); d[p+1]=rgb.g*f+d[p+1]*(1-f); d[p+2]=rgb.b*f+d[p+2]*(1-f);
    }
    ctx.putImageData(img,0,0);
  });
  this.project.surfaces.forEach(function(s){ s.color=keep[s.id]; });
  return out;
};
Workspace.prototype.compareOptions = function(){
  var self=this, modal=$(".cmp-modal",this.root), grid=$(".cmp-grid",this.root);
  grid.innerHTML="";
  this.project.schemes.forEach(function(o){
    var c=self.renderSchemeTo(o.colors, 380);
    var cell=el("div","cmp-cell");
    cell.appendChild(c);
    var cap=el("div","cmp-cap","<b>"+esc(o.name)+(o.fav?" ★":"")+"</b>");
    var btn=el("button","btn btn-soft small","Use this one"); btn.type="button";
    btn.addEventListener("click",function(){ self.applyOption(o); modal.classList.add("hidden"); });
    cap.appendChild(btn);
    cell.appendChild(cap);
    grid.appendChild(cell);
  });
  modal.classList.remove("hidden");
};
var DOOR_COLORS=["#C07B57","#22314A","#2F4038","#5E3A3E","#2E2B28","#8E5B3F","#5E7F8F","#463A4B"];
Workspace.prototype.doorPlay = function(){
  var self=this;
  var door=null;
  this.project.surfaces.forEach(function(s){ if(/front door/i.test(s.type)&&s.closed) door=s; });
  if (!door){ toast("Trace a “Front door” surface first, then play."); return; }
  this.doorIdx=((this.doorIdx==null?-1:this.doorIdx)+1)%DOOR_COLORS.length;
  var hex=DOOR_COLORS[this.doorIdx];
  var names={"#C07B57":"Terracotta Pot","#22314A":"Ink Navy","#2F4038":"Deep Evergreen","#5E3A3E":"Bordeaux","#2E2B28":"Soft Black","#8E5B3F":"Cinnamon Stick","#5E7F8F":"Lake House Blue","#463A4B":"Aubergine Night"};
  door.color={name:names[hex],hex:hex,family:"Dramatic",undertone:C.undertoneOfHex(hex)};
  this.queueLayerNow(door.id);
  this.renderSurfList();
  if (this.activeId===door.id) this.reflectColor(door.color);
  toast("Front door: "+names[hex]+" — tap again for the next one");
};

/* ---------- exports ---------- */
Workspace.prototype.exportPreview = function(){
  var w=this.view.width,h=this.view.height;
  var c=document.createElement("canvas"); c.width=w; c.height=h;
  var x=c.getContext("2d");
  this.composite(x,w,h);
  var bh=Math.max(26,Math.round(h*0.05));
  x.fillStyle="rgba(13,19,32,.85)"; x.fillRect(0,h-bh,w,bh);
  x.fillStyle="#f4efe6"; x.font="600 "+Math.round(bh*0.4)+"px Inter, Arial, sans-serif"; x.textBaseline="middle";
  var names=this.project.surfaces.filter(function(s){return s.color;}).map(function(s){return s.color.name;});
  var uniq=names.filter(function(v,i){return names.indexOf(v)===i;}).slice(0,3).join(" · ");
  x.fillText((uniq||"Color preview")+"  ·  Van Dam Painting", Math.round(bh*0.4), h-bh/2);
  return c;
};
Workspace.prototype.downloadCanvas = function(c, fname){
  return new Promise(function(res){
    c.toBlob(function(blob){
      var a=document.createElement("a"), url=URL.createObjectURL(blob);
      a.href=url; a.download=fname;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function(){ URL.revokeObjectURL(url); },4000);
      res();
    },"image/jpeg",0.92);
  });
};
Workspace.prototype.downloadPreview = function(){
  return this.downloadCanvas(this.exportPreview(),"vandam-color-preview.jpg");
};
Workspace.prototype.share = function(){
  var self=this;
  this.exportPreview().toBlob(function(blob){
    var file=new File([blob],"vandam-color-preview.jpg",{type:"image/jpeg"});
    if (navigator.canShare && navigator.canShare({files:[file]})){
      navigator.share({files:[file],title:"My Van Dam color preview",
        text:"Previewed with the Van Dam Design Studio — "+SITE_URL}).catch(function(){});
    } else {
      self.downloadPreview().then(function(){ toast("Sharing isn’t available here — preview downloaded instead."); });
    }
  },"image/jpeg",0.92);
};
Workspace.prototype.exportBoard = function(){
  var self=this;
  var logo=new Image();
  logo.onload=function(){ self.buildBoard(logo); };
  logo.onerror=function(){ self.buildBoard(null); };
  logo.src="logo-exact.png";
};
Workspace.prototype.buildBoard = function(logo){
  var W=1240, pad=48;
  var pw=(W-pad*3)/2;
  var ratio=this.view.height/this.view.width;
  var ph=Math.round(pw*ratio);
  var surfs=this.project.surfaces.filter(function(s){return s.closed;});
  var listH=surfs.length*46+70;
  var optH=(this.kind==="exterior"&&this.project.schemes.length)?(this.project.schemes.length*54+60):0;
  var H=170+ph+70+listH+optH+210;
  var c=document.createElement("canvas"); c.width=W; c.height=H;
  var x=c.getContext("2d");
  x.fillStyle="#0d1320"; x.fillRect(0,0,W,H);
  // header
  if (logo){
    var lh=54, lw=Math.round(logo.width*lh/logo.height);
    x.fillStyle="#f4efe6"; roundRect(x,pad,34,lw+28,lh+18,10); x.fill();
    x.drawImage(logo,pad+14,34+9,lw,lh);
  }
  x.fillStyle="#f4efe6"; x.font="600 44px Georgia, serif";
  x.fillText("Project Vision Board", pad+ (logo? Math.round(logo.width*54/logo.height)+70 : 0), 78);
  x.fillStyle="#94a0b5"; x.font="400 21px Arial";
  var pname=this.project.name||("My "+this.kind+" project");
  x.fillText(pname+"  ·  "+new Date().toLocaleDateString(), pad+(logo? Math.round(logo.width*54/logo.height)+70:0), 110);
  // photos
  var y0=170;
  x.font="700 17px Arial";
  x.fillStyle="#94a0b5"; x.fillText("BEFORE", pad, y0-12);
  x.fillStyle="#f2731f"; x.fillText("AFTER", pad*2+pw, y0-12);
  x.drawImage(this.imgCanvas, pad, y0, pw, ph);
  var after=document.createElement("canvas"); after.width=this.view.width; after.height=this.view.height;
  this.composite(after.getContext("2d"), this.view.width, this.view.height);
  x.drawImage(after, pad*2+pw, y0, pw, ph);
  // surfaces
  var y=y0+ph+58;
  x.fillStyle="#f4efe6"; x.font="600 28px Georgia, serif";
  x.fillText("Selected surfaces & colors", pad, y);
  y+=26;
  x.font="400 20px Arial";
  surfs.forEach(function(s){
    y+=46;
    if (s.color){
      x.fillStyle=s.color.hex; roundRect(x,pad,y-24,34,34,7); x.fill();
      x.strokeStyle="rgba(255,255,255,.25)"; x.stroke();
      x.fillStyle="#f4efe6";
      x.fillText(s.name+" — "+s.color.name+"  ("+s.color.hex.toUpperCase()+")", pad+50, y);
    } else {
      x.fillStyle="#94a0b5";
      x.fillText(s.name+" — color still open", pad+50, y);
    }
  });
  // exterior options
  if (optH){
    y+=54;
    x.fillStyle="#f4efe6"; x.font="600 28px Georgia, serif";
    x.fillText("Options considered", pad, y);
    x.font="400 20px Arial";
    this.project.schemes.forEach(function(o){
      y+=54;
      var xx=pad;
      Object.keys(o.colors).slice(0,6).forEach(function(k){
        x.fillStyle=o.colors[k].hex; roundRect(x,xx,y-22,30,30,6); x.fill(); xx+=38;
      });
      x.fillStyle="#f4efe6"; x.fillText(o.name+(o.fav?"  ★ favorite":""), xx+14, y);
    });
  }
  // footer
  y=H-150;
  x.strokeStyle="rgba(244,239,230,.15)"; x.beginPath(); x.moveTo(pad,y); x.lineTo(W-pad,y); x.stroke();
  x.fillStyle="#94a0b5"; x.font="400 17px Arial";
  wrapText(x,"Digital previews are an approximation. Lighting, screens, surface texture, sunlight, weather, and paint sheen affect the final appearance. Bryan can confirm final colors with real samples in your space.",pad,y+32,W-pad*2,24);
  x.fillStyle="#f4efe6"; x.font="700 20px Arial";
  x.fillText("Van Dam Painting · "+CFG.business.phoneDisplay+" · "+CFG.business.town, pad, y+96);
  x.fillStyle="#f2731f"; x.font="400 18px Arial";
  x.fillText("Created with the Van Dam Color Studio — "+SITE_URL, pad, y+126);
  this.downloadCanvas(c,"vandam-project-board.jpg").then(function(){ toast("Project board downloaded — perfect for texting to Bryan."); });
};
function roundRect(x,px,py,w,h,r){
  x.beginPath();
  x.moveTo(px+r,py); x.arcTo(px+w,py,px+w,py+h,r); x.arcTo(px+w,py+h,px,py+h,r);
  x.arcTo(px,py+h,px,py,r); x.arcTo(px,py,px+w,py,r); x.closePath();
}
function wrapText(ctx,text,x,y,maxW,lh){
  var words=text.split(" "), line="";
  words.forEach(function(w){
    var t=line+w+" ";
    if (ctx.measureText(t).width>maxW){ ctx.fillText(line,x,y); line=w+" "; y+=lh; }
    else line=t;
  });
  ctx.fillText(line,x,y);
}

/* ---------- save / estimate ---------- */
Workspace.prototype.thumb = function(){
  try {
    var w=320, h=Math.round(this.view.height*320/this.view.width);
    var c=document.createElement("canvas"); c.width=w; c.height=h;
    this.composite(c.getContext("2d"),w,h);
    return c.toDataURL("image/jpeg",0.7);
  } catch(e){ return null; }
};
Workspace.prototype.saveProject = function(){
  if (!this.imgCanvas){ toast("Add a photo first."); return; }
  this.project.updatedAt=Date.now();
  if (!this.project.name) this.project.name = $(".proj-name",this.root).value || "";
  // regenerate the stored photo from the CURRENT working canvas and
  // scale polygon points into that photo's coordinate space, so a
  // restored project lines up exactly.
  var sfit=C.fitWithin(this.view.width,this.view.height,800);
  var sc=document.createElement("canvas"); sc.width=sfit.w; sc.height=sfit.h;
  sc.getContext("2d").drawImage(this.imgCanvas,0,0,sfit.w,sfit.h);
  this.project.photo=sc.toDataURL("image/jpeg",0.72);
  var k=sfit.w/this.view.width;
  var rec=JSON.parse(C.serializeProject(this.project));
  rec.surfaces.forEach(function(s){
    s.points=s.points.map(function(p){ return [Math.round(p[0]*k*10)/10, Math.round(p[1]*k*10)/10]; });
  });
  rec.thumb=this.thumb();
  var all=lsGet("vdp-projects",[]);
  var idx=-1;
  all.forEach(function(p,i){ if(p.id===rec.id) idx=i; });
  if (idx===-1) all.unshift(rec); else all[idx]=rec;
  if (!lsSet("vdp-projects",all)){
    // storage full: retry with smaller photo, then without photo
    rec.photo=null; rec.thumb=null;
    if (idx===-1) all[0]=rec; else all[idx]=rec;
    if (lsSet("vdp-projects",all)) toast("Saved without the photo — this device’s storage is nearly full.");
    else toast("Couldn’t save — this browser’s storage is full. Try exporting the project instead.");
    return;
  }
  toast("Project saved on this device"+(rec.name?": “"+rec.name+"”":""));
  Saved.refresh && Saved.refresh();
};
Workspace.prototype.estimate = function(){
  var self=this;
  var summary=C.estimateSummaryFromProject(this.project);
  var first=null;
  this.project.surfaces.forEach(function(s){ if(!first && s.color) first=s.color; });
  var payload={
    colorName:first?first.name:"", colorHex:first?first.hex.toUpperCase():"",
    service:this.kind==="exterior"?"Exterior painting":"Interior painting",
    desc:summary, ts:Date.now()
  };
  try{ localStorage.setItem("vdp-handoff",JSON.stringify(payload)); }catch(e){}
  var go=function(){ window.location.href="index.html#quote"; };
  if ($(".inc-dl",this.root).checked) this.downloadPreview().then(function(){ setTimeout(go,350); });
  else go();
};
Workspace.prototype.loadProject = function(p){
  var self=this;
  this.project={ id:p.id, name:p.name==="Untitled project"?"":p.name, type:p.type, photo:p.photo,
    surfaces:p.surfaces, lighting:p.lighting, permanent:p.permanent||{}, schemes:p.schemes||[],
    quiz:p.quiz||null, createdAt:p.createdAt, updatedAt:p.updatedAt };
  $(".proj-name",this.root).value=this.project.name||"";
  if (!p.photo){ toast("This project was saved without its photo — add the photo again to continue."); this.resetAll(); return; }
  var img=new Image();
  img.onload=function(){
    var c=document.createElement("canvas"); c.width=img.width; c.height=img.height;
    c.getContext("2d").drawImage(img,0,0);
    self.imgCanvas=c;
    self.view.width=img.width; self.view.height=img.height;
    // saved points are in the working-res space of the ORIGINAL session (<=1400).
    // Our restored working canvas is the saved 800px photo — rescale points.
    $(".up-stage",self.root).classList.add("hidden");
    $(".ws",self.root).classList.remove("hidden");
    self.mode="paint";
    self.layers={};
    self.project.surfaces.forEach(function(s){
      if (s._space !== "restored"){
        // points were stored relative to a canvas whose width we stored in p._w (if present)
      }
      self.queueLayerNow(s.id);
    });
    self.activeId=self.project.surfaces.length?self.project.surfaces[0].id:null;
    if (self.activeId) self.selectSurface(self.activeId);
    self.refreshUI();
    if (self.kind==="exterior") self.renderOptions();
    $$(".lt",self.root).forEach(function(b){ b.classList.toggle("on",b.dataset.lt===self.project.lighting); });
    self.render();
  };
  img.src=p.photo;
};

/* ================================================================
   QUIZ TAB
   ================================================================ */
var Quiz = {
  answers:{}, recs:null, step:0,
  QS:[
    { key:"room", q:"Which room are you painting?", opts:[["bedroom","Bedroom"],["living","Living room"],["kitchen","Kitchen"],["dining","Dining room"],["office","Office"],["bath","Bathroom"],["other","Other"]] },
    { key:"light", q:"How much natural light does it get?", opts:[["low","Not much"],["medium","A decent amount"],["high","Tons of light"]] },
    { key:"time", q:"When is the room used most?", opts:[["day","Mostly daytime"],["evening","Mostly evenings"]] },
    { key:"tones", q:"Dominant floor & furniture tones?", opts:[["warmwood","Warm wood"],["darkwood","Dark wood"],["graywhite","Gray / white"],["mixed","A mix"]] },
    { key:"feel", q:"How should the room feel?", opts:[["airy","Bright & airy"],["warm","Warm & welcoming"],["calm","Calm & relaxing"],["modern","Clean & modern"],["dramatic","Rich & dramatic"],["natural","Natural & grounded"]] },
    { key:"pref", q:"Color instincts?", opts:[["warm","Warm"],["cool","Cool"],["neutral","Neutral"],["bold","Bold"]] }
  ],
  init: function(){
    this.root=$("#panel-quiz");
    this.root.innerHTML =
      '<h2 class="step-title">Find your color direction</h2>' +
      '<p class="step-sub">Six quick questions. A simple rule-based guide — your taste always wins.</p>' +
      '<div class="quiz-progress"><div class="qp-bar"><div class="qp-fill"></div><span class="qp-brush" aria-hidden="true"></span></div><span class="qp-label"></span></div>' +
      '<div class="quiz-stage"></div>';
    this.renderStep();
  },
  renderStep: function(){
    var self=this, stage=$(".quiz-stage",this.root);
    if (this.recs){ this.renderResults(); return; }
    var item=this.QS[this.step];
    $(".qp-fill",this.root).style.width=(this.step/this.QS.length*100)+"%";
    $(".qp-brush",this.root).style.left="calc("+(this.step/this.QS.length*100)+"% - 12px)";
    $(".qp-label",this.root).textContent="Question "+(this.step+1)+" of "+this.QS.length;
    stage.innerHTML='<div class="q-card"><div class="qt">'+esc(item.q)+'</div><div class="opts"></div>'+
      (this.step>0?'<button class="btn btn-ghost small q-back" type="button">← Back</button>':"")+'</div>';
    var opts=$(".opts",stage);
    item.opts.forEach(function(o){
      var b=el("button","qopt"+(self.answers[item.key]===o[0]?" on":""),esc(o[1]));
      b.type="button";
      b.addEventListener("click",function(){
        self.answers[item.key]=o[0];
        self.step++;
        if (self.step>=self.QS.length){ self.recs=C.quizRecommend(self.answers); }
        self.renderStep();
      });
      opts.appendChild(b);
    });
    var back=$(".q-back",stage);
    if (back) back.addEventListener("click",function(){ self.step=Math.max(0,self.step-1); self.renderStep(); });
  },
  renderResults: function(){
    var self=this, stage=$(".quiz-stage",this.root);
    $(".qp-fill",this.root).style.width="100%";
    $(".qp-brush",this.root).style.left="calc(100% - 12px)";
    $(".qp-label",this.root).textContent="Your three directions";
    stage.innerHTML="";
    this.recs.forEach(function(r){
      var d=el("div","rec");
      d.innerHTML='<div class="pal"><i style="background:'+r.main.hex+'" title="Main"></i>'+
        (r.accent?'<i style="background:'+r.accent.hex+'" title="Accent"></i>':"")+
        '<i style="background:'+r.trim.hex+'" title="Trim"></i></div>'+
        '<div><b>'+esc(r.main.name)+'</b><p>'+esc(r.why)+'</p>'+
        '<div class="meta">Main: '+esc(r.main.name)+" "+r.main.hex.toUpperCase()+
        (r.accent?' · Accent: '+esc(r.accent.name):"")+' · Trim: '+esc(r.trim.name)+'</div>'+
        '<div class="tool-row"><button class="btn btn-orange small use-int" type="button">Use in Interior Studio</button>'+
        '<button class="btn btn-soft small use-ext" type="button">Use in Exterior Studio</button></div></div>';
      $(".use-int",d).addEventListener("click",function(){ self.useIn("interior",r); });
      $(".use-ext",d).addEventListener("click",function(){ self.useIn("exterior",r); });
      stage.appendChild(d);
    });
    var again=el("button","btn btn-ghost small","↺ Retake quiz"); again.type="button";
    again.style.marginTop="8px";
    again.addEventListener("click",function(){ self.answers={}; self.recs=null; self.step=0; self.renderStep(); });
    stage.appendChild(again);
  },
  useIn: function(kind, r){
    App.pendingColor={ name:r.main.name, hex:r.main.hex, family:r.main.family, undertone:r.main.undertone };
    activate(kind);
    var ws=kind==="interior"?App.interior:App.exterior;
    setTimeout(function(){
      if (ws && ws.active() && ws.active().closed){ ws.setColor(App.pendingColor); toast("“"+r.main.name+"” applied to "+ws.active().name+"."); }
      else toast("“"+r.main.name+"” is ready — add a photo and trace a surface to try it.");
    },120);
  }
};

/* ================================================================
   PLANNER TAB
   ================================================================ */
var Planner = {
  step:0,
  AREAS:["Living room","Bedroom","Kitchen","Bathroom","Hallway","Staircase","Basement","Exterior siding","Trim","Deck","Fence","Office","Retail area","Custom area"],
  SURF:["Walls","Ceiling","Trim","Doors","Cabinets","Accent wall"],
  COND:["Ready to paint","Small nail holes or scuffs","Cracks or drywall repair","Peeling or flaking","Water staining","Wallpaper currently installed","Bare or repaired drywall","Stained or unfinished wood","Unsure"],
  LOGI:["Furniture present","Pets","Children","Work-from-home needs","Limited parking or access","After-hours commercial scheduling","Occupied property","Vacant property"],
  plan:null, photos:[],
  init: function(){
    this.root=$("#panel-planner");
    this.plan=lsGet("vdp-plan",{ projectType:"", areas:[], condition:[], colorApproach:"", studioColors:"", timeline:"", logistics:[], notes:"", name:"" });
    this.renderShell();
    this.renderStep();
  },
  persist: function(){ lsSet("vdp-plan",this.plan); },
  STEPS:["Project type","Areas","Condition","Color","Timeline","Logistics","Photos","Review"],
  renderShell: function(){
    this.root.innerHTML =
      '<h2 class="step-title">Build my painting plan</h2>' +
      '<p class="step-sub">A few guided choices — no pricing games, no obligation. You end up with a walkthrough-ready plan Bryan can act on immediately.</p>' +
      '<div class="quiz-progress"><div class="qp-bar"><div class="qp-fill"></div><span class="qp-brush" aria-hidden="true"></span></div><span class="qp-label"></span></div>' +
      '<div class="plan-stage"></div>' +
      '<div class="plan-nav">' +
        '<button class="btn btn-ghost small p-back" type="button">← Back</button>' +
        '<button class="btn btn-orange p-next" type="button">Continue →</button>' +
      '</div>';
    var self=this;
    $(".p-back",this.root).addEventListener("click",function(){ self.step=Math.max(0,self.step-1); self.renderStep(); });
    $(".p-next",this.root).addEventListener("click",function(){
      if (self.step===1 && !self.plan.areas.length){ toast("Add at least one area — even just “Living room”."); return; }
      self.step=Math.min(self.STEPS.length-1,self.step+1); self.renderStep();
    });
  },
  chipGroup: function(parent, options, selected, multi, onchange){
    var box=el("div","opts");
    options.forEach(function(o){
      var val=typeof o==="string"?o:o[0], label=typeof o==="string"?o:o[1];
      var on=multi?selected.indexOf(val)!==-1:selected===val;
      var b=el("button","qopt"+(on?" on":""),esc(label));
      b.type="button";
      b.addEventListener("click",function(){
        if (multi){
          var i=selected.indexOf(val);
          if (i===-1) selected.push(val); else selected.splice(i,1);
          b.classList.toggle("on");
        } else {
          $$(".qopt",box).forEach(function(x){x.classList.remove("on");});
          b.classList.add("on");
          onchange(val);
          return;
        }
        onchange(selected);
      });
      box.appendChild(b);
    });
    parent.appendChild(box);
    return box;
  },
  renderStep: function(){
    var self=this, stage=$(".plan-stage",this.root);
    var n=this.step, total=this.STEPS.length;
    $(".qp-fill",this.root).style.width=(n/(total-1)*100)+"%";
    $(".qp-brush",this.root).style.left="calc("+(n/(total-1)*100)+"% - 12px)";
    $(".qp-label",this.root).textContent=this.STEPS[n]+" · step "+(n+1)+" of "+total;
    $(".p-back",this.root).style.visibility=n===0?"hidden":"visible";
    $(".p-next",this.root).style.display=n===total-1?"none":"";
    stage.innerHTML="";
    var card=el("div","q-card");
    stage.appendChild(card);
    this["step"+n](card);
    this.persist();
  },
  step0: function(card){
    var self=this;
    card.innerHTML='<div class="qt">What kind of project is this?</div>';
    this.chipGroup(card,["Interior","Exterior","Both","Commercial","Wallpaper installation","Wallpaper removal","Cabinets or specialty work","Not sure"],
      this.plan.projectType,false,function(v){ self.plan.projectType=v; self.persist(); });
  },
  step1: function(card){
    var self=this;
    card.innerHTML='<div class="qt">Which areas are we painting?</div><ul class="area-list"></ul>'+
      '<div class="tool-row"><select class="area-pick" aria-label="Choose an area">'+
      this.AREAS.map(function(a){return "<option>"+esc(a)+"</option>";}).join("")+
      '</select><button class="btn btn-soft small a-add" type="button">+ Add area</button></div>'+
      '<div class="area-form hidden"></div>';
    this.renderAreas();
    $(".a-add",card).addEventListener("click",function(){
      var name=$(".area-pick",card).value;
      if (name==="Custom area"){ name=window.prompt("Name the area:","")||""; if(!name) return; }
      var area={ name:name, size:"", surfaces:[], currentColor:"", desiredColor:"", occupancy:"" };
      self.plan.areas.push(area); self.persist();
      self.renderAreas(); self.editArea(self.plan.areas.length-1);
    });
  },
  renderAreas: function(){
    var self=this, ul=$(".area-list",this.root);
    if (!ul) return;
    ul.innerHTML=this.plan.areas.length?"":'<li class="sub">No areas yet — add your first below.</li>';
    this.plan.areas.forEach(function(a,i){
      var li=el("li","surf-item");
      var det=[a.size,a.surfaces.join(", "),a.occupancy].filter(Boolean).join(" · ");
      li.innerHTML='<span class="s-name"><b>'+esc(a.name)+'</b>'+(det?' <small style="color:var(--muted)">'+esc(det)+'</small>':"")+'</span>'+
        '<span class="s-btns"><button class="sb a-edit" aria-label="Edit '+esc(a.name)+'">✎</button>'+
        '<button class="sb a-del" aria-label="Remove '+esc(a.name)+'">🗑</button></span>';
      $(".a-edit",li).addEventListener("click",function(){ self.editArea(i); });
      $(".a-del",li).addEventListener("click",function(){
        if(!confirmBox("Remove “"+a.name+"”?"))return;
        self.plan.areas.splice(i,1); self.persist(); self.renderAreas();
      });
      ul.appendChild(li);
    });
  },
  editArea: function(i){
    var self=this, a=this.plan.areas[i], f=$(".area-form",this.root);
    f.classList.remove("hidden");
    f.innerHTML='<div class="qt" style="margin-top:14px">'+esc(a.name)+'</div>'+
      '<p class="sub">Rough size?</p><div class="f-size"></div>'+
      '<p class="sub">What gets painted? (tap all that apply)</p><div class="f-surf"></div>'+
      '<div class="f-row2"><label>Current color <input class="f-cur" type="text" value="'+esc(a.currentColor)+'" placeholder="e.g. beige"></label>'+
      '<label>Desired color (if known) <input class="f-des" type="text" value="'+esc(a.desiredColor)+'" placeholder="e.g. warm white"></label></div>'+
      '<p class="sub">The space is…</p><div class="f-occ"></div>'+
      '<button class="btn btn-soft small f-done" type="button">Done with this area</button>';
    this.chipGroup($(".f-size",f),[["small","Small"],["medium","Medium"],["large","Large"]],a.size,false,function(v){a.size=v;self.persist();self.renderAreas();});
    this.chipGroup($(".f-surf",f),this.SURF,a.surfaces,true,function(){self.persist();self.renderAreas();});
    this.chipGroup($(".f-occ",f),[["furnished","Furnished"],["occupied","Occupied"],["vacant","Vacant"]],a.occupancy,false,function(v){a.occupancy=v;self.persist();self.renderAreas();});
    $(".f-cur",f).addEventListener("input",function(e){a.currentColor=e.target.value;self.persist();});
    $(".f-des",f).addEventListener("input",function(e){a.desiredColor=e.target.value;self.persist();});
    $(".f-done",f).addEventListener("click",function(){ f.classList.add("hidden"); self.renderAreas(); });
  },
  step2: function(card){
    var self=this;
    card.innerHTML='<div class="qt">What condition are the surfaces in?</div><p class="sub">Tap everything that applies — honest answers make estimates accurate.</p>';
    this.chipGroup(card,this.COND,this.plan.condition,true,function(){self.persist();});
    card.appendChild(el("p","warn-note","⚠︎ Water intrusion, mold, structural damage, and hazardous-material concerns need proper in-person evaluation — this planner doesn’t diagnose them."));
  },
  step3: function(card){
    var self=this;
    card.innerHTML='<div class="qt">Where are you on colors?</div>';
    this.chipGroup(card,["Chose in the Color Studio","I have colors in mind","I need help choosing","Match the current colors","Bryan can recommend"],
      this.plan.colorApproach,false,function(v){ self.plan.colorApproach=v; self.persist(); });
    var row=el("div","tool-row");
    var b1=el("button","btn btn-soft small","Import my Color Studio choices"); b1.type="button";
    b1.addEventListener("click",function(){
      var src=(App.interior&&App.interior.project.surfaces.some(function(s){return s.color;}))?App.interior:
              (App.exterior&&App.exterior.project.surfaces.some(function(s){return s.color;}))?App.exterior:null;
      if (!src){ toast("No Color Studio design yet — open Interior or Exterior Studio first."); return; }
      self.plan.studioColors=C.estimateSummaryFromProject(src.project);
      self.plan.colorApproach="Chose in the Color Studio";
      self.persist(); self.renderStep();
      toast("Studio colors added to the plan.");
    });
    var b2=el("button","btn btn-ghost small","Take the color quiz"); b2.type="button";
    b2.addEventListener("click",function(){ activate("quiz"); });
    row.appendChild(b1); row.appendChild(b2);
    card.appendChild(row);
    if (this.plan.studioColors) card.appendChild(el("pre","plan-pre",esc(this.plan.studioColors)));
  },
  step4: function(card){
    var self=this;
    card.innerHTML='<div class="qt">When would you like this done?</div><p class="sub">This sets expectations — it isn’t a scheduling promise from anyone.</p>';
    this.chipGroup(card,["As soon as available","Within one month","One to three months","Flexible","Before a specific event","Commercial scheduling requirements"],
      this.plan.timeline,false,function(v){ self.plan.timeline=v; self.persist(); });
  },
  step5: function(card){
    var self=this;
    card.innerHTML='<div class="qt">Anything Bryan should plan around?</div>';
    this.chipGroup(card,this.LOGI,this.plan.logistics,true,function(){self.persist();});
    var ta=el("textarea","plan-notes"); ta.placeholder="Anything else worth knowing…"; ta.value=this.plan.notes;
    ta.setAttribute("aria-label","Other considerations");
    ta.addEventListener("input",function(e){ self.plan.notes=e.target.value; self.persist(); });
    card.appendChild(ta);
  },
  step6: function(card){
    var self=this;
    card.innerHTML='<div class="qt">Photos help a lot (optional)</div>'+
      '<p class="sub">Pick a few photos — they stay on your device. A good set:</p>'+
      '<ul class="check-list"><li>Full room or house elevation</li><li>The opposite angle</li><li>Trim and doors</li><li>Any damaged areas</li><li>Close-up of the current surface</li></ul>'+
      '<input type="file" class="p-photos" accept="image/*" multiple aria-label="Choose project photos">'+
      '<div class="photo-thumbs"></div>'+
      '<p class="sub">Nothing is uploaded. When you send your plan, text the photos to Bryan in the same thread — or show them at the walkthrough.</p>';
    var input=$(".p-photos",card), thumbs=$(".photo-thumbs",card);
    function renderThumbs(){
      thumbs.innerHTML="";
      self.photos.forEach(function(p,i){
        var d=el("div","pthumb");
        d.innerHTML='<img src="'+p.url+'" alt="Project photo '+(i+1)+'"><button class="sb" aria-label="Remove photo">✕</button>';
        $("button",d).addEventListener("click",function(){ URL.revokeObjectURL(p.url); self.photos.splice(i,1); renderThumbs(); });
        thumbs.appendChild(d);
      });
      self.plan.photoCount=self.photos.length; self.persist();
    }
    input.addEventListener("change",function(){
      Array.prototype.slice.call(input.files).slice(0,8-self.photos.length).forEach(function(f){
        if (C.validateImageFile(f).ok) self.photos.push({url:URL.createObjectURL(f),name:f.name});
      });
      input.value=""; renderThumbs();
    });
    renderThumbs();
  },
  step7: function(card){
    var self=this;
    var ready=C.plannerReadiness(this.plan);
    var summary=C.plannerSummary(this.plan);
    card.innerHTML='<div class="qt">Your project is already easier to talk about.</div>'+
      '<div class="ready-card"><b>'+esc(ready.state)+'</b>'+
      (ready.done.length?'<p class="sub">Done: '+esc(ready.done.join(" · "))+'</p>':"")+
      (ready.todo.length?'<p class="sub">Bryan can help with: '+esc(ready.todo.join(" · "))+'</p>':"")+
      '<p class="sub">A walkthrough is where the real numbers come from — this plan just makes that conversation fast.</p></div>'+
      '<label class="sub" for="plan-name-in">Project name (optional)</label>'+
      '<input id="plan-name-in" class="proj-name" type="text" maxlength="40" value="'+esc(this.plan.name)+'" placeholder="e.g. Maple St repaint">'+
      '<label class="sub" style="margin-top:10px;display:block">Your summary — edit anything:</label>'+
      '<textarea class="plan-summary" aria-label="Plan summary">'+esc(summary)+'</textarea>'+
      '<div class="qt" style="font-size:17px;margin-top:16px">Send the plan to Bryan</div>'+
      '<div class="tool-row">'+
        '<a class="btn btn-orange s-text" href="#">📱 Text it to Bryan</a>'+
        '<a class="btn btn-ghost s-call" href="tel:'+CFG.business.phone+'">Call '+esc(CFG.business.phoneDisplay)+'</a>'+
        '<button class="btn btn-soft s-copy" type="button">Copy</button>'+
        '<button class="btn btn-soft s-dl" type="button">↓ Download brief</button>'+
        '<button class="btn btn-ghost s-est" type="button">Continue to estimate form →</button>'+
      '</div>';
    var ta=$(".plan-summary",card);
    function currentText(){
      var t=ta.value;
      if (self.plan.name && t.indexOf(self.plan.name)===-1) t="Project: "+self.plan.name+"\n"+t;
      return t;
    }
    $("#plan-name-in",card).addEventListener("input",function(e){ self.plan.name=e.target.value; self.persist(); });
    function syncText(){
      $(".s-text",card).href="sms:"+CFG.business.phone+"?&body="+encodeURIComponent(currentText());
    }
    ta.addEventListener("input",syncText); syncText();
    $(".s-copy",card).addEventListener("click",function(){
      var b=this;
      (navigator.clipboard?navigator.clipboard.writeText(currentText()):Promise.reject()).then(function(){
        b.textContent="Copied ✓"; setTimeout(function(){b.textContent="Copy";},2000);
      }).catch(function(){ window.prompt("Copy your plan:",currentText()); });
    });
    $(".s-dl",card).addEventListener("click",function(){
      var blob=new Blob([currentText()+"\n\n— Built with the Van Dam project planner · "+SITE_URL],{type:"text/plain"});
      var a=document.createElement("a"); a.href=URL.createObjectURL(blob);
      a.download="vandam-painting-plan.txt"; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function(){URL.revokeObjectURL(a.href);},4000);
    });
    $(".s-est",card).addEventListener("click",function(){
      try{ localStorage.setItem("vdp-handoff",JSON.stringify({colorName:"",colorHex:"",service:/exterior/i.test(self.plan.projectType)?"Exterior painting":"Interior painting",desc:currentText(),ts:Date.now()})); }catch(e){}
      window.location.href="index.html#quote";
    });
  },
  importFromStudio: function(ws){
    this.plan.studioColors=C.estimateSummaryFromProject(ws.project);
    this.plan.colorApproach="Chose in the Color Studio";
    if (!this.plan.projectType) this.plan.projectType=ws.kind==="exterior"?"Exterior":"Interior";
    this.persist();
    this.step=7;
    if (inited.planner) this.renderStep();
  }
};

/* ================================================================
   SAVED DESIGNS TAB
   ================================================================ */
var Saved = {
  init: function(){
    this.root=$("#panel-saved");
    this.render();
  },
  refresh: function(){ if (inited.saved) this.render(); },
  render: function(){
    var self=this;
    var all=lsGet("vdp-projects",[]);
    this.root.innerHTML =
      '<h2 class="step-title">Saved designs</h2>' +
      '<p class="step-sub">Projects you saved live only in this browser, on this device — nothing is uploaded. Export a file to move one between devices.</p>' +
      '<div class="tool-row"><label class="btn btn-soft small" style="cursor:pointer">⇪ Import project file<input type="file" class="imp-in sr-only" accept="application/json,.json"></label></div>' +
      '<div class="saved-grid"></div>';
    var grid=$(".saved-grid",this.root);
    if (!all.length) grid.innerHTML='<p class="sub">Nothing saved yet. Design something in the Interior or Exterior Studio and press 💾 Save.</p>';
    all.forEach(function(p){
      var dots=(p.surfaces||[]).filter(function(s){return s.color;}).slice(0,5)
        .map(function(s){return '<i style="background:'+s.color.hex+'"></i>';}).join("");
      var colored=(p.surfaces||[]).filter(function(s){return s.color;}).length;
      var status=colored ? colored+" of "+(p.surfaces||[]).length+" surfaces colored" : "No colors yet";
      var card=el("div","saved-card");
      card.innerHTML=
        (p.thumb?'<img class="sv-thumb" src="'+p.thumb+'" alt="Preview of '+esc(p.name||"project")+'">':'<div class="sv-thumb sv-none">No preview</div>')+
        '<div class="sv-body"><b>'+esc(p.name||"Untitled project")+'</b>'+
        '<small>'+(p.type==="exterior"?"Exterior":"Interior")+' · updated '+new Date(p.updatedAt||Date.now()).toLocaleDateString()+' · '+esc(status)+'</small>'+
        '<div class="sv-dots">'+dots+'</div>'+
        '<div class="tool-row">'+
          '<button class="btn btn-orange small sv-open" type="button">Open</button>'+
          '<button class="sb sv-ren" aria-label="Rename">✏️</button>'+
          '<button class="sb sv-dup" aria-label="Duplicate">⧉</button>'+
          '<button class="sb sv-exp" aria-label="Export">⇩</button>'+
          '<button class="sb sv-del" aria-label="Delete">🗑</button>'+
        '</div></div>';
      $(".sv-open",card).addEventListener("click",function(){
        var proj=C.deserializeProject(JSON.stringify(p));
        if (!proj){ toast("This saved project can’t be opened."); return; }
        var tab=proj.type==="exterior"?"exterior":"interior";
        activate(tab);
        setTimeout(function(){ (tab==="exterior"?App.exterior:App.interior).loadProject(proj); },100);
      });
      $(".sv-ren",card).addEventListener("click",function(){
        var n=window.prompt("Rename project:",p.name||"");
        if (n!==null){ p.name=n.slice(0,40); lsSet("vdp-projects",all); self.render(); }
      });
      $(".sv-dup",card).addEventListener("click",function(){
        var copy=JSON.parse(JSON.stringify(p));
        copy.id="p"+Math.random().toString(36).slice(2,9);
        copy.name=(p.name||"Untitled")+" copy";
        copy.updatedAt=Date.now();
        all.unshift(copy);
        if (!lsSet("vdp-projects",all)) toast("Storage is full — export and delete something first.");
        self.render();
      });
      $(".sv-exp",card).addEventListener("click",function(){
        var blob=new Blob([JSON.stringify(p)],{type:"application/json"});
        var a=document.createElement("a"); a.href=URL.createObjectURL(blob);
        a.download="vandam-project-"+(p.name||"design").replace(/\W+/g,"-").toLowerCase()+".json";
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function(){URL.revokeObjectURL(a.href);},4000);
      });
      $(".sv-del",card).addEventListener("click",function(){
        if (!confirmBox("Delete “"+(p.name||"Untitled project")+"”? This can’t be undone.")) return;
        var rest=all.filter(function(x){return x.id!==p.id;});
        lsSet("vdp-projects",rest);
        self.render();
      });
      grid.appendChild(card);
    });
    $(".imp-in",this.root).addEventListener("change",function(e){
      var f=e.target.files[0]; if(!f) return;
      var r=new FileReader();
      r.onload=function(){
        var proj=C.deserializeProject(r.result);
        if (!proj){ toast("That file isn’t a Van Dam project export."); return; }
        var rec=JSON.parse(r.result);
        rec.id="p"+Math.random().toString(36).slice(2,9);
        var cur=lsGet("vdp-projects",[]);
        cur.unshift(rec);
        if (lsSet("vdp-projects",cur)){ toast("Project imported."); self.render(); }
        else toast("Storage is full — couldn’t import.");
      };
      r.readAsText(f);
    });
  }
};

/* ================================================================
   APP BOOT
   ================================================================ */
var App = { interior:null, exterior:null, pendingColor:null, planner:Planner };
var INIT = {
  interior: function(){ App.interior=new Workspace("interior"); App.interior.init("#ws-interior"); },
  exterior: function(){ App.exterior=new Workspace("exterior"); App.exterior.init("#ws-exterior"); },
  quiz: function(){ Quiz.init(); },
  planner: function(){ Planner.init(); },
  saved: function(){ Saved.init(); }
};
var RESUME = {
  saved: function(){ Saved.refresh(); },
  interior: function(){ if (App.interior) App.interior.render(); },
  exterior: function(){ if (App.exterior) App.exterior.render(); }
};
window.VDPApp = App; // for tests/debugging

document.addEventListener("DOMContentLoaded", function(){
  var hd=$("#hdCall");
  if (hd){ hd.href="tel:"+CFG.business.phone; hd.textContent="Call "+CFG.business.phoneDisplay; }
  var yr=$("#yr"); if (yr) yr.textContent=new Date().getFullYear();
  var ft=$("#ftTown"); if (ft) ft.textContent=CFG.business.town;
  wireTabs();
  activate(tabFromHash(), true);
});
})();
