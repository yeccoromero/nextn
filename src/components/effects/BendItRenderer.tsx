"use client";

import * as React from "react";
import { useEffect, useRef, useCallback } from "react";

// Types derived from usage
export type Vec2 = { x: number, y: number };
export type BendParams = {
    start: Vec2;
    end: Vec2;
    theta: number;
    prestart: 'none' | 'static' | 'bend' | 'mirror';
    postEnd: 'legal' | 'extended';
};

// ─── GLSL Shaders ───────────────────────────────────────────────────

const VERT_SRC = `#version 300 es
  in vec2 a_position;
  out vec2 v_uv;
  void main() {
    v_uv = a_position * 0.5 + 0.5;
    v_uv.y = 1.0 - v_uv.y; // Flip Y to match SVG (0 is top)
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const FRAG_SRC = `#version 300 es
  precision highp float;

  uniform sampler2D u_tex;
  uniform vec2 u_res;       // output resolution
  uniform vec2 u_texRes;    // texture resolution
  uniform vec2 u_start;     // Start point
  uniform vec2 u_end;       // End point
  uniform vec2 u_offset;    // Texture offset (padding)
  uniform float u_theta;    // bend angle (radians)
  uniform int u_pre;        // 0=none, 1=static, 2=bend, 3=mirror
  uniform int u_post;       // 0=legal, 1=extended

  in vec2 v_uv;
  out vec4 fragColor;

  const float EPS = 1e-4;
  const float PI = 3.14159265;

  vec2 perpVec(vec2 v) { return vec2(-v.y, v.x); }

  void main() {
    vec2 P = v_uv * u_res; // Current Pixel in Screen Space

    // 1. Define Basis
    vec2 S = u_start;
    vec2 E = u_end;
    vec2 dir = E - S;
    float L = length(dir);
    
    if (L < EPS) { fragColor = vec4(0.0); return; }
    
    vec2 t = dir / L;      // Tangent (Axis unit vector)
    vec2 n = perpVec(t);   // Normal (Perpendicular unit vector)

    vec2 srcUV = vec2(0.0);

    // 2. Linear vs Bend Logic
    if (abs(u_theta) < EPS) {
        // --- LINEAR MODE (Reference) ---
        vec2 PS = P - S;
        float u = dot(PS, t);
        float v = dot(PS, n);
        srcUV = vec2(u, v);
    } else {
        // --- BEND MODE (Inverse Map: Arc -> Line) ---
        float R = L / u_theta;

        // Center of Curvature (O) = S + n * R
        // If theta > 0, we bend "right" relative to tangent. Center is on +n side.
        vec2 O = S + n * R;

        // Vector from Center to Pixel
        vec2 OP = P - O;
        float r_pixel = length(OP);

        // Project OP onto Basis at O
        // Basis X' = -n (Vector from O to S, length |R|)
        // Basis Y' = t  (Tangent at S)
        float x_prime = dot(OP, -n); 
        float y_prime = dot(OP, t);  

        // Angle alpha relative to S.
        // atan returns angle in [-PI, PI].
        // At S, x_prime = dot(S-O, -n) = dot(-nR, -n) = R.
        // If R > 0: x_prime = R > 0. atan(0, R) = 0. Correct.
        // If R < 0: x_prime = R < 0. atan(0, neg) = PI (or -PI).
        // We need alpha to be continuous around 0 for the arc length calculation.
        
        float alpha = atan(y_prime, x_prime);
        
        // Correct for wrap-around when R < 0
        if (R < 0.0) {
             // We are at angle PI. We want 0.
             // If y_prime > 0 (positive arc length), atan is slightly < PI. 
             //   Ex: 3.1. We want small positive. 3.1 - PI ~= -0.04. Wait.
             //   If moving along t+, standard bend Left (R<0).
             //   Arc length u should be positive? 
             //   u = alpha * R. 
             //   If alpha is negative small, u = neg * neg = pos. Correct.
             // So if atan is ~PI, we subtract PI to get small negative alpha.
             // If y_prime < 0, atan is > -PI (ex: -3.1).
             //   We add PI to get small positive alpha.
             //   u = pos * neg = neg. Correct.
             
             if (alpha > 0.0) alpha -= PI;
             else alpha += PI;
        }

        float u_calc = alpha * R;

        // Source V (Radial Dist)
        // v = R - r * sign(R)
        float v_calc = R - r_pixel * sign(R);
        
        srcUV = vec2(u_calc, v_calc);
    }

    // 3. Region Bounds Check with Anti-Aliasing
    // We use a small feather value (fwidth-like) for soft edges
    float feather = 0.005; // Adjustable softness
    
    float alpha = 1.0;
    
    if (srcUV.x < 0.0) {
       // Pre-Start
       // 0=none, 1=static, 2=bend, 3=mirror
       if (u_pre == 0) { 
           // Fade out at 0
           alpha *= smoothstep(-feather, 0.0, srcUV.x);
       } else if (u_pre == 1) { 
           // Static: Recompute linearly for correct texture lookups in the "tail"
           srcUV = vec2(dot(P-S, t), dot(P-S, n));
       }
       else if (u_pre == 3) {
           srcUV.x = -srcUV.x; // Mirror
       }
       // 2=Bend: Allow computed negative u
    } else if (srcUV.x > L) {
       // Post-End
       if (u_post == 0) { 
           // Fade out at L
           alpha *= smoothstep(L + feather, L, srcUV.x);
       } 
       // 1=Extended: Allow computed u > L
    }

    // 4. Texture Sampling
    // Flatten back to Local Space using Linear Basis
    vec2 P_unbent = S + t * srcUV.x + n * srcUV.y;
    
    // Convert to Texture Coordinates
    // u_offset centers the texture at the Object Origin in Renderer Space.
    vec2 posInTexture = P_unbent - u_offset;
    vec2 finalUV = posInTexture / u_texRes;

    // Strict Texture Bounds Check with AA
    // Smoothstep for border Softness
    float borderX = smoothstep(0.0, feather, finalUV.x) * (1.0 - smoothstep(1.0 - feather, 1.0, finalUV.x));
    float borderY = smoothstep(0.0, feather, finalUV.y) * (1.0 - smoothstep(1.0 - feather, 1.0, finalUV.y));
    
    alpha *= borderX * borderY;

    if (alpha <= 0.0) {
        fragColor = vec4(0.0);
        return;
    }

    vec4 texColor = texture(u_tex, finalUV);
    fragColor = texColor * alpha;
  }
