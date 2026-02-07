// @ts-nocheck
import * as fabric from 'fabric';
import { nanoid } from 'nanoid';
import { SvgObject, GroupObject, RectangleObject, EllipseObject, PathObject, TextObject, BezierPoint } from '@/types/editor';
import { normalizePath } from './normalizePath';

// Helpers: tamaño/centro absolutos y props de estilo
const getCenterAndSize = (obj: fabric.FabricObject) => {
    const br = obj.getBoundingRect(true, true);
    return {
        cx: br.left + br.width / 2,
        cy: br.top + br.height / 2,
    };
};

const toLocalPoints = <T extends { x: number; y: number; handleIn?: any; handleOut?: any; mode: any }>(
    pts: T[], cx: number, cy: number
) => pts.map(p => ({
    ...p, x: p.x - cx, y: p.y - cy,
    ...(p.handleIn ? { handleIn: { x: p.handleIn.x - cx, y: p.handleIn.y - cy } } : {}),
    ...(p.handleOut ? { handleOut: { x: p.handleOut.x - cx, y: p.handleOut.y - cy } } : {}),
}));

type AnyEl = (Element & { getAttribute(name: string): string | null }) | undefined;

const numAttr = (el: AnyEl, name: string) =>
    el?.hasAttribute?.(name) ? Number(el.getAttribute(name)) : undefined;

const strAttr = (el: AnyEl, name: string) =>
    el?.getAttribute?.(name) ?? undefined;


