/**
 * Easing Presets Library
 * Based on Robert Penner's easing equations and CSS timing functions
 * Values are cubic-bezier control points: { x1, y1, x2, y2 }
 */

export interface EasingPreset {
    id: string;
    name: string;
    displayName: string;
    category: 'linear' | 'ease' | 'sine' | 'quad' | 'cubic' | 'quart' | 'quint' | 'expo' | 'circ' | 'back' | 'custom';
    controlPoints: { x1: number; y1: number; x2: number; y2: number };
    description?: string;
}

export const EASING_PRESETS: EasingPreset[] = [
    // ============ LINEAR ============
    {
        id: 'linear',
        name: 'linear',
        displayName: 'Linear',
        category: 'linear',
        controlPoints: { x1: 0, y1: 0, x2: 1, y2: 1 },
        description: 'Constant speed, no easing'
    },

    // ============ EASE (CSS Standard) ============
    {
        id: 'ease',
        name: 'ease',
        displayName: 'Ease',
        category: 'ease',
        controlPoints: { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 },
        description: 'CSS default ease'
    },
    {
        id: 'ease-in',
        name: 'easeIn',
        displayName: 'Ease In',
        category: 'ease',
        controlPoints: { x1: 0.42, y1: 0, x2: 1, y2: 1 },
        description: 'Starts slow, ends fast'
    },
    {
        id: 'ease-out',
        name: 'easeOut',
        displayName: 'Ease Out',
        category: 'ease',
        controlPoints: { x1: 0, y1: 0, x2: 0.58, y2: 1 },
        description: 'Starts fast, ends slow'
    },
    {
        id: 'ease-in-out',
        name: 'easeInOut',
        displayName: 'Ease In/Out',
        category: 'ease',
        controlPoints: { x1: 0.42, y1: 0, x2: 0.58, y2: 1 },
        description: 'Slow start and end'
    },

    // ============ SINE ============
    {
        id: 'sine-in',
        name: 'sineIn',
        displayName: 'Sine In',
        category: 'sine',
        controlPoints: { x1: 0.47, y1: 0, x2: 0.745, y2: 0.715 },
        description: 'Gentle sine wave start'
    },
    {
        id: 'sine-out',
        name: 'sineOut',
        displayName: 'Sine Out',
        category: 'sine',
        controlPoints: { x1: 0.39, y1: 0.575, x2: 0.565, y2: 1 },
        description: 'Gentle sine wave end'
    },
    {
        id: 'sine-in-out',
        name: 'sineInOut',
        displayName: 'Sine In/Out',
        category: 'sine',
        controlPoints: { x1: 0.445, y1: 0.05, x2: 0.55, y2: 0.95 },
        description: 'Gentle sine wave both'
    },

    // ============ QUAD ============
    {
        id: 'quad-in',
        name: 'quadIn',
        displayName: 'Quad In',
        category: 'quad',
        controlPoints: { x1: 0.55, y1: 0.085, x2: 0.68, y2: 0.53 },
        description: 'Quadratic acceleration'
    },
    {
        id: 'quad-out',
        name: 'quadOut',
        displayName: 'Quad Out',
        category: 'quad',
        controlPoints: { x1: 0.25, y1: 0.46, x2: 0.45, y2: 0.94 },
        description: 'Quadratic deceleration'
    },
    {
        id: 'quad-in-out',
        name: 'quadInOut',
        displayName: 'Quad In/Out',
        category: 'quad',
        controlPoints: { x1: 0.455, y1: 0.03, x2: 0.515, y2: 0.955 },
        description: 'Quadratic both'
    },

    // ============ CUBIC ============
    {
        id: 'cubic-in',
        name: 'cubicIn',
        displayName: 'Cubic In',
        category: 'cubic',
        controlPoints: { x1: 0.55, y1: 0.055, x2: 0.675, y2: 0.19 },
        description: 'Cubic acceleration'
    },
    {
        id: 'cubic-out',
        name: 'cubicOut',
        displayName: 'Cubic Out',
        category: 'cubic',
        controlPoints: { x1: 0.215, y1: 0.61, x2: 0.355, y2: 1 },
        description: 'Cubic deceleration'
    },
    {
        id: 'cubic-in-out',
        name: 'cubicInOut',
        displayName: 'Cubic In/Out',
        category: 'cubic',
        controlPoints: { x1: 0.645, y1: 0.045, x2: 0.355, y2: 1 },
        description: 'Cubic both'
    },

    // ============ QUART ============
    {
        id: 'quart-in',
        name: 'quartIn',
        displayName: 'Quart In',
        category: 'quart',
        controlPoints: { x1: 0.895, y1: 0.03, x2: 0.685, y2: 0.22 },
        description: 'Quartic acceleration'
    },
    {
        id: 'quart-out',
        name: 'quartOut',
        displayName: 'Quart Out',
        category: 'quart',
        controlPoints: { x1: 0.165, y1: 0.84, x2: 0.44, y2: 1 },
        description: 'Quartic deceleration'
    },
    {
        id: 'quart-in-out',
        name: 'quartInOut',
        displayName: 'Quart In/Out',
        category: 'quart',
        controlPoints: { x1: 0.77, y1: 0, x2: 0.175, y2: 1 },
        description: 'Quartic both'
    },

    // ============ QUINT ============
    {
        id: 'quint-in',
        name: 'quintIn',
        displayName: 'Quint In',
        category: 'quint',
        controlPoints: { x1: 0.755, y1: 0.05, x2: 0.855, y2: 0.06 },
        description: 'Quintic acceleration'
    },
    {
        id: 'quint-out',
        name: 'quintOut',
        displayName: 'Quint Out',
        category: 'quint',
        controlPoints: { x1: 0.23, y1: 1, x2: 0.32, y2: 1 },
        description: 'Quintic deceleration'
    },
    {
        id: 'quint-in-out',
        name: 'quintInOut',
        displayName: 'Quint In/Out',
        category: 'quint',
        controlPoints: { x1: 0.86, y1: 0, x2: 0.07, y2: 1 },
        description: 'Quintic both'
    },

    // ============ EXPO ============
    {
        id: 'expo-in',
        name: 'expoIn',
        displayName: 'Expo In',
        category: 'expo',
        controlPoints: { x1: 0.95, y1: 0.05, x2: 0.795, y2: 0.035 },
        description: 'Exponential acceleration'
    },
    {
        id: 'expo-out',
        name: 'expoOut',
        displayName: 'Expo Out',
        category: 'expo',
        controlPoints: { x1: 0.19, y1: 1, x2: 0.22, y2: 1 },
        description: 'Exponential deceleration'
    },
    {
        id: 'expo-in-out',
        name: 'expoInOut',
        displayName: 'Expo In/Out',
        category: 'expo',
        controlPoints: { x1: 1, y1: 0, x2: 0, y2: 1 },
        description: 'Exponential both'
    },

    // ============ CIRC ============
    {
        id: 'circ-in',
        name: 'circIn',
        displayName: 'Circ In',
        category: 'circ',
        controlPoints: { x1: 0.6, y1: 0.04, x2: 0.98, y2: 0.335 },
        description: 'Circular acceleration'
    },
    {
        id: 'circ-out',
        name: 'circOut',
        displayName: 'Circ Out',
        category: 'circ',
        controlPoints: { x1: 0.075, y1: 0.82, x2: 0.165, y2: 1 },
        description: 'Circular deceleration'
    },
    {
        id: 'circ-in-out',
        name: 'circInOut',
        displayName: 'Circ In/Out',
        category: 'circ',
        controlPoints: { x1: 0.785, y1: 0.135, x2: 0.15, y2: 0.86 },
        description: 'Circular both'
    },

    // ============ BACK (Overshoot) ============
    {
        id: 'back-in',
        name: 'backIn',
        displayName: 'Back In',
        category: 'back',
        controlPoints: { x1: 0.6, y1: -0.28, x2: 0.735, y2: 0.045 },
        description: 'Overshoot at start'
    },
    {
        id: 'back-out',
        name: 'backOut',
        displayName: 'Back Out',
        category: 'back',
        controlPoints: { x1: 0.175, y1: 0.885, x2: 0.32, y2: 1.275 },
        description: 'Overshoot at end'
    },
    {
        id: 'back-in-out',
        name: 'backInOut',
        displayName: 'Back In/Out',
        category: 'back',
        controlPoints: { x1: 0.68, y1: -0.55, x2: 0.265, y2: 1.55 },
        description: 'Overshoot both'
    },
];

