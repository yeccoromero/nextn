"use client";

import React, { useState } from "react";
import { BendItRenderer } from "@/components/effects/BendItRenderer";
import { BendItControls } from "@/components/effects/BendItControls";
import { degToRad } from "@/lib/effects/bend-math";
import type { BendParams } from "@/lib/effects/bend-math";

/**
 * Standalone demo page for the Bend It effect.
 * Validates the full pipeline: Math → WebGL Shader → UI Controls.
 * 
 * Access at: /bend-it-demo
 */
export default function BendItDemoPage() {
    const [params, setParams] = useState<BendParams>({
        start: { x: 120, y: 225 },
        end: { x: 680, y: 225 },
        theta: degToRad(45),
        prestart: "static",
        postEnd: "extended",
    });

    return (
        <div
            style={{
                minHeight: "100vh",
                background: "#0a0a0a",
                color: "#e5e5e5",
                fontFamily: "'Inter', system-ui, sans-serif",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "2rem",
                gap: "1.5rem",
            }}
        >
            <h1
                style={{
                    fontSize: "1.5rem",
                    fontWeight: 700,
                    background: "linear-gradient(135deg, #60a5fa, #a78bfa)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                }}
            >
                Bend It Effect — Demo
            </h1>
            <p style={{ fontSize: "0.85rem", color: "#737373", maxWidth: 600, textAlign: "center" }}>
                CC Bend It implementation using raw WebGL2. Adjust controls to deform the test grid.
            </p>

            <div
                style={{
                    display: "flex",
                    gap: "1.5rem",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    justifyContent: "center",
                }}
            >
                {/* WebGL Canvas */}
                <div
                    style={{
                        border: "1px solid #262626",
                        borderRadius: "0.75rem",
                        overflow: "hidden",
                        background: "#111",
                    }}
                >
                    <BendItRenderer
                        imageUrl="/bend-test-grid.svg"
                        params={params}
                        width={800}
                        height={450}
                    />
                </div>

                {/* Controls */}
                <div
                    style={{
                        width: 260,
                        background: "#111",
                        border: "1px solid #262626",
                        borderRadius: "0.75rem",
                        padding: "1rem",
                    }}
                >
                    <BendItControls
                        params={params}
                        onChange={setParams}
                        onCommit={() => { }}
                    />
                </div>
            </div>

            <p style={{ fontSize: "0.7rem", color: "#525252", marginTop: "1rem" }}>
                Deformation uses arc-circular model (inverse bend mapping in GPU fragment shader).
            </p>
        </div>
    );
}