function fabricToSvgObject(obj: fabric.FabricObject, layerId: string, el?: AnyEl): SvgObject | SvgObject[] | null {
    const raw = obj.toObject?.() ?? {};
    const { cx, cy } = getCenterAndSize(obj);
    const fillIsString = typeof obj.fill === 'string';
    const fillGradient = !fillIsString && obj.fill && (obj.fill as any).toObject ? (obj.fill as any).toObject() : undefined;
    const strokeIsString = typeof obj.stroke === 'string';

    const baseWidth = obj.width ?? 0;
    const baseHeight = obj.height ?? 0;
    const scaleX = obj.scaleX ?? 1;
    const scaleY = obj.scaleY ?? 1;
    const finalWidth = baseWidth * Math.abs(scaleX);
    const finalHeight = baseHeight * Math.abs(scaleY);

    const selectable = (obj as any).selectable;
    const locked =
        selectable === false ||
        (obj as any).evented === false ||
        (obj as any).lockScalingX ||
        (obj as any).lockScalingY ||
        (obj as any).lockRotation;

    const common: Omit<SvgObject, 'type'> & { type: any } = {
        id: nanoid(),
        name: (obj as any).name,
        x: cx,
        y: cy,
        rotation: obj.angle ?? 0,
        scaleX: 1, // Reset scale after baking
        scaleY: 1, // Reset scale after baking
        fill: (fillIsString ? (obj.fill as string) : 'transparent') || 'transparent',
        stroke: (strokeIsString ? (obj.stroke as string) : 'transparent') || 'transparent',
        strokeWidth: obj.strokeWidth ?? 1,
        layerId,
        anchorPosition: 'center',
        visible: obj.visible ?? true,
        locked,
        ...(obj.opacity != null ? { opacity: obj.opacity } : {}),
        ...(obj.strokeDashArray ? { strokeDashArray: obj.strokeDashArray as any } : {}),
        ...(strAttr(el, 'stroke-linecap') ? { strokeLineCap: strAttr(el, 'stroke-linecap') as any } :
            obj.strokeLineCap ? { strokeLineCap: obj.strokeLineCap } : {}),
        ...(strAttr(el, 'stroke-linejoin') ? { strokeLineJoin: strAttr(el, 'stroke-linejoin') as any } :
            obj.strokeLineJoin ? { strokeLineJoin: obj.strokeLineJoin } : {}),
        ...(numAttr(el, 'stroke-miterlimit') != null ? { strokeMiterLimit: numAttr(el, 'stroke-miterlimit') } :
            obj.strokeMiterLimit ? { strokeMiterLimit: obj.strokeMiterLimit } : {}),
        ...(fillGradient ? { fillGradient } : {}),
        ...(raw ? ({ raw } as any) : {}),
    };

    if (obj instanceof fabric.Rect) {
        const rect = obj as fabric.Rect;
        const rxAttr = numAttr(el, 'rx') ?? (rect.rx as number | undefined) ?? 0;
        const ryAttr = numAttr(el, 'ry') ?? (rect.ry as number | undefined) ?? rxAttr;

        const maxR = Math.min(finalWidth, finalHeight) / 2;
        const effRx = Math.min(rxAttr, maxR);
        const effRy = Math.min(ryAttr, maxR);

        const base: RectangleObject = {
            ...common,
            type: 'rectangle',
            width: finalWidth,
            height: finalHeight,
            ...(effRx > 0 ? { rx: effRx } : {}),
            ...(effRy > 0 ? { ry: effRy } : {}),
            ...(effRx > 0 || effRy > 0
                ? {
                    corners: { tl: effRx, tr: effRx, br: effRx, bl: effRx },
                    cornersLinked: true,
                }
                : {}),
        };
        return base;
    }
    if (obj instanceof fabric.Circle) {
        const circle = obj as fabric.Circle;
        const radiusX = (circle.radius ?? 0) * Math.abs(scaleX);
        const radiusY = (circle.radius ?? 0) * Math.abs(scaleY);
        return {
            ...common,
            type: 'ellipse',
            rx: radiusX,
            ry: radiusY,
        } as EllipseObject;
    }
    if (obj instanceof fabric.Ellipse) {
        const ellipse = obj as fabric.Ellipse;
        return {
            ...common,
            type: 'ellipse',
            rx: (ellipse.rx ?? 0) * Math.abs(scaleX),
            ry: (ellipse.ry ?? 0) * Math.abs(scaleY),
        } as EllipseObject;
    }
    if (obj instanceof fabric.Line) {
        const line = obj as fabric.Line;
        const p1 = { x: line.x1!, y: line.y1! };
        const p2 = { x: line.x2!, y: line.y2! };
        const points = [
            { x: p1.x, y: p1.y, mode: 'corner' as const },
            { x: p2.x, y: p2.y, mode: 'corner' as const },
        ];
        const localPoints = toLocalPoints(points, cx, cy);
        const tempPath = {
            ...common,
            type: 'path',
            points: localPoints,
            closed: false,
            isLine: true,
        } as PathObject;
        return normalizePath(tempPath);
    }
    if (obj instanceof fabric.Path) {
        const fabricPath = obj as fabric.Path;

        let currentPos = { x: 0, y: 0 };
        const points: BezierPoint[] = [];

        for (const cmd of (fabricPath.path || [])) {
            const type = cmd[0].toUpperCase();
            const coords = cmd.slice(1).map(Number);
            let lastPoint = points[points.length - 1];

            switch (type) {
                case 'M': // MoveTo
                    currentPos = { x: coords[0], y: coords[1] };
                    points.push({ x: currentPos.x, y: currentPos.y, mode: 'corner' });
                    break;
                case 'L': // LineTo
                    currentPos = { x: coords[0], y: coords[1] };
                    points.push({ x: currentPos.x, y: currentPos.y, mode: 'corner' });
                    break;
                case 'C': // Cubic Bezier
                    if (lastPoint) {
                        lastPoint.handleOut = { x: coords[0], y: coords[1] };
                        lastPoint.mode = 'free';
                    }
                    currentPos = { x: coords[4], y: coords[5] };
                    points.push({ x: currentPos.x, y: currentPos.y, mode: 'free', handleIn: { x: coords[2], y: coords[3] } });
                    break;
                case 'Q': // Quadratic Bezier
                    if (lastPoint) {
                        const qp0 = currentPos;
                        const qp1 = { x: coords[0], y: coords[1] };
                        const qp2 = { x: coords[2], y: coords[3] };

                        const cp1 = { x: qp0.x + 2 / 3 * (qp1.x - qp0.x), y: qp0.y + 2 / 3 * (qp1.y - qp0.y) };
                        const cp2 = { x: qp2.x + 2 / 3 * (qp1.x - qp2.x), y: qp2.y + 2 / 3 * (qp1.y - qp2.y) };

                        lastPoint.handleOut = cp1;
                        lastPoint.mode = 'free';

                        currentPos = qp2;
                        points.push({ x: currentPos.x, y: currentPos.y, mode: 'free', handleIn: cp2 });
                    }
                    break;
                case 'Z': break;
            }
        }

        const closed = !!(el?.getAttribute?.('d')?.match(/[Zz]\s*$/));
        const localPoints = toLocalPoints(points, cx, cy);

        const tempPath = {
            ...common,
            type: 'path',
            points: localPoints,
            closed,
            isLine: false,
            width: finalWidth,
            height: finalHeight,
        } as PathObject;
        return normalizePath(tempPath);
    }
    if (obj instanceof fabric.IText || obj instanceof fabric.Textbox || obj instanceof fabric.FabricText) {
        const fabricText = obj as fabric.IText;
        return {
            ...common,
            type: 'text',
            text: fabricText.text ?? '',
            fontSize: (fabricText.fontSize ?? 16) * Math.min(Math.abs(scaleX), Math.abs(scaleY)),
            fontWeight: (fabricText.fontWeight as any) ?? 'normal',
            ...(fabricText.fontFamily ? { fontFamily: fabricText.fontFamily } : {}),
            ...(fabricText.fontStyle ? { fontStyle: fabricText.fontStyle } : {}),
            ...(fabricText.textAlign ? { textAlign: fabricText.textAlign } : {}),
            ...(fabricText.lineHeight ? { lineHeight: fabricText.lineHeight } : {}),
            ...(fabricText.charSpacing ? { charSpacing: fabricText.charSpacing } : {}),
        } as TextObject;
    }
    if (obj instanceof fabric.Group) {
        const group = obj as fabric.Group;
        const allDescendants: SvgObject[] = [];

        const directChildren = (group.getObjects() || []).flatMap(child => {
            const childResult = fabricToSvgObject(child, layerId);
            if (!childResult) return [];

            const childSvgObjects = Array.isArray(childResult) ? childResult : [childResult];
            allDescendants.push(...childSvgObjects);

            return childSvgObjects.filter(c => !c.parentId);
        });

        const groupObj: GroupObject = {
            ...common,
            type: 'group',
            children: directChildren.map(c => c.id),
            collapsed: false,
        };

        allDescendants.forEach(descendant => {
            if (directChildren.some(c => c.id === descendant.id)) {
                descendant.parentId = groupObj.id;
            }
        });

        return [groupObj, ...allDescendants.filter(d => !directChildren.some(c => c.id === d.id))];
    }

    console.warn('Unsupported Fabric object:', obj);
    return null;
}

