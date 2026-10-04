import { fabric } from 'fabric';

let applied = false;

/**
 * Fabric 5.3 assigns `ctx.textBaseline = 'alphabetical'` (not a valid
 * CanvasTextBaseline) before every text draw and measurement. Browsers ignore
 * the assignment, keep the default 'alphabetic', and log a warning each time
 * (about a thousand per editor session). Assigning the valid value renders
 * identically without the warnings.
 */
export function applyFabricPatches(): void {
  if (applied) return;
  applied = true;

  const textPrototype = fabric.Text.prototype as unknown as {
    path?: unknown;
    pathAlign?: string;
    _getFontDeclaration: (charStyle?: unknown, forMeasuring?: boolean) => string;
    _setTextStyles: (ctx: CanvasRenderingContext2D, charStyle?: unknown, forMeasuring?: boolean) => void;
  };

  textPrototype._setTextStyles = function setTextStyles(ctx, charStyle, forMeasuring) {
    ctx.textBaseline = 'alphabetic';
    if (this.path) {
      switch (this.pathAlign) {
        case 'center':
          ctx.textBaseline = 'middle';
          break;
        case 'ascender':
          ctx.textBaseline = 'top';
          break;
        case 'descender':
          ctx.textBaseline = 'bottom';
          break;
      }
    }
    ctx.font = this._getFontDeclaration(charStyle, forMeasuring);
  };
}
