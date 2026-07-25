import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { VerificationClient } from './VerificationClient';

interface VerifyPageProps {
  params: { id: string };
}

export async function generateMetadata({ params }: VerifyPageProps): Promise<Metadata> {
  return {
    title: `Verify Certificate`,
    description: 'Verify the authenticity of this certificate',
    // Per-recipient page: keep out of the index for privacy/thin-content
    // reasons, but allow crawlers to follow outbound links.
    robots: { index: false, follow: true },
    openGraph: {
      title: 'Certificate Verification',
      description: 'Verify the authenticity of this certificate on Serenity',
    },
  };
}

export default function VerifyPage({ params }: VerifyPageProps) {
  const { id } = params;

  if (!id || id.length < 8) {
    notFound();
  }

  return <VerificationClient certificateId={id} />;
}