export const importSvgString = async (svgString: string): Promise<SvgObject[]> => {
    const { objects, elements } = await fabric.loadSVGFromString(svgString);
    if (!objects || objects.length === 0) {
        return [];
    }

    const layerId = 'imported-layer';

    const allImportedObjects = objects.flatMap((obj, idx) => {
        const el = Array.isArray(elements) ? (elements[idx] as any) : undefined;
        const result = fabricToSvgObject(obj, layerId, el);
        return result ? (Array.isArray(result) ? result : [result]) : [];
    });

    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    const svgId = doc.documentElement?.getAttribute('id') || 'Imported SVG';

    const topLevelObjects = allImportedObjects.filter(obj => !obj.parentId);

    if (topLevelObjects.length > 1) {
        const groupBBox = topLevelObjects.reduce((acc, obj) => {
            const x = obj.x;
            const y = obj.y;
            const w = (obj as any).width ?? ((obj as any).rx ? (obj as any).rx * 2 : 0);
            const h = (obj as any).height ?? ((obj as any).ry ? (obj as any).ry * 2 : 0);

            if (acc.minX === null || x - w / 2 < acc.minX) acc.minX = x - w / 2;
            if (acc.minY === null || y - h / 2 < acc.minY) acc.minY = y - h / 2;
            if (acc.maxX === null || x + w / 2 > acc.maxX) acc.maxX = x + w / 2;
            if (acc.maxY === null || y + h / 2 > acc.maxY) acc.maxY = y + h / 2;
            return acc;
        }, { minX: null as number | null, minY: null as number | null, maxX: null as number | null, maxY: null as number | null });

        const finalBBox = {
            minX: groupBBox.minX ?? 0,
            minY: groupBBox.minY ?? 0,
            maxX: groupBBox.maxX ?? 0,
            maxY: groupBBox.maxY ?? 0
        };

        const group: GroupObject = {
            id: nanoid(),
            type: 'group',
            name: svgId,
            x: finalBBox.minX + (finalBBox.maxX - finalBBox.minX) / 2,
            y: finalBBox.minY + (finalBBox.maxY - finalBBox.minY) / 2,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            children: topLevelObjects.map(obj => obj.id),
            layerId,
            anchorPosition: 'center',
            visible: true,
            locked: false,
            fill: '', stroke: '', strokeWidth: 0,
            collapsed: false,
            parentId: undefined,
        };

        topLevelObjects.forEach(obj => {
            const objIndex = allImportedObjects.findIndex(o => o.id === obj.id);
            if (objIndex !== -1) {
                allImportedObjects[objIndex].x -= group.x;
                allImportedObjects[objIndex].y -= group.y;
                allImportedObjects[objIndex].parentId = group.id;
            }
        });

        allImportedObjects.push(group);
    }

    return allImportedObjects;
};

