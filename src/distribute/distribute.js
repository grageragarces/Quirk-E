// src/distribute/distribute.js
// Greedy partition + auto-add ancillas + placeholder rewrite for cross-partition CNOT/CZ.

import { CircuitDefinition } from "../circuit/CircuitDefinition.js";
import { GateColumn } from "../circuit/GateColumn.js";
import { GateBuilder } from "../circuit/Gate.js";
import { Serializer, fromJsonText_CircuitDefinition } from "../circuit/Serializer.js";
import { Matrix } from "../math/Matrix.js";

// ---------- Partitioning ----------

function greedyPartition(numWires, N) {
  var partOfWire = new Array(numWires);
  var base = Math.floor(numWires / N);
  var rem = numWires % N;
  var w = 0;
  for (var p = 0; p < N; p++) {
    var size = base + (rem > 0 ? 1 : 0);
    if (rem > 0) rem--;
    for (var i = 0; i < size; i++) {
      partOfWire[w++] = p;
    }
  }
  return partOfWire;
}

function wiresTouchedByGate(g, rowIndex) {
  var h = g.height || (typeof g.stableHeight === "function" ? g.stableHeight() : 1);
  var arr = [];
  for (var r = 0; r < h; r++) arr.push(rowIndex + r);
  return arr;
}

function partitionsTouched(wires, partOfWire) {
  var set = {};
  for (var i = 0; i < wires.length; i++) set[partOfWire[wires[i]]] = true;
  var out = [];
  for (var k in set) out.push(parseInt(k, 10));
  out.sort(function(a,b){return a-b;});
  return out;
}

// ---------- Ancilla book-keeping ----------

function ensureAncillasForPairs(circuit, neededPairs) {
  var cols = circuit.columns.map(function(c){ return new GateColumn(c.gates.slice()); });
  var H = circuit.numWires;
  var linkMap = new Map();

  neededPairs.forEach(function(key){
    var aIndex = H++;
    var bIndex = H++;
    cols = cols.map(function(col){
      var g = col.gates.slice();
      g[aIndex] = g[aIndex] !== undefined ? g[aIndex] : undefined;
      g[bIndex] = g[bIndex] !== undefined ? g[bIndex] : undefined;
      return new GateColumn(g);
    });
    linkMap.set(key, { a: aIndex, b: bIndex });
  });

  return { circuit: new CircuitDefinition(H, cols), linkMap: linkMap };
}

// ---------- Placeholder macros (unitary-equal today) ----------

var MAT_CNOT = Matrix.square(
  1,0,0,0,
  0,1,0,0,
  0,0,0,1,
  0,0,1,0
);

var MAT_CZ = Matrix.square(
  1,0,0,0,
  0,1,0,0,
  0,0,1,0,
  0,0,0,-1
);

function makeNonLocalCNOTMacro(name) {
  var builder = new GateBuilder()
    .setSerializedId('~nlcx_' + Math.floor(Math.random() * (1 << 20)).toString(32))
    .setSymbol('NL•X')
    .setTitle(name)
    .setKnownEffectToMatrix(MAT_CNOT)
    .setHeight(2);
  return builder.gate;
}

function makeNonLocalCZMacro(name) {
  var builder = new GateBuilder()
    .setSerializedId('~nlcz_' + Math.floor(Math.random() * (1 << 20)).toString(32))
    .setSymbol('NL•Z')
    .setTitle(name)
    .setKnownEffectToMatrix(MAT_CZ)
    .setHeight(2);
  return builder.gate;
}

// ---------- Rewriter ----------

function isTwoQubitCNOTLike(g) {
  // Heuristic: 2-tall gate whose title/symbol looks like CNOT/CX.
  var t = (g.title || "") + " " + (g.symbol || "");
  var h = g.height || (typeof g.stableHeight === "function" ? g.stableHeight() : 1);
  return h === 2 && /CNOT|CX|Controlled\s*X/i.test(t);
}

function isTwoQubitCZLike(g) {
  var t = (g.title || "") + " " + (g.symbol || "");
  var h = g.height || (typeof g.stableHeight === "function" ? g.stableHeight() : 1);
  return h === 2 && /CZ|Controlled\s*Z/i.test(t);
}

function rewriteCrossPartitionGates(circuit, partOfWire) {
  var W = circuit.columns.length;
  var H = circuit.numWires;

  // 1) collect needed partition pairs
  var neededPairs = new Set();
  for (var c = 0; c < W; c++) {
    var col = circuit.columns[c];
    for (var r = 0; r < H; r++) {
      var g = col.gates[r];
      if (!g) continue;
      var wires = wiresTouchedByGate(g, r);
      if (wires.length !== 2) continue;
      var parts = partitionsTouched(wires, partOfWire);
      if (parts.length === 2 && (isTwoQubitCNOTLike(g) || isTwoQubitCZLike(g))) {
        var key = parts[0] + "-" + parts[1];
        neededPairs.add(key);
      }
    }
  }

  // 2) ensure ancillas
  var ensured = ensureAncillasForPairs(circuit, neededPairs);
  var out = ensured.circuit;
  var linkMap = ensured.linkMap;

  // 3) rewrite pass
  var outCols = out.columns.map(function(c){ return new GateColumn(c.gates.slice()); });
  var outH = out.numWires;

  for (var c2 = 0; c2 < W; c2++) {
    var col2 = circuit.columns[c2];
    for (var r2 = 0; r2 < H; r2++) {
      var g2 = col2.gates[r2];
      if (!g2) continue;
      var wires2 = wiresTouchedByGate(g2, r2);
      if (wires2.length !== 2) continue;

      var wTop = wires2[0];
      var wBot = wires2[1];
      var pTop = partOfWire[wTop];
      var pBot = partOfWire[wBot];
      if (pTop === pBot) continue;

      var pa = Math.min(pTop, pBot);
      var pb = Math.max(pTop, pBot);
      var link = linkMap.get(pa + "-" + pb);
      if (!link) continue;

      var name = isTwoQubitCNOTLike(g2)
        ? ("NL-CNOT(" + wTop + "→" + wBot + ")")
        : ("NL-CZ(" + wTop + "," + wBot + ")");

      var macro = isTwoQubitCNOTLike(g2)
        ? makeNonLocalCNOTMacro(name)
        : makeNonLocalCZMacro(name);

      outCols[c2].gates[r2] = macro;
      var macroH = macro.height || (typeof macro.stableHeight === "function" ? macro.stableHeight() : 2);
      for (var rr = r2 + 1; rr < r2 + macroH; rr++) {
        if (rr < outH) outCols[c2].gates[rr] = undefined;
      }
    }
  }

  return new CircuitDefinition(outH, outCols);
}

// ---------- Public init ----------

export function initDistributeLogic(deps) {
  var revision = deps.revision;
  var getActiveCircuit = deps.getActiveCircuit;

  window.addEventListener('distribute:confirm', function(ev){
    var detail = ev.detail || {};
    var Nraw = detail.count !== undefined ? detail.count : 2;
    var N = Math.max(1, parseInt(Nraw, 10) || 2);

    var jsonText = getActiveCircuit();
    var circuit = fromJsonText_CircuitDefinition(jsonText);

    var partOfWire = greedyPartition(circuit.numWires, N);
    var newCircuit = rewriteCrossPartitionGates(circuit, partOfWire);

    var newJson = JSON.stringify(Serializer.toJson(newCircuit));
    revision.commit(newJson);
  });
}
