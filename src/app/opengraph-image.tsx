import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Serenity Certificate Generator — create, email and verify certificates in bulk';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Branded, factual social image. No fabricated logos, counts, or claims.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '90px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 55%, #0f766e 100%)',
          color: '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div
            style={{
              width: '84px',
              height: '84px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, #4f46e5, #2dd4bf)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '52px',
              fontWeight: 700,
            }}
          >
            ✓
          </div>
          <div style={{ fontSize: '40px', fontWeight: 700, letterSpacing: '-1px' }}>Serenity</div>
        </div>
        <div style={{ marginTop: '48px', fontSize: '72px', fontWeight: 700, lineHeight: 1.05, letterSpacing: '-2px', maxWidth: '900px' }}>
          Create, email &amp; verify certificates in bulk.
        </div>
        <div style={{ marginTop: '32px', fontSize: '32px', color: '#cbd5e1', maxWidth: '900px' }}>
          Design from a template, personalize from CSV or Excel, and give every recipient a verification URL and QR code.
        </div>
      </div>
    ),
    { ...size },
  );
}
