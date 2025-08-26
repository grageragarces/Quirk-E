// src/distribute/distribute.js
import { fromJsonText_CircuitDefinition } from "../circuit/Serializer.js";
// We will get the QASM conversion function from a different, more reliable module.
// import { Serializer } from "../circuit/Serializer.js"; 
// import { CircuitDefinition } from "../circuit/CircuitDefinition.js";
import { circuitToQasm } from "../ui/exports.js";


// ---------- Partitioning Helper ----------

function greedyPartition(numWires, N) {
  console.log(`Running greedy partitioner for ${numWires} wires into ${N} parts.`);
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
    console.log("Starting QASM rewrite process...");
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
                console.log(`Found ${numWires} wires from 'qreg' declaration.`);
                partOfWire = greedyPartition(numWires, numPartitions);
                console.log("Generated partition map:", partOfWire);
            }
        }
    }

    if (numWires === 0) {
        console.error("Could not determine the number of wires from QASM.");
        return qasmString; // Return original if something is wrong
    }

    // Second pass: Rewrite the QASM lines.
    for (const line of lines) {
        const trimmedLine = line.trim();
        // Look for CNOT (cx) or CZ (cz) gates
        if (trimmedLine.startsWith('cx') || trimmedLine.startsWith('cz')) {
            const match = trimmedLine.match(/q\[(\d+)\],q\[(\d+)\]/);
            if (match) {
                const controlWire = parseInt(match[1], 10);
                const targetWire = parseInt(match[2], 10);

                const controlPart = partOfWire[controlWire];
                const targetPart = partOfWire[targetWire];

                // Check if the gate crosses a partition
                if (controlPart !== targetPart) {
                    const gateType = trimmedLine.startsWith('cx') ? "CNOT" : "CZ";
                    console.log(`Found cross-partition ${gateType} on wires ${controlWire}, ${targetWire}. Rewriting.`);
                    
                    // Replace with comments and placeholder single-qubit gates (u3 is a generic gate).
                    newLines.push(`// ---- Non-Local ${gateType} Start ----`);
                    newLines.push(`u3(0,0,0) q[${controlWire}]; // NL-Out`);
                    newLines.push(`u3(0,0,0) q[${targetWire}]; // NL-In`);
                    newLines.push(`// ---- Non-Local ${gateType} End ----`);
                    continue; // Skip adding the original line
                }
            }
        }
        // If it's not a cross-partition gate, keep the original line.
        newLines.push(line);
    }

    const finalQasm = newLines.join('\n');
    console.log("Rewritten QASM generated successfully.");
    return finalQasm;
}


// ---------- Public init ----------

export function initDistributeLogic(deps) {
  console.log("Distribute logic initialized.");
  const revision = deps.revision;

  window.addEventListener('distribute:confirm', function(ev){
    try {
        console.log("--- 'distribute:confirm' event received ---");
        const detail = ev.detail || {};
        const N = Math.max(1, parseInt(detail.count, 10) || 2);
        console.log(`User requested partitioning into ${N} parts.`);

        const jsonText = revision.peekActiveCommit();
        const circuit = fromJsonText_CircuitDefinition(jsonText);

        if (circuit.numWires === 0) {
            alert("Cannot partition an empty circuit!");
            return;
        }

        // Step 1: Convert the current circuit to a QASM string using the reliable function.
        const originalQasm = circuitToQasm(circuit);
        console.log("Step 1: Original QASM generated.\n", originalQasm);

        // Step 2: Rewrite the QASM string based on partitions.
        const rewrittenQasm = rewriteQasm(originalQasm, N);
        console.log("Step 2: Rewritten QASM ready.\n", rewrittenQasm);

        // Step 3: Programmatically trigger the import functionality.
        console.log("Step 3: Dispatching 'import:text' event to load new circuit.");
        window.dispatchEvent(new CustomEvent('import:text', { detail: rewrittenQasm }));
        console.log("--- Partitioning process complete ---");

    } catch (error) {
        console.error("An error occurred during the partitioning process:", error);
        alert("An error occurred. Check the developer console for details.");
    }
  });
}