`;

export function BendItRenderer({
    imageUrl,
    width,
    height,
    params,
    renderScale = 1,
}: {
    imageUrl: string;
    width: number;
    height: number;
    params: BendParams;
    renderScale?: number;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const textureRef = useRef<WebGLTexture | null>(null);
    const texSizeRef = useRef<Vec2>({ x: 0, y: 0 });

    // Compile shader helper
    const compileShader = (gl: WebGL2RenderingContext, type: number, src: string) => {
        const s = gl.createShader(type);
        if (!s) return null;
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
            console.error("Shader compile error:", gl.getShaderInfoLog(s));
            gl.deleteShader(s);
            return null;
        }
        return s;
    };

    // Create texture from image URL
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        // preserveDrawingBuffer is needed for hit testing (readPixels)
        const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, preserveDrawingBuffer: true });
        if (!gl) return;

        let active = true;
        const img = new Image();
        img.onload = () => {
            if (!active) return;

            const tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tex);

            // Check if power of 2
            const isPowerOf2 = (value: number) => (value & (value - 1)) === 0;
            const canMipmap = isPowerOf2(img.naturalWidth) && isPowerOf2(img.naturalHeight);

            if (canMipmap) {
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
                gl.generateMipmap(gl.TEXTURE_2D);
            } else {
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            }
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

            // SWAP TEXTURES: Delete old one only now that new one is ready
            if (textureRef.current && textureRef.current !== tex) {
                gl.deleteTexture(textureRef.current);
            }

            textureRef.current = tex;
            texSizeRef.current = { x: img.naturalWidth, y: img.naturalHeight };

            // Force a redraw
            renderFrame();
        };
        img.src = imageUrl;

        // Note: We DO NOT delete the texture in the cleanup of this effect.
        // We want the old texture to persist until the new one is loaded (swap above).
        // A separate useEffect handles final cleanup on unmount.
        return () => {
            active = false;
        };
    }, [imageUrl]);

    // Unmount Cleanup
    useEffect(() => {
        return () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const gl = canvas.getContext("webgl2");
            if (gl && textureRef.current) {
                gl.deleteTexture(textureRef.current);
            }
        };
    }, []);

    const renderFrame = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !textureRef.current) return;
        const gl = canvas.getContext("webgl2");
        if (!gl) return;

        // Viewport
        gl.viewport(0, 0, width * renderScale, height * renderScale);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Setup Program
        const vs = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
        const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
        if (!vs || !fs) return;
        const program = gl.createProgram();
        if (!program) return;
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error("Program link error:", gl.getProgramInfoLog(program));
            return;
        }
        gl.useProgram(program);

        // Geometry (Full Quad)
        const vertices = new Float32Array([
            -1, -1,
            1, -1,
            -1, 1,
            1, 1,
        ]);
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        const aLoc = gl.getAttribLocation(program, "a_position");
        gl.enableVertexAttribArray(aLoc);
        gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);

        // Set uniforms
        gl.uniform2f(gl.getUniformLocation(program, "u_res"), width * renderScale, height * renderScale);
        gl.uniform2f(gl.getUniformLocation(program, "u_texRes"), texSizeRef.current.x, texSizeRef.current.y);
        gl.uniform2f(gl.getUniformLocation(program, "u_start"), params.start.x * renderScale, params.start.y * renderScale);
        gl.uniform2f(gl.getUniformLocation(program, "u_end"), params.end.x * renderScale, params.end.y * renderScale);

        // Calculate offset to center the texture at the origin (250, 250)
        // Texture is Top-Left aligned (0,0), but Object is Center aligned at (0,0) world.
        // In Renderer Space, Object Origin is at (250, 250).
        // WE MUST SCALE THE PADDING AND OFFSET LOGIC TOO
        const padding = 250 * renderScale;
        const offsetX = padding - texSizeRef.current.x / 2;
        const offsetY = padding - texSizeRef.current.y / 2;
        gl.uniform2f(gl.getUniformLocation(program, "u_offset"), offsetX, offsetY);

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

        // Cleanup
        gl.deleteBuffer(buf);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        gl.deleteProgram(program);

    }, [params, width, height, renderScale]);

    // Render loop
    useEffect(() => {
        let animId: number;
        const loop = () => {
            renderFrame();
            animId = requestAnimationFrame(loop);
        };
        loop();
        return () => cancelAnimationFrame(animId);
    }, [renderFrame]);

    return (
        <canvas
            ref={canvasRef}
            width={width * renderScale}
            height={height * renderScale}
            style={{ display: "block", width: width, height: height }}
            data-pixel-test="true"
        />
    );
}
