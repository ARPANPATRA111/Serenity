import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { VerificationClient } from './VerificationClient';

interface VerifyPageProps {
  params: { id: string };
}

export async function generateMetadata({ params }: VerifyPageProps): Promise<Metadata> {
  return {
    title: `Verify Certificate | Serenity`,
    description: 'Verify the authenticity of this certificate',
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
