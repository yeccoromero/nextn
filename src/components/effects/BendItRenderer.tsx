"use client";

import React, { useEffect, useRef, useCallback } from "react";
import type { BendParams, Vec2 } from "@/lib/effects/bend-math";

// ─── GLSL Shaders ───────────────────────────────────────────────────

const VERT_SRC = `#version 300 es
  in vec2 a_position;
  out vec2 v_uv;
  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const FRAG_SRC = `#version 300 es
  precision highp float;

  uniform sampler2D u_tex;
  uniform vec2 u_res;       // output resolution (px)
  uniform vec2 u_texRes;    // texture resolution (px)
  uniform vec2 u_start;     // Start point (px)
  uniform vec2 u_end;       // End point (px)
  uniform float u_theta;    // bend angle (radians)
  uniform int u_pre;        // 0=none, 1=static, 2=bend, 3=mirror
  uniform int u_post;       // 0=legal, 1=extended

  in vec2 v_uv;
  out vec4 fragColor;

  const float EPS = 1e-5;

  vec2 perpVec(vec2 v) { return vec2(-v.y, v.x); }

  // Inverse bend: apply bend with -theta to find source coordinate
  vec2 inverseBend(vec2 P) {
    vec2 S = u_start;
    vec2 E = u_end;
    float theta = -u_theta; // inverse

    vec2 d = E - S;
    float L = length(d);
    if (L < EPS) return P;

    vec2 t = d / L;
    vec2 n = perpVec(t);

    vec2 PS = P - S;
    float u = dot(PS, t);
    float v = dot(PS, n);

    // Region handling
    if (u < 0.0) {
      if (u_pre == 0) return vec2(-1.0); // none → discard
      else if (u_pre == 1) return P;      // static → no deform
      else if (u_pre == 3) u = -u;        // mirror
      // bend → allow negative u
    }

    if (u > L) {
      if (u_post == 0) return vec2(-1.0); // legal → discard
      // extended → allow
    }

    if (abs(theta) < EPS) return P;

    float R = L / theta;
    float phi = (u / L) * theta;

    float s = sin(phi);
    float c = cos(phi);

    // Base on arc
    vec2 base = S + t * (R * s) + n * (R * (1.0 - c));

    // Rotated normal
    vec2 nPrime = (-s) * t + (c) * n;

    return base + v * nPrime;
  }

  void main() {
    vec2 Pout = v_uv * u_res;
    vec2 Psrc = inverseBend(Pout);

    // Out of bounds check
    if (Psrc.x < -0.5 || Psrc.y < -0.5) {
      fragColor = vec4(0.0);
      return;
    }

    vec2 uvSrc = Psrc / u_texRes;

    // Clamp to texture bounds
    if (uvSrc.x < 0.0 || uvSrc.x > 1.0 || uvSrc.y < 0.0 || uvSrc.y > 1.0) {
      fragColor = vec4(0.0);
      return;
    }

    fragColor = texture(u_tex, uvSrc);
  }
`;

// ─── WebGL Helpers ──────────────────────────────────────────────────

function createShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Shader compile error:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createProgram(gl: WebGL2RenderingContext, vertSrc: string, fragSrc: string): WebGLProgram | null {
    const vert = createShader(gl, gl.VERTEX_SHADER, vertSrc);
    const frag = createShader(gl, gl.FRAGMENT_SHADER, fragSrc);
    if (!vert || !frag) return null;

    const program = gl.createProgram();
    if (!program) return null;
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error("Program link error:", gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }

    // Cleanup individual shaders (attached to program now)
    gl.deleteShader(vert);
    gl.deleteShader(frag);

    return program;
}

// ─── Component ──────────────────────────────────────────────────────

export type BendItRendererProps = {
    /** Source image URL or data URI */
    imageUrl: string;
    /** Bend parameters */
    params: BendParams;
    /** Canvas width */
    width?: number;
    /** Canvas height */
    height?: number;
    /** CSS class */
    className?: string;
};

export function BendItRenderer({
    imageUrl,
    params,
    width = 800,
    height = 450,
    className,
}: BendItRendererProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const glRef = useRef<WebGL2RenderingContext | null>(null);
    const programRef = useRef<WebGLProgram | null>(null);
    const textureRef = useRef<WebGLTexture | null>(null);
    const texSizeRef = useRef<Vec2>({ x: 1, y: 1 });
    const rafRef = useRef<number>(0);

    // Init WebGL once
    const initGL = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: false });
        if (!gl) {
            console.error("WebGL2 not supported");
            return;
        }

        glRef.current = gl;

        // Create program
        const program = createProgram(gl, VERT_SRC, FRAG_SRC);
        if (!program) return;
        programRef.current = program;

        // Full-screen quad (-1 to 1)
        const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

        const aPos = gl.getAttribLocation(program, "a_position");
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

        // Create texture
        const texture = gl.createTexture();
        textureRef.current = texture;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        // Placeholder 1x1 pixel
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }, []);

    // Load image into texture
    const loadImage = useCallback((url: string) => {
        const gl = glRef.current;
        const texture = textureRef.current;
        if (!gl || !texture) return;

        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
            texSizeRef.current = { x: img.width, y: img.height };
        };
        img.src = url;
    }, []);

    // Render frame
    const renderFrame = useCallback(() => {
        const gl = glRef.current;
        const program = programRef.current;
        if (!gl || !program) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(program);

        // Set uniforms
        gl.uniform2f(gl.getUniformLocation(program, "u_res"), width, height);
        gl.uniform2f(gl.getUniformLocation(program, "u_texRes"), texSizeRef.current.x, texSizeRef.current.y);
        gl.uniform2f(gl.getUniformLocation(program, "u_start"), params.start.x, params.start.y);
        gl.uniform2f(gl.getUniformLocation(program, "u_end"), params.end.x, params.end.y);
        gl.uniform1f(gl.getUniformLocation(program, "u_theta"), params.theta);

        const preMap = { none: 0, static: 1, bend: 2, mirror: 3 } as const;
        const postMap = { legal: 0, extended: 1 } as const;
        gl.uniform1i(gl.getUniformLocation(program, "u_pre"), preMap[params.prestart]);
        gl.uniform1i(gl.getUniformLocation(program, "u_post"), postMap[params.postEnd]);

        // Bind texture
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, textureRef.current);
        gl.uniform1i(gl.getUniformLocation(program, "u_tex"), 0);

        // Draw
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }, [params, width, height]);

    // Lifecycle
    useEffect(() => {
        initGL();
        return () => {
            cancelAnimationFrame(rafRef.current);
            const gl = glRef.current;
            if (gl) {
                if (programRef.current) gl.deleteProgram(programRef.current);
                if (textureRef.current) gl.deleteTexture(textureRef.current);
            }
        };
    }, [initGL]);

    useEffect(() => {
        loadImage(imageUrl);
    }, [imageUrl, loadImage]);

    useEffect(() => {
        renderFrame();
    }, [renderFrame]);

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className={className}
            style={{ display: "block" }}
        />
    );
}