// Category metadata for UI organization
export const EASING_CATEGORIES = [
    { id: 'linear', name: 'Linear', color: '#9ca3af' },
    { id: 'ease', name: 'Ease', color: '#60a5fa' },
    { id: 'sine', name: 'Sine', color: '#34d399' },
    { id: 'quad', name: 'Quad', color: '#f472b6' },
    { id: 'cubic', name: 'Cubic', color: '#fb923c' },
    { id: 'quart', name: 'Quart', color: '#a78bfa' },
    { id: 'quint', name: 'Quint', color: '#22d3ee' },
    { id: 'expo', name: 'Expo', color: '#fbbf24' },
    { id: 'circ', name: 'Circ', color: '#f87171' },
    { id: 'back', name: 'Back', color: '#ec4899' },
    { id: 'custom', name: 'Custom', color: '#eab308' },
] as const;

// Helper functions
export function getPresetById(id: string): EasingPreset | undefined {
    return EASING_PRESETS.find(p => p.id === id);
}

export function getPresetsByCategory(category: EasingPreset['category']): EasingPreset[] {
    return EASING_PRESETS.filter(p => p.category === category);
}

export function getAllCategories(): string[] {
    return [...new Set(EASING_PRESETS.map(p => p.category))];
}

export function getCategoryColor(category: string): string {
    const cat = EASING_CATEGORIES.find(c => c.id === category);
    return cat?.color || '#888';
}

/**
 * Parse a cubic-bezier string into control points
 * Supports formats:
 * - "cubic-bezier(0.42, 0, 0.58, 1)"
 * - "0.42, 0, 0.58, 1"
 * - URL from cubic-bezier.com
 */
export function parseCubicBezier(input: string): { x1: number; y1: number; x2: number; y2: number } | null {
    const regex = /(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)/;
    const match = input.match(regex);

    if (!match) return null;

    const x1 = parseFloat(match[1]);
    const y1 = parseFloat(match[2]);
    const x2 = parseFloat(match[3]);
    const y2 = parseFloat(match[4]);

    // Validate x values are in [0, 1]
    if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) return null;

    return { x1, y1, x2, y2 };
}

/**
 * Convert control points to CSS cubic-bezier string
 */
export function toCubicBezierString(cp: { x1: number; y1: number; x2: number; y2: number }): string {
    return `cubic-bezier(${cp.x1}, ${cp.y1}, ${cp.x2}, ${cp.y2})`;
}
