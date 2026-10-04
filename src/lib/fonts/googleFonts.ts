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

// Track loaded fonts
const loadedFonts = new Set<string>();
const loadingFonts = new Map<string, Promise<void>>();

export async function loadGoogleFont(fontName: string, weights: number[] = [400, 700]): Promise<void> {
  if (loadedFonts.has(fontName)) {
    return;
  }
  const existingPromise = loadingFonts.get(fontName);
  if (existingPromise) return existingPromise;

  const fontWeights = weights.join(';');
  const fontUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@${fontWeights}&display=swap`;

  // Check if link already exists
  const existingLink = document.querySelector(`link[href*="${encodeURIComponent(fontName)}"]`);
  if (existingLink) {
    await document.fonts?.load(`16px "${fontName}"`);
    loadedFonts.add(fontName);
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
        await Promise.all(weights.map((weight) => document.fonts?.load(`${weight} 16px "${fontName}"`)));
        loadedFonts.add(fontName);
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
  loadingFonts.set(fontName, promise);
  return promise.finally(() => loadingFonts.delete(fontName));
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
    const weight = Number.parseInt(String(object.fontWeight), 10);
    const weights = requested.get(family) || new Set<number>();
    weights.add(Number.isFinite(weight) ? weight : 400);
    requested.set(family, weights);
  }

  await Promise.all(Array.from(requested, ([family, weights]) => loadGoogleFont(family, Array.from(weights))));
  await document.fonts?.ready;
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
