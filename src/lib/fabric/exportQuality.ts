import type { fabric } from 'fabric';

/**
 * Export-quality helpers shared by the batch generator and editor exports.
 *
 * Fabric caches every object into an offscreen bitmap capped at
 * fabric.perfLimitSizeTotal (about 2 megapixels). Certificates are exported at
 * 4.166x (300 DPI), where a full-page border group needs about 7.7 megapixels
 * and a large circle or seal several more, so the cache was silently
 * downscaled and those shapes printed soft. Rendering once without the cache
 * draws every path at full resolution, and is also faster for a single render.
 */

/**
 * Logical QR width in canvas units at scale 1. The generator has always
 * rendered QR codes as 200px images, so a QR prints at 200 x scale; the editor
 * and generator both use this so the preview matches the printed size.
 */
export const QR_LOGICAL_SIZE = 200;

type Cacheable = fabric.Object & { _objects?: fabric.Object[]; objectCaching?: boolean; dirty?: boolean };

function visit(objects: fabric.Object[], callback: (object: Cacheable) => void) {
  for (const object of objects as Cacheable[]) {
    callback(object);
    if (Array.isArray(object._objects)) visit(object._objects, callback);
    const clipPath = (object as { clipPath?: fabric.Object }).clipPath;
    if (clipPath) visit([clipPath], callback);
  }
}

/** Permanently disables caching; for canvases that only exist to export. */
export function disableObjectCaching(objects: fabric.Object[]): void {
  visit(objects, (object) => {
    object.objectCaching = false;
    object.dirty = true;
  });
}

/** Runs an export on a live canvas with caching off, then restores each object. */
export interface DataURLOptions {
  format: 'png' | 'jpeg';
  quality?: number;
  multiplier?: number;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
}

/**
 * Same output as Fabric's canvas.toDataURL, but frees the full-size export
 * canvas as soon as it is encoded. Fabric allocates a new one per export
 * (35 MB at 300 DPI) and leaves it to garbage collection, which barely runs
 * while the JS heap stays small, so a 200-certificate batch grew the tab by
 * about 2.5 GB. Shrinking the canvas releases its pixel buffer immediately.
 */
export function canvasToDataURL(canvas: fabric.StaticCanvas, options: DataURLOptions): string {
  const multiplier = options.multiplier ?? 1;
  const element = canvas.toCanvasElement(multiplier, {
    left: options.left,
    top: options.top,
    width: options.width,
    height: options.height,
  } as Parameters<fabric.StaticCanvas['toCanvasElement']>[1]);
  try {
    return element.toDataURL(`image/${options.format}`, options.quality ?? 1);
  } finally {
    element.width = 0;
    element.height = 0;
  }
}

/** Set on a canvas while it renders for export or preview: no placeholder chrome. */
export interface EditorChromeCanvas {
  hideEditorChrome?: boolean;
}

/** Runs `render` with the editor's placeholder chrome hidden. */
export function withEditorChromeHidden<T>(canvas: fabric.StaticCanvas, render: () => T): T {
  const target = canvas as fabric.StaticCanvas & EditorChromeCanvas;
  const previous = target.hideEditorChrome;
  target.hideEditorChrome = true;
  try {
    return render();
  } finally {
    target.hideEditorChrome = previous;
  }
}

export function withObjectCachingDisabled<T>(canvas: fabric.StaticCanvas, run: () => T): T {
  const previous: Array<[Cacheable, boolean | undefined]> = [];
  visit(canvas.getObjects(), (object) => {
    previous.push([object, object.objectCaching]);
    object.objectCaching = false;
    object.dirty = true;
  });
  try {
    return run();
  } finally {
    for (const [object, value] of previous) {
      object.objectCaching = value;
      object.dirty = true;
    }
  }
}

interface ExportOptions {
  format: 'png' | 'jpeg';
  quality?: number;
  multiplier: number;
  /** Certificate area in canvas units (A4 landscape by default). */
  width: number;
  height: number;
}

type EditorHelper = fabric.Object & { isBoundary?: boolean; isOuterShade?: boolean };

/**
 * Exports exactly the certificate area of a live editor canvas: the red
 * print-boundary guide is hidden, the user's zoom and pan are ignored, and
 * shapes render without the size-capped cache. Previously template
 * thumbnails (shown in the public gallery) and "Export image" included the
 * dashed guide and captured whatever region the editor was zoomed to.
 */
export function exportCanvasImage(canvas: fabric.StaticCanvas, options: ExportOptions): string {
  const helpers = (canvas.getObjects() as EditorHelper[]).filter((object) => object.isBoundary || object.isOuterShade);
  const visibility = helpers.map((object) => object.visible);
  const previousViewport = canvas.viewportTransform ? [...canvas.viewportTransform] : null;

  helpers.forEach((object) => { object.visible = false; });
  canvas.viewportTransform = [1, 0, 0, 1, 0, 0];
  try {
    return withEditorChromeHidden(canvas, () => withObjectCachingDisabled(canvas, () => canvasToDataURL(canvas, {
      format: options.format,
      quality: options.quality ?? 1,
      multiplier: options.multiplier,
      left: 0,
      top: 0,
      width: options.width,
      height: options.height,
    })));
  } finally {
    helpers.forEach((object, index) => { object.visible = visibility[index]; });
    if (previousViewport) canvas.setViewportTransform(previousViewport);
    canvas.requestRenderAll();
  }
}

/**
 * Pixel size for a regenerated QR image so it is drawn at (or above) the
 * export resolution instead of being upscaled from 200px.
 */
export function qrPixelSize(displayWidth: number, multiplier: number): number {
  const target = Math.ceil(Math.abs(displayWidth) * multiplier);
  return Math.min(2048, Math.max(QR_LOGICAL_SIZE, target));
}
