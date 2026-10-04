<div align="center">

# Serenity

### Professional Certificate Generator

**Design • Generate • Verify: All in One Platform**

[Live Demo](https://serenity-certificate.vercel.app) · [Report Bug](https://github.com/ARPANPATRA111/Serenity/issues) · [Request Feature](https://github.com/ARPANPATRA111/Serenity/issues)


[![Next.js](https://img.shields.io/badge/Next.js_14-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)

[![GitHub stars](https://img.shields.io/github/stars/ARPANPATRA111/Serenity?style=for-the-badge&logo=github&color=yellow)](https://github.com/ARPANPATRA111/Serenity/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/ARPANPATRA111/Serenity?style=for-the-badge&logo=github&color=blue)](https://github.com/ARPANPATRA111/Serenity/fork)
[![GitHub issues](https://img.shields.io/github/issues/ARPANPATRA111/Serenity?style=for-the-badge&logo=github&color=red)](https://github.com/ARPANPATRA111/Serenity/issues)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

</div>


## 🎯 What is Serenity?

Serenity is a certificate design, generation, delivery, and public-verification application. The repository is under active security, reliability, and usability hardening and should not be treated as production-ready without the documented staging gates.

> **Data handling:** Rendering happens in the browser, while saved templates, certificate records, media, and optional email delivery use configured backend services. Review the deployment privacy policy before collecting recipient data.


## ⚡ Key Features

<table>
<tr>
<td width="50%">

### 🎨 Powerful Editor
- Drag-and-drop canvas (Fabric.js)
- Variable textboxes `{{name}}`
- 1000+ Google Fonts
- Shapes, borders & decorations
- Image editing & filters
- Element locking
- Undo/Redo history

</td>
<td width="50%">

### 📊 Bulk Generation
- Excel/CSV data import
- Process 1000s of certificates
- High-DPI PDF export (300 DPI)
- Progress tracking
- Batch email delivery
- Client-side processing

</td>
</tr>
<tr>
<td width="50%">

### ✅ Verification System
- Unique QR codes per certificate
- Public verification pages
- Social sharing (LinkedIn, X, Facebook)
- View analytics
- Metadata display

</td>
<td width="50%">

### 👤 User Management
- Email + OAuth (Google, GitHub)
- Email verification
- Premium membership
- Personal template library
- Dark/Light themes

</td>
</tr>
</table>


## 🖼️ Screenshots

<div>
<table>
<tr>
<td align="center"><strong>🏠 Landing Page</strong></td>
<td align="center"><strong>🎨 Certificate Editor</strong></td>
</tr>
<tr>
<td><img src="https://placehold.co/400x250/1a1a2e/ffffff?text=Landing+Page" alt="Landing Page"/></td>
<td><img src="https://placehold.co/400x250/1a1a2e/ffffff?text=Editor" alt="Editor"/></td>
</tr>
<tr>
<td align="center"><strong>📋 Dashboard</strong></td>
<td align="center"><strong>✅ Verification Page</strong></td>
</tr>
<tr>
<td><img src="https://placehold.co/400x250/1a1a2e/ffffff?text=Dashboard" alt="Dashboard"/></td>
<td><img src="https://placehold.co/400x250/1a1a2e/ffffff?text=Verification" alt="Verification"/></td>
</tr>
</table>
</div>


## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/ARPANPATRA111/Serenity.git
cd Serenity

# Install dependencies
pnpm install

# Set up environment variables
cp .env.local.example .env.local
# Edit .env.local with your Firebase & Brevo credentials

# Start development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.


## 🛠️ Tech Stack

<div>

| Layer | Technology |
|:-----:|:-----------|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript 5.0 |
| **Canvas** | Fabric.js 5.3.0 |
| **State** | Zustand |
| **Database** | Firebase Firestore |
| **Auth** | Firebase Auth |
| **Storage** | Vercel Blob |
| **Email** | Brevo |
| **PDF** | jsPDF |
| **Styling** | Tailwind CSS |

</div>


## 📁 Project Structure

```
src/
├── 📂 app/                    # Next.js App Router
│   ├── 📂 api/               # API Routes (verify, email, templates)
│   ├── 📂 dashboard/         # User dashboard
│   ├── 📂 editor/            # Certificate editor
│   ├── 📂 my-templates/      # Personal templates
│   ├── 📂 templates/         # Public gallery
│   ├── 📂 premium/           # Upgrade page
│   ├── 📂 history/           # Certificate history
│   ├── 📂 settings/          # User settings
│   └── 📂 verify/[id]/       # Verification page
├── 📂 components/
│   ├── 📂 editor/            # Canvas, Toolbar, Sidebars
│   ├── 📂 providers/         # Context providers
│   └── 📂 ui/                # Reusable components
├── 📂 lib/
│   ├── 📂 fabric/            # Canvas utilities
│   ├── 📂 generator/         # Batch processing
│   └── 📂 firebase/          # Firebase config
├── 📂 store/                 # Zustand stores
└── 📂 types/                 # TypeScript types
```


## ⚙️ Environment Variables

Create a `.env.local` file in the root directory:

```env
# Firebase Client
FB_CREDENTIAL=your-api-key
FB_AUTH_DOMAIN=your-project.firebaseapp.com
FB_PROJECT=your-project-id
FB_BUCKET=your-project.appspot.com

# Firebase Admin
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-admin@your-project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Vercel Blob (Media Storage)
BLOB_READ_WRITE_TOKEN=your-blob-token

# Email (Brevo)
BREVO_API_KEY=your-brevo-api-key

# App Configuration
NEXT_PUBLIC_SITE_URL=http://localhost:3000
FREE_BULK_EMAIL_LIMIT=5
```


## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|:--------:|:-------|
| `Ctrl + S` | Save template |
| `Ctrl + Z` | Undo |
| `Ctrl + Y` | Redo |
| `Ctrl + Q` | Toggle preview |
| `Delete` | Remove selected |
| `Alt + Drag` | Pan canvas |


## 🤝 Contributing

Contributions make the open-source community amazing! Here's how you can help:

1. **🐛 Found a bug?** [Open an issue](https://github.com/ARPANPATRA111/Serenity/issues/new)
2. **💡 Have an idea?** [Request a feature](https://github.com/ARPANPATRA111/Serenity/issues/new)
3. **🔧 Want to contribute?** Follow the steps below:

```bash
# Fork the repository
# Clone your fork
git clone https://github.com/YOUR_USERNAME/Serenity.git

# Create a feature branch
git checkout -b feature/amazing-feature

# Make your changes and commit
git commit -m "feat: add amazing feature"

# Push and create a Pull Request
git push origin feature/amazing-feature
```

Please ensure:
- ✅ Code follows existing conventions
- ✅ TypeScript types are properly defined
- ✅ `pnpm build` passes without errors
- ✅ PR references the related issue


## 📜 Roadmap

See [Improvements.md](./Improvements.md) for planned improvements and the development roadmap.

**Upcoming Features:**
- 🏷️ Template categories & search
- 📤 PNG/JPG export options
- 📊 Analytics dashboard
- 🌐 Multi-language support
- Searchable, on-demand typography controls


## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.


<div align="center">

### Support this repo if you find it useful

Made with ❤️ by [Arpan Patra](https://github.com/ARPANPATRA111)

[![GitHub](https://img.shields.io/badge/GitHub-ARPANPATRA111-181717?style=for-the-badge&logo=github)](https://github.com/ARPANPATRA111)

</div>
