// Popular Google Fonts for certificates
export const GOOGLE_FONTS = [
  { name: 'Roboto', weights: [400, 500, 700] },
  { name: 'Open Sans', weights: [400, 600, 700] },
  { name: 'Lato', weights: [400, 700] },
  { name: 'Montserrat', weights: [400, 500, 600, 700] },
  { name: 'Poppins', weights: [400, 500, 600, 700] },
  { name: 'Raleway', weights: [400, 500, 600, 700] },
  { name: 'Oswald', weights: [400, 500, 600, 700] },
  { name: 'Source Sans Pro', weights: [400, 600, 700] },
  { name: 'Nunito', weights: [400, 600, 700] },
  { name: 'Ubuntu', weights: [400, 500, 700] },
  { name: 'Quicksand', weights: [400, 500, 600, 700] },
  { name: 'Rubik', weights: [400, 500, 600, 700] },
  { name: 'Work Sans', weights: [400, 500, 600, 700] },
  { name: 'Josefin Sans', weights: [400, 600, 700] },
  { name: 'Inter', weights: [400, 500, 600, 700] },
  { name: 'DM Sans', weights: [400, 500, 700] },
  { name: 'Outfit', weights: [400, 500, 600, 700] },
  { name: 'Manrope', weights: [400, 500, 600, 700] },
  
  { name: 'Playfair Display', weights: [400, 500, 600, 700] },
  { name: 'Merriweather', weights: [400, 700] },
  { name: 'Libre Baskerville', weights: [400, 700] },
  { name: 'PT Serif', weights: [400, 700] },
  { name: 'Cinzel', weights: [400, 500, 600, 700] },
  { name: 'EB Garamond', weights: [400, 500, 600, 700] },
  { name: 'Cormorant Garamond', weights: [400, 500, 600, 700] },
  { name: 'Crimson Text', weights: [400, 600, 700] },
  { name: 'Lora', weights: [400, 500, 600, 700] },
  { name: 'Spectral', weights: [400, 500, 600, 700] },
  { name: 'Bitter', weights: [400, 500, 600, 700] },
  { name: 'Noto Serif', weights: [400, 700] },
  { name: 'Sorts Mill Goudy', weights: [400] },
  
  { name: 'Cinzel Decorative', weights: [400, 700] },
  { name: 'Abril Fatface', weights: [400] },
  { name: 'Cormorant', weights: [400, 500, 600, 700] },
  { name: 'Philosopher', weights: [400, 700] },
  { name: 'Vollkorn', weights: [400, 500, 600, 700] },
  { name: 'Old Standard TT', weights: [400, 700] },
  { name: 'Cardo', weights: [400, 700] },
  
  { name: 'Dancing Script', weights: [400, 500, 600, 700] },
  { name: 'Great Vibes', weights: [400] },
  { name: 'Pacifico', weights: [400] },
  { name: 'Satisfy', weights: [400] },
  { name: 'Amatic SC', weights: [400, 700] },
  { name: 'Alex Brush', weights: [400] },
  { name: 'Allura', weights: [400] },
  { name: 'Tangerine', weights: [400, 700] },
  { name: 'Sacramento', weights: [400] },
  { name: 'Pinyon Script', weights: [400] },
  { name: 'Marck Script', weights: [400] },
  { name: 'Kaushan Script', weights: [400] },
  { name: 'Lobster', weights: [400] },
  { name: 'Caveat', weights: [400, 500, 600, 700] },
  { name: 'Cookie', weights: [400] },
  { name: 'Courgette', weights: [400] },
  
  { name: 'Fira Code', weights: [400, 500, 600, 700] },
  { name: 'JetBrains Mono', weights: [400, 500, 600, 700] },
  { name: 'Source Code Pro', weights: [400, 500, 600, 700] },
];

// Track loaded font weights ("Montserrat:700")
const loadedFonts = new Set<string>();
const loadingFonts = new Map<string, Promise<void>>();

/**
 * Maps requested weights to ones the family actually has (Google Fonts
 * rejects the whole request for a weight it does not serve), sorted as the
 * css2 API requires.
 */
export function servedWeights(fontName: string, weights: number[]): number[] {
  const available = GOOGLE_FONTS.find((font) => font.name === fontName)?.weights;
  const nearest = (weight: number) => available
    ? available.reduce((best, candidate) => (Math.abs(candidate - weight) < Math.abs(best - weight) ? candidate : best), available[0])
    : weight;
  return Array.from(new Set(weights.map(nearest))).sort((a, b) => a - b);
}

