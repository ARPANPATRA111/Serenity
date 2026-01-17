import { fabric } from 'fabric';

// Custom property names to include in serialization
const CUSTOM_PROPERTIES = ['dynamicKey', 'isPlaceholder'];

export function registerVariableTextbox(): void {
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

      // Apply placeholder styling if dynamicKey is set
      if (this.dynamicKey) {
        this._applyPlaceholderStyle();
      }
    },

    _applyPlaceholderStyle: function () {
      this.set({
        strokeWidth: 2,
        stroke: '#001eff', // Primary color
        strokeDashArray: [5, 5],
        padding: 5,
      });
    },

    _removePlaceholderStyle: function () {
      this.set({
        strokeWidth: 0,
        stroke: undefined,
        strokeDashArray: undefined,
        padding: 0,
      });
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

    _render: function (ctx: CanvasRenderingContext2D) {
      this.callSuper('_render', ctx);

      // Draw dynamic indicator badge if this is a placeholder
      if (this.isPlaceholder && this.dynamicKey) {
        ctx.save();

        // Calculate badge position (top-right corner)
        const width = this.width || 0;
        const height = this.height || 0;

        // Badge background
        const badgeText = this.dynamicKey;
        ctx.font = '10px sans-serif';
        const textMetrics = ctx.measureText(badgeText);
        const badgeWidth = textMetrics.width + 8;
        const badgeHeight = 16;
        const badgeX = width / 2 - badgeWidth + 4;
        const badgeY = -height / 2 - badgeHeight - 4;

        // Draw badge
        ctx.fillStyle = '#001eff';
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 4);
        ctx.fill();

        // Draw badge text
        ctx.fillStyle = '#ffffff';
        ctx.fillText(badgeText, badgeX + 4, badgeY + 12);

        ctx.restore();
      }
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
