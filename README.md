# Serenity - Certificate Generator

A production-ready, SaaS-grade Certificate Generator built with Next.js 14 and Fabric.js.

![Serenity Banner](https://img.shields.io/badge/Serenity-Certificate%20Generator-blue?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

## 🌟 Features

### Core Features
- **Visual Editor**: Drag-and-drop interface powered by Fabric.js 5.3.0
- **Excel Import**: Upload Excel/CSV files and map columns to template variables
- **Bulk Generation**: Process thousands of certificates client-side
- **QR Verification**: Each certificate gets a unique verifiable QR code
- **High-DPI Output**: 300 DPI PDF export for professional printing
- **Dual Themes**: "Neon Future" (dark) and "Academic Gold" (light)
- **Privacy-First**: All processing happens in the browser

### New Features (v2.0)

#### 🎨 Enhanced Color Picker
- Professional color selection component
- Preset color palettes with 10+ color categories
- Quick access to common colors
- Recent colors memory (saved to localStorage)
- Custom hex color input
- Native color picker integration

#### 📐 Shapes & Borders
- Multiple shape types: rectangles, circles, triangles, stars, polygons
- Line tools: solid, dashed, and arrow lines
- Certificate border styles: simple, double, ornate, gold frame, corner
- Customizable stroke colors and widths

#### 🖼️ Interactive Homepage
- Animated floating dots background
- Mouse-following spotlight effect
- Gradient orbs with smooth animations
- Modern, engaging design

#### 📁 Media Library
- Personal cloud storage for each user via Firebase Storage
- Drag-and-drop upload interface
- Support for PNG, JPG, WebP, SVG, and GIF files
- 5MB file size limit with validation
- One-click media management

#### 🔒 Verification URL Tag
- Mandatory non-deletable verification element on all certificates
- Fixed-size (350px width), cannot be resized
- Can be repositioned anywhere on the canvas
- Red border indicator for easy identification
- Ensures all certificates are verifiable

#### 🔗 Link Elements
- Add clickable link text to certificates
- Styled underlined blue text appearance
- Links work in exported PDF files
- Custom URL per link element

#### 👁️ Preview Mode
- Lock editor to preview final certificate appearance
- Green tinted background indicator
- All editing functions disabled during preview
- Toggle with eye icon in toolbar

#### 🎯 Enhanced Canvas Boundary
- Red dashed boundary line for print area
- Semi-transparent red shade outside boundary
- Clear distinction between printable/non-printable areas

## 🚀 Quick Start

```bash
# Install dependencies (using pnpm recommended)
pnpm install

# Copy environment variables
cp .env.local.example .env.local

# Configure Firebase and Resend credentials in .env.local

# Start development server
pnpm dev

# Build for production
pnpm build
```

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   │   ├── verify/[id]/   # Certificate verification
│   │   ├── email/         # Email sending
│   │   ├── media/         # Media upload/management
│   │   ├── templates/     # Template CRUD
│   │   └── leads/         # Lead capture
│   ├── dashboard/         # User dashboard
│   ├── editor/            # Certificate editor
│   ├── templates/         # Template gallery
│   ├── history/           # Certificate history
│   ├── settings/          # User settings
│   └── verify/[id]/       # Public verification page
├── components/
│   ├── editor/            # Editor components
│   │   ├── EditorLayout.tsx
│   │   ├── FabricCanvasWrapper.tsx
│   │   ├── LeftSidebar.tsx    # Media Library
│   │   ├── RightSidebar.tsx
│   │   ├── PropertiesBar.tsx
│   │   ├── Toolbar.tsx
│   │   └── GenerationModal.tsx
│   ├── providers/         # Context providers
│   ├── templates/         # Template components
│   └── ui/                # Reusable UI components
├── lib/
│   ├── fabric/            # Fabric.js utilities
│   │   ├── VariableTextbox.ts  # Custom textbox class
│   │   ├── QRCodeImage.ts      # QR code object
│   │   └── useFabric.ts        # Main canvas hook
│   ├── excel/             # Excel parsing (SheetJS)
│   ├── generator/         # Batch generation engine
│   ├── firebase/          # Firebase configuration
│   │   ├── client.ts      # Client SDK
│   │   ├── admin.ts       # Admin SDK
│   │   ├── storage.ts     # Media storage service
│   │   └── templates.ts   # Template operations
│   └── services/          # Application services
├── store/                 # Zustand state management
│   ├── editorStore.ts     # Editor state
│   ├── dataSourceStore.ts # Excel data state
│   └── generationStore.ts # Generation progress
└── types/                 # TypeScript definitions
```

## 🏗️ Architecture

### Client-Heavy, Serverless-Light

This application follows a "Client-Heavy" architecture where:

1. **Canvas operations** are managed imperatively via refs, not React state
2. **PDF generation** happens entirely in the browser
3. **Batch processing** uses chunked loops with `setTimeout` yielding
4. **Server** only handles lightweight operations (verification, email rate limiting)
5. **Media storage** uses Firebase Storage with server-side validation

### Key Components

#### VariableTextbox (`src/lib/fabric/VariableTextbox.ts`)
Custom Fabric.js class that extends `Textbox` with:
- `dynamicKey` property for data binding
- Visual indicators (dashed border) for placeholders
- Proper serialization via `toObject` override

#### BatchGenerator (`src/lib/generator/BatchGenerator.ts`)
The "heart" of the application:
- Processes data rows without blocking UI
- High-DPI rasterization (4.166x multiplier)
- Generates PDFs and ZIP archives client-side
- Progress tracking with cancellation support

#### Media Library (`src/components/editor/LeftSidebar.tsx`)
User's personal asset library:
- Firebase Storage integration
- Drag-and-drop uploads
- File type and size validation
- Thumbnail previews

#### Verification API (`src/app/api/verify/[id]/route.ts`)
Privacy-preserving view counting:
- IP hashing with daily rotating salt
- No cookies required
- Atomic Firestore transactions

## 🎨 Theming

Two themes available via `next-themes`:

### Neon Future (Dark)
- Background: `#1c1c1c`
- Primary: `#001eff` (Electric Blue)
- Accent: `#ff008d` (Hot Pink)

### Academic Gold (Light)
- Background: `#ffffff`
- Primary: `#b45309` (Dark Amber)
- Accent: `#f59e0b` (Bright Amber)

## 🔧 Configuration

### Environment Variables

```env
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=

# Vercel Blob (for media storage)
BLOB_READ_WRITE_TOKEN=

# Resend
RESEND_API_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
DAILY_IP_SALT=your-secret-salt
```

## 📦 Dependencies

- **Next.js 14** - React framework with App Router
- **Fabric.js 5.3.0** - Canvas manipulation (STRICT: not v6)
- **SheetJS (xlsx)** - Excel/CSV parsing
- **jsPDF** - PDF generation
- **JSZip** - ZIP compression
- **Firebase** - Auth, Firestore, Storage
- **Resend** - Email delivery
- **Zustand** - State management
- **Tailwind CSS** - Styling
- **next-themes** - Theme switching

## 🚧 Freemium Model

The app implements a "Fake Door" freemium strategy:

1. Free users can generate unlimited certificates
2. Bulk email sending is limited to 5 recipients
3. Beyond limits, a `ComingSoonModal` captures leads
4. Lead events are stored in Firestore for analysis

## 🔮 Roadmap

### Planned Features
- [ ] Template marketplace
- [ ] Team collaboration
- [ ] Advanced analytics dashboard
- [ ] Mobile application
- [ ] Public API access
- [ ] Multi-language support
- [ ] Custom email templates
- [ ] Version history for templates

See [IMPROVEMENTS.md](./IMPROVEMENTS.md) for detailed improvement plans and suggestions.

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## 📝 License

MIT
