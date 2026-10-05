import { fabric } from 'fabric';
import type { EditorChromeCanvas } from './exportQuality';
import { applyFabricPatches } from './patches';
import { isEditorChromeStroke, NO_TEXT_STROKE } from './templateNormalization';

// Custom property names to include in serialization
const CUSTOM_PROPERTIES = ['dynamicKey', 'isPlaceholder'];

const CHROME_COLOR = '#001eff';
const CHROME_PADDING = 5;

export function registerVariableTextbox(): void {
  applyFabricPatches();
  if ((fabric as unknown as Record<string, unknown>).VariableTextbox) {
    // Already registered
    return;
  }

  // Subclass fabric.Textbox
  const VariableTextbox = fabric.util.createClass(fabric.Textbox, {
    type: 'variableTextbox',

    // Custom properties
    dynamicKey: '',
    isPlaceholder: false,

    initialize: function (text: string, options?: fabric.ITextboxOptions & { dynamicKey?: string; isPlaceholder?: boolean }) {
      // Call parent constructor
      this.callSuper('initialize', text, options);

      // Set custom properties
      this.dynamicKey = options?.dynamicKey || '';
      this.isPlaceholder = options?.isPlaceholder ?? !!this.dynamicKey;
      
      // Fix browser compatibility for textBaseline
      this.textBaseline = 'alphabetic';

      // Earlier releases stored the placeholder marker as a glyph stroke.
      if (isEditorChromeStroke(this)) this.set({ ...NO_TEXT_STROKE });

      // Apply placeholder styling if dynamicKey is set
      if (this.dynamicKey) {
        this._applyPlaceholderStyle();
      }
    },

    // The placeholder marker (dashed frame and name badge) is editor chrome
    // drawn in `render`; it is never part of the text, so it never prints.
    _applyPlaceholderStyle: function () {
      if (isEditorChromeStroke(this)) this.set({ ...NO_TEXT_STROKE });
      this.set({ padding: CHROME_PADDING });
    },

    _removePlaceholderStyle: function () {
      if (isEditorChromeStroke(this)) this.set({ ...NO_TEXT_STROKE });
      this.set({ padding: 0 });
    },

    setDynamicKey: function (key: string) {
      this.dynamicKey = key;
      this.isPlaceholder = !!key;

      if (key) {
        this._applyPlaceholderStyle();
        // Set placeholder text
        this.set('text', `{{${key}}}`);
      } else {
        this._removePlaceholderStyle();
      }

      this.canvas?.requestRenderAll();
    },

    clearDynamicKey: function () {
      this.setDynamicKey('');
    },

    toObject: function (propertiesToInclude?: string[]) {
      return this.callSuper('toObject', [
        ...CUSTOM_PROPERTIES,
        ...(propertiesToInclude || []),
      ]);
    },

    render: function (ctx: CanvasRenderingContext2D) {
      this.callSuper('render', ctx);
      const canvas = this.canvas as (fabric.StaticCanvas & EditorChromeCanvas) | undefined;
      if (!this.isPlaceholder || !this.dynamicKey || !canvas || canvas.hideEditorChrome || this.isNotVisible()) return;

      // Drawn on the canvas context, outside the object cache, so the badge
      // above the box is never clipped.
      ctx.save();
      this.transform(ctx);
      const width = this.width || 0;
      const height = this.height || 0;
      const scale = Math.max(Math.abs(this.scaleX || 1), Math.abs(this.scaleY || 1)) * (canvas.getZoom?.() || 1);

      // Dashed frame around the field
      ctx.strokeStyle = CHROME_COLOR;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1 / scale;
      ctx.setLineDash([4 / scale, 3 / scale]);
      ctx.strokeRect(-width / 2 - CHROME_PADDING, -height / 2 - CHROME_PADDING, width + CHROME_PADDING * 2, height + CHROME_PADDING * 2);
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Name badge (top-right corner)
      const badgeText = this.dynamicKey;
      ctx.font = '10px sans-serif';
      const textMetrics = ctx.measureText(badgeText);
      const badgeWidth = textMetrics.width + 8;
      const badgeHeight = 16;
      const badgeX = width / 2 - badgeWidth + 4;
      const badgeY = -height / 2 - badgeHeight - 4;

      ctx.fillStyle = CHROME_COLOR;
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 4);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.fillText(badgeText, badgeX + 4, badgeY + 12);

      ctx.restore();
    },
  });

  // Static method to create from object (for deserialization)
  VariableTextbox.fromObject = function (
    object: Record<string, unknown>,
    callback: (obj: fabric.Object) => void
  ) {
    // Create instance
    fabric.Object._fromObject(
      'VariableTextbox',
      object as unknown as fabric.Object,
      callback,
      'text'
    );
  };

  // Register with Fabric.js
  (fabric as unknown as Record<string, unknown>).VariableTextbox = VariableTextbox;
}

export function createVariableTextbox(
  text: string,
  options?: fabric.ITextboxOptions & { dynamicKey?: string; isPlaceholder?: boolean }
): fabric.Textbox & { dynamicKey: string; isPlaceholder: boolean; setDynamicKey: (key: string) => void; clearDynamicKey: () => void } {
  // Ensure class is registered
  registerVariableTextbox();

  // Create instance using the registered class
  const VariableTextboxClass = (fabric as unknown as Record<string, new (text: string, options?: unknown) => fabric.Textbox>).VariableTextbox;
  return new VariableTextboxClass(text, options) as fabric.Textbox & {
    dynamicKey: string;
    isPlaceholder: boolean;
    setDynamicKey: (key: string) => void;
    clearDynamicKey: () => void;
  };
}

export function isVariableTextbox(obj: unknown): obj is fabric.Textbox & { dynamicKey: string; isPlaceholder: boolean } {
  return typeof obj === 'object' && obj !== null && (obj as { type?: string }).type === 'variableTextbox';
}

export function getVariableTextboxes(canvas: fabric.Canvas | fabric.StaticCanvas): Array<fabric.Textbox & { dynamicKey: string }> {
  return canvas.getObjects().filter(isVariableTextbox) as Array<fabric.Textbox & { dynamicKey: string }>;
}

export function updateVariableTextboxes(
  canvas: fabric.Canvas | fabric.StaticCanvas,
  data: Record<string, string | number | boolean | null>
): void {
  const textboxes = getVariableTextboxes(canvas);

  for (const textbox of textboxes) {
    if (textbox.dynamicKey && data[textbox.dynamicKey] !== undefined) {
      const value = data[textbox.dynamicKey];
      textbox.set('text', String(value ?? ''));
    }
  }

  canvas.requestRenderAll();
}
