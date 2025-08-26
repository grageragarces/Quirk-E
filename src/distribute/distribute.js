// src/distribute/distribute.js
import { fromJsonText_CircuitDefinition } from "../circuit/Serializer.js";
import { CircuitDefinition } from "../circuit/CircuitDefinition.js";
import CircuitConverter from "../circuit/CircuitConverter.js";

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

// ---------- QASM Rewriter ----------

function rewriteQasm(qasmString, numPartitions) {
    const lines = qasmString.split('\n');
    const newLines = [];
    let numWires = 0;
    let partOfWire = [];

    // First pass: Find the number of qubits and create the partition map.
    for (const line of lines) {
        if (line.trim().startsWith('qreg')) {
            const match = line.match(/\[(\d+)\]/);
            if (match) {
                numWires = parseInt(match[1], 10);
                // Cap the number of partitions to the number of wires.
                const N = Math.min(numPartitions, numWires);
                partOfWire = greedyPartition(numWires, N);
                console.log(`Partitioning into ${N} parts. Map:`, partOfWire);
            }
        }
    }

    if (numWires === 0) {
        console.error("Could not determine the number of wires from QASM.");
        return qasmString; 
    }

    // Second pass: Rewrite the QASM lines.
    for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('cx') || trimmedLine.startsWith('cz')) {
            const match = trimmedLine.match(/q\[(\d+)\],q\[(\d+)\]/);
            if (match) {
                const controlWire = parseInt(match[1], 10);
                const targetWire = parseInt(match[2], 10);
                const controlPart = partOfWire[controlWire];
                const targetPart = partOfWire[targetWire];

                // Check if the gate crosses a partition.
                if (controlPart !== targetPart) {
                    const gateType = trimmedLine.startsWith('cx') ? "CNOT" : "CZ";
                    console.log(`Rewriting cross-partition ${gateType} on wires ${controlWire}, ${targetWire}.`);
                    
                    // Replace with visually distinct, supported QASM commands.
                    newLines.push(`// ---- Non-Local ${gateType} replaced ----`);
                    newLines.push(`h q[${controlWire}]; // Placeholder for NL-Out`);
                    newLines.push(`x q[${targetWire}]; // Placeholder for NL-In`);
                    continue; // Skip adding the original cx/cz line.
                }
            }
        }
        newLines.push(line);
    }

    return newLines.join('\n');
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

        const converter = new CircuitConverter(circuit);
        const originalQasm = converter.exportToFormat("QASM2.0");
        console.log("Original QASM:\n", originalQasm);

        const rewrittenQasm = rewriteQasm(originalQasm, N);
        console.log("Rewritten QASM:\n", rewrittenQasm);

        // This will now succeed because the rewritten QASM is valid.
        window.dispatchEvent(new CustomEvent('import:text', { detail: rewrittenQasm }));

    } catch (error) {
        console.error("An error occurred during the partitioning process:", error);
        alert("An error occurred. Check the developer console for details.");
    }
  });
}