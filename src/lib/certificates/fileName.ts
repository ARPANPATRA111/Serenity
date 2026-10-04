/**
 * File-name form of a recipient's name, shared by ZIP entries and email
 * attachments so both read the same ("Zoë_Ångström"). Letters in every script
 * are kept; only characters that file systems or mail clients reject are
 * replaced, whitespace becomes "_", and the result is capped at 50 characters.
 */
export function certificateFileStem(name: string, maxLength = 50): string {
  const stem = name
    .normalize('NFC')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, '_')
    .trim()
    .replace(/\s+/g, '_');
  return Array.from(stem).slice(0, maxLength).join('') || 'certificate';
}

/** File extension for an attached certificate image, from its MIME type. */
export function imageExtension(contentType: string): 'png' | 'jpg' | 'webp' {
  if (contentType.startsWith('image/jpeg')) return 'jpg';
  if (contentType.startsWith('image/webp')) return 'webp';
  return 'png';
}
