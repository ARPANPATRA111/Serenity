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

export function installAlignmentGuides(
  canvas: fabric.Canvas,
  dimensions: { width: number; height: number },
) {
  let verticalGuides: number[] = [];
  let horizontalGuides: number[] = [];

  const clearGuides = () => {
    verticalGuides = [];
    horizontalGuides = [];
    const contextTop = (canvas as fabric.Canvas & { contextTop: CanvasRenderingContext2D }).contextTop;
    canvas.clearContext(contextTop);
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

    for (const object of canvas.getObjects()) {
      if (object === target || isHelper(object)) continue;
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
    const context = (canvas as fabric.Canvas & { contextTop: CanvasRenderingContext2D }).contextTop;
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
  };

  canvas.on('object:moving', onObjectMoving);
  canvas.on('after:render', drawGuides);
  canvas.on('mouse:up', clearGuides);
  canvas.on('selection:cleared', clearGuides);

  return () => {
    canvas.off('object:moving', onObjectMoving);
    canvas.off('after:render', drawGuides);
    canvas.off('mouse:up', clearGuides);
    canvas.off('selection:cleared', clearGuides);
    clearGuides();
  };
}
