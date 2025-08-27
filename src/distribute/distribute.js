// src/distribute/distribute.js
import { fromJsonText_CircuitDefinition } from "../circuit/Serializer.js";
import { CircuitDefinition } from "../circuit/CircuitDefinition.js";

// ---------- Partitioning Helper ----------
function greedyPartition(numWires, N) {
  const partOfWire = new Array(numWires);
  const base = Math.floor(numWires / N);
  let rem = numWires % N;
  let w = 0;
  for (let p = 0; p < N; p++) {
    const size = base + (rem > 0 ? 1 : 0);
    if (rem > 0) rem--;
    for (let i = 0; i < size; i++) {
      partOfWire[w++] = p;
    }
  }
  return partOfWire;
}

// ---------- Public init ----------
export function initDistributeLogic(deps) {
  const revision = deps.revision;

  window.addEventListener('distribute:confirm', function(ev){
    try {
        const detail = ev.detail || {};
        const N = Math.max(1, parseInt(detail.count, 10) || 1);

        const jsonText = revision.peekActiveCommit();
        const circuit = fromJsonText_CircuitDefinition(jsonText);

        if (circuit.numWires === 0) {
            alert("Cannot partition an empty circuit!");
            return;
        }

        // Clicking the button acts as a toggle for highlighting.
        if (window.highlightedGateLocations) {
            window.highlightedGateLocations = undefined;
            console.log("CLEARED highlighting.");
        } else {
            const H = circuit.numWires;
            const cappedN = Math.min(N, H);
            const partOfWire = greedyPartition(H, cappedN);
            console.log(`Partitioning into ${cappedN} parts. Map:`, partOfWire);

            const locationsToHighlight = new Set();
            for (let c = 0; c < circuit.columns.length; c++) {
                const col = circuit.columns[c];
                const controls = [], targets = [];
                for (let r = 0; r < H; r++) {
                    const g = col.gates[r];
                    if (g && g.symbol === '•') controls.push(r);
                    if (g && (g.symbol === 'X' || g.symbol === 'Z')) targets.push(r);
                }

                if (controls.length > 0 && targets.length > 0) {
                    for (const controlWire of controls) {
                        for (const targetWire of targets) {
                            if (partOfWire[controlWire] !== partOfWire[targetWire]) {
                                const controlId = `${c}:${controlWire}`;
                                const targetId = `${c}:${targetWire}`;
                                locationsToHighlight.add(controlId);
                                locationsToHighlight.add(targetId);
                            }
                        }
                    }
                }
            }
            window.highlightedGateLocations = locationsToHighlight;
            console.log("Set gates to be highlighted:", window.highlightedGateLocations);
        }

        // Force the circuit to redraw itself.
        revision.commit(jsonText);

    } catch (error) {
        console.error("An error occurred during the partitioning process:", error);
        alert("An error occurred. Check the developer console for details.");
    }
  });
}