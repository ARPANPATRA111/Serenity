import type { fabric } from 'fabric';

/**
 * Scale for a new picture of `width` x `height` so it fits inside the box the
 * old picture occupied on the certificate, keeping its own aspect ratio.
 */
export function fitScale(box: { width: number; height: number }, width: number, height: number): number {
  if (width <= 0 || height <= 0 || box.width <= 0 || box.height <= 0) return 1;
  return Math.min(box.width / width, box.height / height);
}

/**
 * Swaps the picture inside an ordinary image object. The object itself stays
 * (same layer, rotation, opacity, effects, lock state, and centre), so nearby
 * text does not move; the new picture fits inside the old one's box. The
 * change is recorded as one undoable step.
 */
export function replaceImageSource(canvas: fabric.Canvas, image: fabric.Image, source: string): Promise<void> {
  const box = {
    width: (image.width || 0) * Math.abs(image.scaleX || 1),
    height: (image.height || 0) * Math.abs(image.scaleY || 1),
  };
  const centre = image.getCenterPoint();
  return new Promise((resolve, reject) => {
    image.setSrc(source, (loaded: fabric.Image | null) => {
      const element = (loaded ?? image).getElement() as HTMLImageElement | undefined;
      if (!element || !(element.naturalWidth || element.width)) {
        reject(new Error('The image could not be read.'));
        return;
      }
      const scale = fitScale(box, image.width || 0, image.height || 0);
      image.set({ scaleX: scale * Math.sign(image.scaleX || 1), scaleY: scale * Math.sign(image.scaleY || 1), cropX: 0, cropY: 0 });
      if (image.filters?.length) image.applyFilters();
      image.setPositionByOrigin(centre, 'center', 'center');
      image.setCoords();
      canvas.requestRenderAll();
      canvas.fire('object:modified', { target: image });
      resolve();
    }, { crossOrigin: 'anonymous' });
  });
}
