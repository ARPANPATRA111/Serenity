export interface TemplateInvariantResult {
  valid: boolean;
  errors: string[];
}

interface SerializedFabricObject {
  type?: string;
  text?: string;
  left?: number;
  top?: number;
  visible?: boolean;
  editable?: boolean;
  isVerificationUrl?: boolean;
  isLocked?: boolean;
  verificationId?: string;
}

interface SerializedCanvas {
  objects?: SerializedFabricObject[];
}

export function validateTemplateInvariants(
  template: string | SerializedCanvas | null | undefined,
  dimensions = { width: 842, height: 595 },
): TemplateInvariantResult {
  const errors: string[] = [];
  let canvas: SerializedCanvas;

  try {
    canvas = typeof template === 'string' ? JSON.parse(template) : (template || {});
  } catch {
    return { valid: false, errors: ['Template JSON is invalid.'] };
  }

  const objects = Array.isArray(canvas.objects) ? canvas.objects : [];
  const verificationObjects = objects.filter((object) => object.isVerificationUrl === true);
  const qrObjects = objects.filter((object) => typeof object.verificationId === 'string');

  if (verificationObjects.length !== 1) {
    errors.push('The template must contain exactly one verification URL.');
  }

  const verificationObject = verificationObjects[0];
  if (verificationObject) {
    if (verificationObject.text !== '{{VERIFICATION_URL}}') {
      errors.push('The verification URL text cannot be changed.');
    }
    if (verificationObject.visible === false) {
      errors.push('The verification URL must remain visible.');
    }
    if (verificationObject.editable !== false || verificationObject.isLocked !== true) {
      errors.push('The verification URL must remain protected from editing and deletion.');
    }
    if (
      typeof verificationObject.left !== 'number' ||
      typeof verificationObject.top !== 'number' ||
      verificationObject.left < 0 || verificationObject.left > dimensions.width ||
      verificationObject.top < 0 || verificationObject.top > dimensions.height
    ) {
      errors.push('The verification URL must stay within the printable canvas.');
    }
  }

  if (qrObjects.length > 1) {
    errors.push('The template can contain at most one verification QR code.');
  }

  return { valid: errors.length === 0, errors };
}
