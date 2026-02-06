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
- **Dual Themes**: Dark and Light themes with smooth transitions
- **Privacy-First**: All processing happens in the browser
- **Fully Responsive**: Optimized for desktop and mobile devices

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

#### 🖼️ Stunning Homepage
- Performance-optimized animated mesh gradient background
- Floating particles with CSS-only animations
- Animated geometric shapes
- Modern, engaging design with smooth transitions
- Mobile-responsive layout
- Product preview mockup

#### 📁 Media Library
- Personal cloud storage for each user via Vercel Blob
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

#### 📋 Certificate Info Modal
- Add metadata to templates: title, issuer, description
- Certificate info is saved with each template
- Opens existing templates with their saved certificate info
- Required before generating certificates
- Displayed on the public verification page with sharing options

#### 🔐 Email Verification
- New user registration requires email verification
- Firebase Auth sends verification emails with custom redirect
- Users cannot login until email is verified
- Verification success message on login page
- Automatic fallback for deployment domain issues

#### 🎯 Enhanced Canvas Boundary
- Red dashed boundary line for print area
- Semi-transparent red shade outside boundary
- Clear distinction between printable/non-printable areas

#### 📱 Social Sharing
- Share verified certificates on LinkedIn, Facebook, and X (Twitter)
- Copy link to clipboard functionality
- Add certificate directly to LinkedIn profile
- Beautiful share dialog with multiple options

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
│   │   ├── GenerationModal.tsx
│   │   └── CertificateInfoModal.tsx  # Certificate metadata
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

### Dark Theme
- Background: Rich slate gradient
- Primary: Indigo (`#6366f1`)
- Secondary: Purple (`#a855f7`)
- Accent: Pink (`#ec4899`)

### Light Theme
- Background: Clean white with subtle gradients
- Primary: Indigo (`#4f46e5`)
- Secondary: Purple (`#a855f7`)
- Accent: Pink (`#ec4899`)

## 🔧 Configuration

### Environment Variables

```env
# Firebase Client (server-only — injected to client via FirebaseProvider)
FB_CREDENTIAL=
FB_AUTH_DOMAIN=
FB_PROJECT=
FB_BUCKET=
FB_SENDER=
FB_APP=

# Firebase Admin (Server-side)
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=

# Vercel Blob (for media storage)
BLOB_READ_WRITE_TOKEN=

# Resend (for email)
RESEND_API_KEY=

# App
NEXT_PUBLIC_SITE_URL=http://localhost:3000
DAILY_IP_SALT=your-secret-salt

# Rate Limiting
DAILY_EMAIL_LIMIT=100
FREE_BULK_EMAIL_LIMIT=5
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