// src/ui/distribute.js
import { ObservableValue } from "../base/Obs.js";
import { initDistributeLogic } from "../distribute/distribute.js";

const isVisible = new ObservableValue(false);
const obsDistributeIsShowing = isVisible.observable().whenDifferent();

/**
 * @param {!Revision} revision
 * @param {!Observable.<!boolean>} obsIsAnyOverlayShowing
 */
function initDistributeUI(revision, obsIsAnyOverlayShowing) {
  // Hook the logic that does the partition+rewrite
  initDistributeLogic({ revision: revision });

  const btn = /** @type {!HTMLButtonElement} */(document.getElementById("distribute-button"));
  const overlay = /** @type {!HTMLDivElement} */(document.getElementById("distribute-overlay"));
  const panel = /** @type {!HTMLDivElement} */(document.getElementById("distribute-div"));
  const input = /** @type {!HTMLInputElement} */(document.getElementById("distribute-count"));
  const ok = /** @type {!HTMLButtonElement} */(document.getElementById("distribute-confirm"));
  const cancel = /** @type {!HTMLButtonElement} */(document.getElementById("distribute-cancel"));

  function show(v) {
    isVisible.set(v);
    overlay.style.display = v ? "block" : "none";
    panel.style.display = v ? "block" : "none";
    if (v) setTimeout(function(){ input.focus(); input.select(); }, 0);
  }

  // Enable/disable main button when another overlay is up
  obsIsAnyOverlayShowing.subscribe(function(any){ btn.disabled = any; });

  btn.addEventListener("click", function(){ show(true); });
  overlay.addEventListener("click", function(){ show(false); });
  cancel.addEventListener("click", function(){ show(false); });

  document.addEventListener("keydown", function(e){
    if (e.key === "Escape") show(false);
  });

  ok.addEventListener("click", function(){
    var n = parseInt(input.value, 10);
    if (!(n > 0)) n = 2;
    // Hand off to the logic via a custom event
    var ev = new CustomEvent("distribute:confirm", { detail: { count: n } });
    window.dispatchEvent(ev);
    show(false);
  });
}

export { initDistributeUI, obsDistributeIsShowing };
