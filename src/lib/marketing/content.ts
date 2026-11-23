import {
  Building2,
  CalendarCheck,
  FileSpreadsheet,
  GraduationCap,
  HeartHandshake,
  Layers,
  Mail,
  Paintbrush,
  QrCode,
  Sparkles,
  Users,
} from 'lucide-react';
import type { WorkflowStep } from '@/components/marketing/WorkflowSteps';
import { FREE_CERTIFICATE_LIMIT } from '@/lib/plans/certificateLimits';
import type { FaqItem } from '@/lib/seo/structuredData';

/**
 * Copy shared by the public pages: the landing page shows a short version,
 * and /how-it-works, /faq and /features carry the full text.
 */

export const workflow: WorkflowStep[] = [
  {
    icon: Paintbrush,
    title: 'Design',
    body: 'Lay out one reusable certificate — text, logos, signatures, seals, and the verification field.',
  },
  {
    icon: FileSpreadsheet,
    title: 'Import',
    body: 'Upload a CSV or Excel file. Serenity reads the header row and lists every column.',
  },
  {
    icon: Users,
    title: 'Map',
    body: 'Drop a column onto the design to bind it to a field, then preview real rows.',
  },
  {
    icon: Layers,
    title: 'Generate',
    body: 'Produce one personalised, print-ready PDF per row, downloaded together as a ZIP archive.',
  },
  {
    icon: Mail,
    title: 'Deliver',
    body: 'Download the batch, or email a certificate to its recipient after an ownership check.',
  },
  {
    icon: QrCode,
    title: 'Verify',
    body: 'Every certificate carries a verification link. Add a QR code for printed copies.',
  },
];

export const useCases = [
  {
    icon: GraduationCap,
    audience: 'Education and colleges',
    body: 'Issue course, semester, and programme certificates for a whole cohort from the registrar’s spreadsheet.',
  },
  {
    icon: CalendarCheck,
    audience: 'Workshops and events',
    body: 'Turn a participant list into participation and speaker certificates once the event has closed.',
  },
  {
    icon: Building2,
    audience: 'HR and employee recognition',
    body: 'Recognise internal training, compliance completion, and long-service milestones from one template.',
  },
  {
    icon: Sparkles,
    audience: 'Training programmes',
    body: 'Reuse one branded design across every intake and give learners a link they can share with employers.',
  },
  {
    icon: HeartHandshake,
    audience: 'Communities and nonprofits',
    body: 'Thank volunteers and contributors with certificates that carry proof anyone can check.',
  },
];

export const faqs: FaqItem[] = [
  {
    question: 'What is Serenity Certificate Generator?',
    answer:
      'Serenity is a certificate generator for designing, personalising, generating, emailing, and verifying certificates in bulk. You build one reusable template, connect a spreadsheet of recipients, and generate a personalised certificate for every row — each with a permanent verification URL and an optional QR code.',
  },
  {
    question: 'Can I import recipients from CSV or Excel?',
    answer:
      'Yes. Upload a CSV, XLSX, XLS, or ODS file and Serenity lists every column from the header row as a variable. Drop a variable onto the canvas to bind it to a field, then step through the rows to preview the real values before generating.',
  },
  {
    question: 'What output formats are supported?',
    answer:
      'Every generated certificate is a print-ready PDF (300 DPI), and the whole batch downloads as a single ZIP archive. A design can also be exported on its own as a high-resolution PNG from the editor.',
  },
  {
    question: 'Can Serenity email certificates to recipients?',
    answer:
      'Yes. A generated certificate can be emailed to its recipient after Serenity confirms you own that certificate and your own address is verified. A daily sending limit applies. Keep the tab open until sending finishes, then check each result in History.',
  },
  {
    question: 'How does certificate verification work?',
    answer:
      'Every certificate includes a verification link. You can also add a matching QR code. Scanning or opening it loads a public verification page showing the recipient name, certificate title, issuer, issue date, and certificate ID. Recipient email addresses, spreadsheet rows, owner identifiers, and template identifiers are never exposed.',
  },
  {
    question: 'Is Serenity free?',
    answer: `The free plan includes ${FREE_CERTIFICATE_LIMIT} saved certificates in total, with no card required, and covers the whole workflow from design to verification. Pro starts at $20 per month and is arranged through a request — there is no self-serve checkout.`,
  },
  {
    question: 'Who owns and can read my data?',
    answer:
      'Every private read and write is authenticated server-side and scoped to the signed-in account. Firestore and Storage rules deny client access by default, so certificates, templates, and media stay with the account that created them.',
  },
];
