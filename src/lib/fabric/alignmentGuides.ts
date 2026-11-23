import { fabric } from 'fabric';
import { findNearestSnap, type SnapCandidate } from './alignmentGeometry';

function isHelper(object: fabric.Object) {
  const helper = object as fabric.Object & {
    isBoundary?: boolean;
    isOuterShade?: boolean;
    isInnerClear?: boolean;
  };
  return helper.isBoundary || helper.isOuterShade || helper.isInnerClear || object.visible === false;
}

type GuideCanvas = fabric.Canvas & { contextTop: CanvasRenderingContext2D; contextTopDirty?: boolean };

/**
 * Snap guides for dragging. The guides are drawn on Fabric's upper canvas
 * after each render. Fabric clears that layer at the start of a render only
 * when `contextTopDirty` is set; without it, every frame's guide stayed on
 * screen and a drag left a trail of repeated lines. Each drawing therefore
 * marks the layer dirty, so the next frame starts clean and at most one guide
 * per axis is ever visible. Guides never reach exports, which render the
 * lower canvas only.
 */
export function installAlignmentGuides(
  canvas: fabric.Canvas,
  dimensions: { width: number; height: number },
) {
  let verticalGuides: number[] = [];
  let horizontalGuides: number[] = [];

  const guideCanvas = canvas as GuideCanvas;

  const clearGuides = () => {
    const hadGuides = verticalGuides.length > 0 || horizontalGuides.length > 0;
    verticalGuides = [];
    horizontalGuides = [];
    if (guideCanvas.contextTop) canvas.clearContext(guideCanvas.contextTop);
    guideCanvas.contextTopDirty = false;
    if (hadGuides) canvas.requestRenderAll();
  };

  const onObjectMoving = (event: fabric.IEvent<Event>) => {
    const target = event.target;
    if (!target) return;

    const zoom = canvas.getZoom() || 1;
    const sourceEvent = event.e as Event & { touches?: unknown[]; pointerType?: string };
    const touchInput = sourceEvent?.pointerType === 'touch' || !!sourceEvent?.touches;
    const threshold = (touchInput ? 8 : 5) / zoom;
    const movingBounds = target.getBoundingRect(true, true);
    const movingX = [movingBounds.left, movingBounds.left + movingBounds.width / 2, movingBounds.left + movingBounds.width];
    const movingY = [movingBounds.top, movingBounds.top + movingBounds.height / 2, movingBounds.top + movingBounds.height];

    const xCandidates: SnapCandidate[] = [
      { value: 0, guide: 0 },
      { value: dimensions.width / 2, guide: dimensions.width / 2 },
      { value: dimensions.width, guide: dimensions.width },
    ];
    const yCandidates: SnapCandidate[] = [
      { value: 0, guide: 0 },
      { value: dimensions.height / 2, guide: dimensions.height / 2 },
      { value: dimensions.height, guide: dimensions.height },
    ];

    // Members of a dragged multi-selection move with it; aligning to them
    // would snap the selection to itself.
    const movingMembers = new Set<fabric.Object>(
      target.type === 'activeSelection' ? (target as fabric.ActiveSelection).getObjects() : [],
    );
    for (const object of canvas.getObjects()) {
      if (object === target || movingMembers.has(object) || isHelper(object)) continue;
      const bounds = object.getBoundingRect(true, true);
      [bounds.left, bounds.left + bounds.width / 2, bounds.left + bounds.width]
        .forEach((value) => xCandidates.push({ value, guide: value }));
      [bounds.top, bounds.top + bounds.height / 2, bounds.top + bounds.height]
        .forEach((value) => yCandidates.push({ value, guide: value }));
    }

    const xSnap = movingX
      .map((value) => findNearestSnap(value, xCandidates, threshold))
      .filter(Boolean)
      .sort((a, b) => Math.abs(a!.delta) - Math.abs(b!.delta))[0];
    const ySnap = movingY
      .map((value) => findNearestSnap(value, yCandidates, threshold))
      .filter(Boolean)
      .sort((a, b) => Math.abs(a!.delta) - Math.abs(b!.delta))[0];

    verticalGuides = xSnap ? [xSnap.guide] : [];
    horizontalGuides = ySnap ? [ySnap.guide] : [];

    if (xSnap || ySnap) {
      target.set({
        left: (target.left || 0) + (xSnap?.delta || 0),
        top: (target.top || 0) + (ySnap?.delta || 0),
      });
      target.setCoords();
    }
  };

  const drawGuides = () => {
    if (verticalGuides.length === 0 && horizontalGuides.length === 0) return;
    const context = guideCanvas.contextTop;
    if (!context) return;
    const viewport = canvas.viewportTransform || fabric.iMatrix.concat();
    context.save();
    context.transform(viewport[0], viewport[1], viewport[2], viewport[3], viewport[4], viewport[5]);
    context.strokeStyle = '#6366f1';
    context.lineWidth = 1 / (canvas.getZoom() || 1);
    context.setLineDash([4 / (canvas.getZoom() || 1), 3 / (canvas.getZoom() || 1)]);
    for (const x of verticalGuides) {
      context.beginPath(); context.moveTo(x, 0); context.lineTo(x, dimensions.height); context.stroke();
    }
    for (const y of horizontalGuides) {
      context.beginPath(); context.moveTo(0, y); context.lineTo(dimensions.width, y); context.stroke();
    }
    context.restore();
    // Fabric clears the upper canvas before the next render.
    guideCanvas.contextTopDirty = true;
  };

  // A drag ends on mouse/touch release; the other events cover a drag that
  // ends some other way (template switch, undo, preview, selection change).
  const endEvents = ['mouse:up', 'mouse:down', 'selection:cleared', 'selection:updated', 'object:modified', 'canvas:cleared'] as const;
  canvas.on('object:moving', onObjectMoving);
  canvas.on('after:render', drawGuides);
  endEvents.forEach((name) => canvas.on(name, clearGuides));

  return () => {
    canvas.off('object:moving', onObjectMoving);
    canvas.off('after:render', drawGuides);
    endEvents.forEach((name) => canvas.off(name, clearGuides));
    clearGuides();
  };
}
