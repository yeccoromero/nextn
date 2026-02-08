
import os

filepath = "/Users/dro-ebru/Downloads/download-v2/src/components/timeline/graph-editor-panel.tsx"

clean_code = """        } else if (graphMode === 'value') {
            const valRange = globalMaxVal - globalMinVal;
            const padding = valRange * 0.15 || 10;
            const vMin = globalMinVal - padding;
            const vMax = globalMaxVal + padding;
            const PADDING = 20;
            const contentHeight = height - PADDING * 2;

            calculatedSegments.forEach(trackData => {
                trackData.segments.forEach(seg => {
                    const { kfStart, cp1, cp2, startX, endX, val1, val2, startMs, durationMs } = seg;

                    // Show handles for anything that is not linear or hold.
                    // This includes explicit 'bezier', 'ease', and implicit undefined (which defaults to S-curve).
                    const hasBezier = kfStart.interpolation !== 'linear' && kfStart.interpolation !== 'hold';
                    if (!hasBezier) return;

                    const segmentWidthPx = endX - startX;
                    const deltaVal = val2 - val1;

                    // Calculate P1 (Out Handle)
                    const p1Time = startMs + cp1.x * durationMs;
                    const p1Val = val1 + cp1.y * deltaVal;

                    const outHandleScreenX = timeToScreenX(p1Time, width);
                    const outHandleScreenY = PADDING + ((vMax - p1Val) / (vMax - vMin)) * contentHeight;

                    // Calculate P2 (In Handle)
                    const p2Time = startMs + cp2.x * durationMs;
                    const p2Val = val1 + cp2.y * deltaVal;

                    const inHandleScreenX = timeToScreenX(p2Time, width);
                    const inHandleScreenY = PADDING + ((vMax - p2Val) / (vMax - vMin)) * contentHeight;

                    newHandles.push({
                        kfId: kfStart.id,
                        objectId: trackData.objectId,
                        propertyId: trackData.propertyId,
                        kfTimeMs: kfStart.timeMs,
                        kfX: startX,
                        kfY: PADDING + ((vMax - val1) / (vMax - vMin)) * contentHeight,
                        outHandle: {
                            screenX: outHandleScreenX,
                            screenY: outHandleScreenY,
                            visualScreenX: outHandleScreenX,
                            visualScreenY: outHandleScreenY
                        },
                        inHandle: null,
                        originalCp1: { ...cp1 },
                        originalCp2: { ...cp2 },
                        segmentWidthPx,
                        segmentHeightPx: contentHeight, // Approximate for drag norm
                        deltaValue: deltaVal,
                        valueRange: valRange,
                        tangentMode: kfStart.tangentMode || 'broken'
                    });

                    newHandles.push({
                        kfId: seg.kfEnd.id,
                        objectId: trackData.objectId,
                        propertyId: trackData.propertyId,
                        kfTimeMs: seg.kfEnd.timeMs,
                        kfX: endX,
                        kfY: PADDING + ((vMax - val2) / (vMax - vMin)) * contentHeight,
                        outHandle: null,
                        inHandle: {
                            screenX: inHandleScreenX,
                            screenY: inHandleScreenY,
                            visualScreenX: inHandleScreenX,
                            visualScreenY: inHandleScreenY
                        },
                        originalCp1: { ...cp1 },
                        originalCp2: { ...cp2 },
                        segmentWidthPx,
                        segmentHeightPx: contentHeight,
                        deltaValue: deltaVal,
                        valueRange: valRange,
                        tangentMode: seg.kfEnd.tangentMode || 'broken'
                    });
                });
            });
        }
"""

with open(filepath, 'r') as f:
    lines = f.readlines()

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if "} else if (graphMode === 'value') {" in line:
        start_idx = i
    if "handlesRef.current = newHandles;" in line:
        if start_idx != -1 and i > start_idx:
            end_idx = i
            break

if start_idx != -1 and end_idx != -1:
    print(f"Found block: {start_idx} to {end_idx}")
    # Replace lines[start_idx : end_idx] with clean_code
    # Note: clean_code ends with '}', so we replace up to just before 'handlesRef...'
    # But wait, 'handlesRef...' is OUTSIDE the block.
    # The block usually ends with '}' on the line before 'handlesRef...'.
    # We should detect the closing brace?
    # No, clean_code INCLUDES the opening line and the closing brace line.
    # So we replace lines[start_idx : end_idx] -- wait.
    # Lines[end_idx] is 'handlesRef...', which we want to KEEP.
    # So we replace lines[start_idx : end_idx] with clean_code + newline?
    
    new_lines = lines[:start_idx] + [clean_code + "\n\n"] + lines[end_idx:]
    
    with open(filepath, 'w') as f:
        f.writelines(new_lines)
    print("Fixed file.")
else:
    print("Could not find block boundaries.")
