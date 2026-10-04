import { createHash } from 'node:crypto';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { createLogger } from '@/lib/logger';
import { ADMIN_COLLECTIONS } from './config';

const logger = createLogger('ConsoleAudit');

export interface AuditEntry {
  action: string;
  actorUid: string | null;
  actorEmail: string | null;
  target?: string | null;
  details?: Record<string, unknown>;
  client?: string | null;
}

/** Client addresses are stored only as a short salted hash. */
function fingerprint(client: string | null | undefined): string | null {
  if (!client) return null;
  const salt = process.env.DAILY_IP_SALT || 'console-audit';
  return createHash('sha256').update(`${salt}|${client}`).digest('hex').slice(0, 16);
}

/**
 * Appends an entry to the console audit log. Audit failures are logged but do
 * not fail the operation they describe; the operation itself already ran.
 */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    await getAdminFirestore().collection(ADMIN_COLLECTIONS.audit).add({
      at: new Date().toISOString(),
      action: entry.action,
      actorUid: entry.actorUid,
      actorEmail: entry.actorEmail,
      target: entry.target ?? null,
      details: entry.details ?? {},
      clientHash: fingerprint(entry.client),
    });
  } catch (error) {
    logger.error('Failed to write console audit entry', { action: entry.action }, error as Error);
  }
}