/** CSS font-weight value of a Fabric object ("bold", "600", 600) as a number. */
export function numericFontWeight(value: unknown): number {
  if (value === 'bold') return 700;
  const weight = Number.parseInt(String(value), 10);
  return Number.isFinite(weight) ? weight : 400;
}

export async function loadGoogleFont(fontName: string, weights: number[] = [400, 700]): Promise<void> {
  const missing = servedWeights(fontName, weights).filter((weight) => !loadedFonts.has(`${fontName}:${weight}`));
  if (missing.length === 0) return;

  const requestKey = `${fontName}:${missing.join(';')}`;
  const existingPromise = loadingFonts.get(requestKey);
  if (existingPromise) return existingPromise;

  const fontUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@${missing.join(';')}&display=swap`;
  const markLoaded = () => missing.forEach((weight) => loadedFonts.add(`${fontName}:${weight}`));
  const waitForFaces = () => Promise.all(missing.map((weight) => document.fonts?.load(`${weight} 16px "${fontName}"`)));

  // The same stylesheet may already be on the page (e.g. added by the generator)
  if (document.querySelector(`link[href="${fontUrl}"]`)) {
    await waitForFaces();
    markLoaded();
    return;
  }

  // Create link element
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = fontUrl;

  // Wait for font to load
  const promise = new Promise<void>((resolve, reject) => {
    link.onload = async () => {
      try {
        await waitForFaces();
        markLoaded();
        resolve();
      } catch (error) {
        reject(error);
      }
    };
    link.onerror = () => {
      reject(new Error(`Failed to load font: ${fontName}`));
    };
    document.head.appendChild(link);
  });
  loadingFonts.set(requestKey, promise);
  return promise.finally(() => loadingFonts.delete(requestKey));
}

export async function loadFontsForTemplate(template: string | object): Promise<void> {
  let data: any;
  try {
    data = typeof template === 'string' ? JSON.parse(template) : template;
  } catch {
    return;
  }

  const requested = new Map<string, Set<number>>();
  for (const object of Array.isArray(data?.objects) ? data.objects : []) {
    const family = typeof object?.fontFamily === 'string' ? object.fontFamily : '';
    if (!isGoogleFont(family)) continue;
    const weights = requested.get(family) || new Set<number>();
    weights.add(numericFontWeight(object.fontWeight));
    requested.set(family, weights);
  }

  await Promise.all(Array.from(requested, ([family, weights]) => loadGoogleFont(family, Array.from(weights))));
  await document.fonts?.ready;
}

/**
 * Loads a template's fonts but waits at most `timeoutMs`, so a slow or
 * blocked font service never stalls the editor. Returns true when the fonts
 * were ready in time; otherwise `onLateLoad` runs once they do arrive, so the
 * caller can re-measure text.
 */
export async function waitForTemplateFonts(
  template: string | object,
  timeoutMs: number,
  onLateLoad?: () => void
): Promise<boolean> {
  const loaded = loadFontsForTemplate(template).then(() => true, () => false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<boolean>((resolve) => { timer = setTimeout(() => resolve(false), timeoutMs); });
  const ready = await Promise.race([loaded, timedOut]);
  clearTimeout(timer);
  if (!ready && onLateLoad) void loaded.then((arrived) => { if (arrived) onLateLoad(); });
  return ready;
}

export async function loadAllGoogleFonts(): Promise<void> {
  const fontPromises = GOOGLE_FONTS.map((font) => 
    loadGoogleFont(font.name, font.weights)
  );

  await Promise.allSettled(fontPromises);
}

export function getAllFonts(): string[] {
  const systemFonts = [
    'Arial',
    'Helvetica',
    'Times New Roman',
    'Georgia',
    'Verdana',
    'Tahoma',
    'Trebuchet MS',
    'Segoe UI',
    'Palatino',
    'Garamond',
    'Book Antiqua',
    'Comic Sans MS',
    'Impact',
    'Courier New',
    'Consolas',
    'Monaco',
  ];

  const googleFontNames = GOOGLE_FONTS.map((f) => f.name);

  return [...systemFonts, ...googleFontNames].sort();
}

export function isGoogleFont(fontName: string): boolean {
  return GOOGLE_FONTS.some((f) => f.name === fontName);
}
