export type Point = { x: number; y: number };

/**
 * Represents a 3x3 Affine Transformation Matrix for 2D space.
 * [ a  c  tx ]
 * [ b  d  ty ]
 * [ 0  0  1  ]
 *
 * Stored as array: [a, b, c, d, tx, ty]
 */
export class Matrix3 {
    // a, b, c, d, tx, ty
    props: [number, number, number, number, number, number] = [1, 0, 0, 1, 0, 0];

    constructor(a = 1, b = 0, c = 0, d = 1, tx = 0, ty = 0) {
        this.props = [a, b, c, d, tx, ty];
    }

    static identity(): Matrix3 {
        return new Matrix3();
    }

    static fromCompose(x: number, y: number, scaleX: number, scaleY: number, rotationDeg: number, pivotX = 0, pivotY = 0): Matrix3 {
        const m = new Matrix3();
        m.translate(x, y);
        m.rotate(rotationDeg * Math.PI / 180);
        m.scale(scaleX, scaleY);
        m.translate(-pivotX, -pivotY); // Apply pivot offset correction locally if needed??
        // Actually, pivot logic usually implies: Translate(toPivot) -> Rotate/Scale -> Translate(-toPivot)
        // But standard Compose usually usually means: Translate(pos) * Rotate(r) * Scale(s) * Translate(-anchor)
        return m;
    }

    /**
     * Multiplies this matrix by another (A * B).
     * Result is applied to this matrix.
     */
    multiply(m: Matrix3): Matrix3 {
        const [a1, b1, c1, d1, tx1, ty1] = this.props;
        const [a2, b2, c2, d2, tx2, ty2] = m.props;

        this.props[0] = a1 * a2 + c1 * b2;
        this.props[1] = b1 * a2 + d1 * b2;
        this.props[2] = a1 * c2 + c1 * d2;
        this.props[3] = b1 * c2 + d1 * d2;
        this.props[4] = a1 * tx2 + c1 * ty2 + tx1;
        this.props[5] = b1 * tx2 + d1 * ty2 + ty1;

        return this;
    }

    /**
     * Pre-multiplies this matrix by another (B * A).
     */
    preMultiply(m: Matrix3): Matrix3 {
        const temp = m.clone();
        temp.multiply(this);
        this.props = temp.props;
        return this;
    }

    translate(x: number, y: number): Matrix3 {
        return this.multiply(new Matrix3(1, 0, 0, 1, x, y));
    }

    rotate(radians: number): Matrix3 {
        const c = Math.cos(radians);
        const s = Math.sin(radians);
        return this.multiply(new Matrix3(c, s, -s, c, 0, 0));
    }

    scale(sx: number, sy: number): Matrix3 {
        return this.multiply(new Matrix3(sx, 0, 0, sy, 0, 0));
    }

    inverse(): Matrix3 {
        const [a, b, c, d, tx, ty] = this.props;
        const det = a * d - b * c;
        if (det === 0) return new Matrix3(); // Fallback to identity? Or error?

        const invDet = 1 / det;
        return new Matrix3(
            d * invDet,
            -b * invDet,
            -c * invDet,
            a * invDet,
            (c * ty - d * tx) * invDet,
            (b * tx - a * ty) * invDet
        );
    }

    transformPoint(p: Point): Point {
        const [a, b, c, d, tx, ty] = this.props;
        return {
            x: a * p.x + c * p.y + tx,
            y: b * p.x + d * p.y + ty
        };
    }

    clone(): Matrix3 {
        return new Matrix3(...this.props);
    }
}
