'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ProgressBar, GenerationProgress } from '@/components/ui/ProgressBar';
import { useFabricContext } from './FabricContext';
import { useDataSourceStore } from '@/store/dataSourceStore';
import { useGenerationStore } from '@/store/generationStore';
import { useEditorStore } from '@/store/editorStore';
import { useAuth } from '@/contexts/AuthContext';
import { generateBatch, downloadZip, retryCertificatePersistence, type BatchGenerationResult } from '@/lib/generator';
import { authenticatedFetch } from '@/lib/api/authFetch';
import { getIdToken } from '@/lib/firebase/client';
import { Download, FileText, Mail, CheckCircle, AlertCircle, Info, Loader2, ChevronRight, Lock, RefreshCw } from 'lucide-react';

/** Keeps each email request under the 4.5 MB body limit of Vercel functions. */
const MAX_ATTACHMENT_BASE64_CHARS = 4_200_000;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || '');
      resolve(value.slice(value.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error || new Error('Could not read the certificate PDF'));
    reader.readAsDataURL(blob);
  });
}

interface GenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => Promise<{ success: boolean; error?: string }>;
}

type GenerationStep = 'configure' | 'generating' | 'emailing' | 'complete';

interface EmailResult {
  recipientName: string;
  email: string;
  success: boolean;
  error?: string;
}

export function GenerationModal({ isOpen, onClose, onSave }: GenerationModalProps) {
  const { fabricInstance } = useFabricContext();
  const { dataSource, headers, rows } = useDataSourceStore();
  const { templateId, templateName, certificateMetadata } = useEditorStore();
  const { user } = useAuth();
  const {
    current,
    total,
    status,
    percentage,
    isGenerating,
    errors,
    generatedIds,
    startGeneration,
    updateProgress,
    addError,
    addGeneratedId,
    cancelGeneration,
    complete,
    reset,
  } = useGenerationStore();

  const [step, setStep] = useState<GenerationStep>('configure');
  const [nameField, setNameField] = useState(headers[0] || '');
  const [emailField, setEmailField] = useState('');
  const [sendEmails, setSendEmails] = useState(false);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [emailResults, setEmailResults] = useState<EmailResult[]>([]);
  const [emailProgress, setEmailProgress] = useState({ current: 0, total: 0 });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<BatchGenerationResult | null>(null);
  const [zipDownloaded, setZipDownloaded] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [premiumCheck, setPremiumCheck] = useState<{ loading: boolean; canGenerate: boolean; remaining: number; isPremium: boolean }>({
    loading: true, canGenerate: true, remaining: 5, isPremium: false,
  });

  // Placeholders on the design with no matching spreadsheet column would print
  // as literal "{{Column}}" text, so they are flagged before generating.
  const unmatchedPlaceholders = useMemo(() => {
    if (!isOpen) return [];
    const objects = fabricInstance?.getCanvas()?.getObjects() ?? [];
    const keys = new Set<string>();
    for (const object of objects as Array<{ dynamicKey?: unknown }>) {
      if (typeof object.dynamicKey === 'string' && object.dynamicKey && !headers.includes(object.dynamicKey)) {
        keys.add(object.dynamicKey);
      }
    }
    return Array.from(keys);
  }, [isOpen, fabricInstance, headers]);

  // Find email-like columns in headers
  const emailColumns = useMemo(() => {
    return headers.filter(h => 
      h.toLowerCase().includes('email') || 
      h.toLowerCase().includes('e-mail') ||
      h.toLowerCase() === 'mail'
    );
  }, [headers]);

  const emailValidation = useMemo(() => {
    if (!emailField || !sendEmails) return { valid: true, missing: [], total: 0 };
    
    const missing: { index: number; name: string }[] = [];
    rows.forEach((row, index) => {
      const email = row[emailField];
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        missing.push({ 
          index, 
          name: String(row[nameField] || `Row ${index + 1}`) 
        });
      }
    });
    
    return {
      valid: missing.length === 0,
      missing,
      total: rows.length,
      withEmail: rows.length - missing.length,
    };
  }, [emailField, sendEmails, rows, nameField]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('configure');
      reset();
      setResultBlob(null);
      setEmailResults([]);
      setEmailProgress({ current: 0, total: 0 });
      setSendEmails(false);
      setSaveError(null);
      setLastResult(null);
      setZipDownloaded(false);
      setRetryError(null);
      
      // Check premium status
      if (user?.id) {
        setPremiumCheck(prev => ({ ...prev, loading: true }));
        authenticatedFetch('/api/users/premium')
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              setPremiumCheck({
                loading: false,
                canGenerate: data.canGenerate,
                remaining: data.remainingFree ?? 5,
                isPremium: data.isPremium,
              });
            } else {
              setPremiumCheck({ loading: false, canGenerate: true, remaining: 5, isPremium: false });
            }
          })
          .catch(() => {
            setPremiumCheck({ loading: false, canGenerate: true, remaining: 5, isPremium: false });
          });
      }
      
      // Re-pick columns when the spreadsheet changed and the remembered
      // column no longer exists; otherwise every certificate would be named
      // "Certificate_1", "Certificate_2", ...
      if (headers.length > 0 && (!nameField || !headers.includes(nameField))) {
        const nameColumn = headers.find((h) =>
          h.toLowerCase().includes('name')
        );
        setNameField(nameColumn || headers[0]);
      }

      if (emailField && !headers.includes(emailField)) {
        setEmailField(emailColumns[0] || '');
      } else if (emailColumns.length > 0 && !emailField) {
        setEmailField(emailColumns[0]);
      }
    }
  }, [isOpen, headers, reset, emailColumns, nameField, emailField, user?.id]);

  const outcome = useMemo(() => {
    const unsavedCount = lastResult?.unsavedRecords.length ?? 0;
    const renderFailures = lastResult
      ? lastResult.errors.filter((error) => error.index >= 0).length
      : errors.filter((error) => error.index >= 0).length;
    const cancelled = lastResult?.cancelled ?? false;
    return {
      unsavedCount,
      renderFailures,
      cancelled,
      limitReached: lastResult?.limitReached ?? false,
      generatedCount: lastResult?.generatedCertificates.length ?? generatedIds.length,
      savedCount: lastResult?.persistedCertificateIds.length ?? generatedIds.length,
      allGood: lastResult
        ? unsavedCount === 0 && renderFailures === 0 && !cancelled
        : errors.length === 0,
    };
  }, [lastResult, errors, generatedIds.length]);

  // Only title and issuedBy are required - description is optional
  const isCertificateInfoComplete = certificateMetadata.title.trim() && 
    certificateMetadata.issuedBy.trim();

  /**
   * Sends certificate emails for saved certificates only: an unsaved
   * certificate's verification link would not work for its recipient.
   */
  const sendEmailsFor = useCallback(async (result: BatchGenerationResult, idToken: string) => {
    const persistedCertificateIds = new Set(result.persistedCertificateIds);
    const generatedByRowIndex = new Map(
      result.generatedCertificates
        .filter((certificate) => persistedCertificateIds.has(certificate.certificateId))
        .map((certificate) => [certificate.rowIndex, certificate])
    );
    if (!emailField || generatedByRowIndex.size === 0) return;

    setStep('emailing');
    const emailResultsList: EmailResult[] = [];
    const rowsWithEmail = rows.filter(row => {
      const email = row[emailField];
      return email && typeof email === 'string' && email.includes('@');
    });
    let emailProcessed = 0;
    setEmailProgress({ current: 0, total: rowsWithEmail.length });

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const email = row[emailField];
      const recipientName = String(row[nameField] || `Recipient ${i + 1}`);
      const generatedCertificate = generatedByRowIndex.get(i);
      const certificateId = generatedCertificate?.certificateId;

      if (!email || typeof email !== 'string' || !email.includes('@')) {
        emailResultsList.push({
          recipientName,
          email: email ? String(email) : 'No email',
          success: false,
          error: 'Invalid or missing email address',
        });
        continue;
      }

      if (!certificateId) {
        emailResultsList.push({
          recipientName,
          email: String(email),
          success: false,
          error: result.generatedCertificates.some((certificate) => certificate.rowIndex === i)
            ? 'Certificate was not saved, so it was not emailed'
            : 'Certificate generation failed',
        });
        emailProcessed += 1;
        setEmailProgress(prev => ({ ...prev, current: Math.min(emailProcessed, prev.total) }));
        continue;
      }

      try {
        const pdfBlob = result.certificatePdfBlobs.get(certificateId);
        let certificatePdfBase64: string | undefined;

        if (pdfBlob) {
          const encoded = await blobToBase64(pdfBlob);
          // Requests above the hosting platform's 4.5 MB body limit are
          // rejected before reaching the API, so an oversized PDF is sent as
          // a link to its verification page instead of an attachment.
          certificatePdfBase64 = encoded.length <= MAX_ATTACHMENT_BASE64_CHARS ? encoded : undefined;
        }

        const response = await fetch('/api/email/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            to: email,
            recipientName,
            certificateId,
            certificateTitle: certificateMetadata.title || 'Certificate of Completion',
            issuerName: certificateMetadata.issuedBy || user?.name || 'Serenity',
            certificatePdfBase64,
          }),
        });

        const data = await response.json().catch(() => ({ success: false, error: `Email request failed (${response.status})` }));

        emailResultsList.push({
          recipientName,
          email: String(email),
          success: data.success,
          error: data.success ? undefined : data.error,
        });
      } catch (error) {
        emailResultsList.push({
          recipientName,
          email: String(email),
          success: false,
          error: error instanceof Error ? error.message : 'Failed to send email',
        });
      }

      emailProcessed += 1;
      setEmailProgress(prev => ({ ...prev, current: Math.min(emailProcessed, prev.total) }));
      setEmailResults([...emailResultsList]);
    }

    setEmailResults(emailResultsList);
  }, [emailField, rows, nameField, certificateMetadata, user?.name]);

  /** Downloads, emails, and shows the summary once every record is saved. */
  const finishGeneration = useCallback(async (result: BatchGenerationResult, idToken: string) => {
    if (result.zipBlob) {
      setResultBlob(result.zipBlob);
      if (result.unsavedRecords.length === 0) {
        downloadZip(result.zipBlob, `certificates_${Date.now()}.zip`);
        setZipDownloaded(true);
      }
    }

    if (result.unsavedRecords.length === 0 && sendEmails && emailField) {
      await sendEmailsFor(result, idToken);
    }

    setStep('complete');
  }, [sendEmails, emailField, sendEmailsFor]);

  const handleGenerate = useCallback(async () => {
    if (!fabricInstance || !dataSource) return;

    if (!isCertificateInfoComplete) {
      return;
    }

    if (rows.length > 100 && !window.confirm(
      `This batch contains ${rows.length} high-resolution certificates and may use significant memory. Continue?`,
    )) {
      return;
    }

    setSaveError(null);

    // Save the template first - generation requires a saved template
    if (onSave) {
      const saveResult = await onSave();
      if (!saveResult.success) {
        setSaveError(saveResult.error || 'Failed to save template. Please fix the issue and try again.');
        return;
      }
    }

    const templateJSON = JSON.stringify(fabricInstance.toJSON());
    const idToken = await getIdToken();
    if (!idToken) {
      setSaveError('Authentication expired. Please sign in again before generating certificates.');
      return;
    }

    setStep('generating');
    setZipDownloaded(false);
    setRetryError(null);
    startGeneration(rows.length);

    const result = await generateBatch({
      templateJSON,
      dataRows: rows,
      nameField,
      emailField: emailField || undefined,
      generateQRCodes: true,
      outputFormat: 'pdf',
      retainPdfBlobs: sendEmails && !!emailField,
      templateId: templateId || undefined,
      templateName: templateName || 'Untitled Template',
      userId: user?.id,
      authToken: idToken,
      issuerName: certificateMetadata.issuedBy || user?.name || 'Serenity',
      certificateTitle: certificateMetadata.title || 'Certificate of Completion',
      certificateDescription: certificateMetadata.description || '',
      eventId: certificateMetadata.eventId,
      onProgress: (current, total, status) => {
        updateProgress(current, status);
      },
      onError: (index, message) => {
        addError(index, message);
      },
      onCertificateGenerated: (id) => {
        addGeneratedId(id);
      },
      // Read the store at call time: a value captured when this callback was
      // created would never see a later Cancel click.
      isCancelled: () => useGenerationStore.getState().isCancelled,
    });

    setLastResult(result);

    // Nothing was rendered because the batch exceeds the plan allowance. Say
    // exactly how many remain: with some allowance left, a smaller
    // spreadsheet still works.
    if (result.limitReached && result.generatedCertificates.length === 0) {
      complete();
      const remaining = result.remaining ?? 0;
      setPremiumCheck(prev => ({
        ...prev,
        canGenerate: remaining > 0,
        remaining,
      }));
      setSaveError(result.errors[0]?.message || 'The free plan allowance has been reached.');
      setStep('configure');
      return;
    }

    complete();
    await finishGeneration(result, idToken);
  }, [
    fabricInstance,
    dataSource,
    rows,
    nameField,
    emailField,
    sendEmails,
    templateId,
    templateName,
    user?.id,
    user?.name,
    startGeneration,
    updateProgress,
    addError,
    addGeneratedId,
    complete,
    onSave,
    certificateMetadata,
    isCertificateInfoComplete,
    finishGeneration,
  ]);

  const handleRetrySave = useCallback(async () => {
    if (!lastResult) return;
    setRetrying(true);
    setRetryError(null);
    try {
      const idToken = await getIdToken();
      if (!idToken) {
        setRetryError('Your session expired. Sign in again in another tab, then retry.');
        return;
      }
      const next = await retryCertificatePersistence(lastResult, idToken);
      setLastResult(next);
      if (next.unsavedRecords.length > 0) {
        setRetryError(next.persistenceErrors[0]?.message || 'Some certificates still could not be saved.');
        return;
      }
      // Everything is saved now: continue exactly as a clean run would.
      await finishGeneration(next, idToken);
    } finally {
      setRetrying(false);
    }
  }, [lastResult, finishGeneration]);

  const handleDownloadAnyway = useCallback(() => {
    if (!resultBlob) return;
    downloadZip(resultBlob, `certificates_${Date.now()}.zip`);
    setZipDownloaded(true);
  }, [resultBlob]);

  const handleDownload = useCallback(() => {
    if (resultBlob) {
      downloadZip(resultBlob, `certificates_${Date.now()}.zip`);
    }
  }, [resultBlob]);

  const handleCancel = useCallback(() => {
    cancelGeneration();
  }, [cancelGeneration]);

  const handleClose = useCallback(() => {
    if (isGenerating) {
      const confirm = window.confirm(
        'Generation is in progress. Are you sure you want to cancel?'
      );
      if (!confirm) return;
      cancelGeneration();
    }
    onClose();
  }, [isGenerating, cancelGeneration, onClose]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        step === 'configure'
          ? 'Generate Certificates'
          : step === 'generating'
          ? 'Generating...'
          : step === 'emailing'
          ? 'Sending Emails...'
          : 'Generation Complete'
      }
      className="max-w-lg w-full"
    >
      {step === 'configure' && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="rounded-lg bg-muted p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-medium">{rows.length} Certificates</p>
                  <p className="text-sm text-muted-foreground">
                    From {dataSource?.fileName}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Configuration */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              Name Field (for file naming)
            </label>
            <select
              value={nameField}
              onChange={(e) => setNameField(e.target.value)}
              className="input"
            >
              {headers.map((header) => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
            </select>
          </div>

          {/* Email Options */}
          <div className="rounded-lg border border-border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                <span className="font-medium">Send Certificates via Email</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={sendEmails}
                aria-label="Send certificates via email"
                onClick={() => setSendEmails(!sendEmails)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  sendEmails ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    sendEmails ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            
            {sendEmails && (
              <>
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Email Field
                  </label>
                  <select
                    value={emailField}
                    onChange={(e) => setEmailField(e.target.value)}
                    className="input"
                  >
                    <option value="">Select email column...</option>
                    {headers.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </div>
                
                {emailField && !emailValidation.valid && (
                  <div className="flex items-start gap-3 rounded-lg bg-warning/10 border border-warning/20 p-3">
                    <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <p className="font-medium text-warning">
                        {emailValidation.missing.length} recipient(s) have missing or invalid emails
                      </p>
                      <p className="text-muted-foreground mt-1">
                        Emails will only be sent to {emailValidation.withEmail} of {emailValidation.total} recipients.
                        Certificates for all recipients will still be generated and included in the ZIP download.
                      </p>
                    </div>
                  </div>
                )}

                {emailField && emailValidation.valid && (
                  <div className="flex items-center gap-2 text-sm text-success">
                    <CheckCircle className="h-4 w-4" />
                    <span>All {rows.length} recipients have valid email addresses</span>
                  </div>
                )}
              </>
            )}
          </div>

          {unmatchedPlaceholders.length > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <div className="text-xs">
                <p className="font-medium text-warning">
                  {unmatchedPlaceholders.length === 1 ? 'A placeholder has' : 'Some placeholders have'} no matching column
                </p>
                <p className="mt-1 text-muted-foreground">
                  {unmatchedPlaceholders.map((key) => `{{${key}}}`).join(', ')} will print as written. Column names must match exactly,
                  including capital letters.
                </p>
              </div>
            </div>
          )}

          {/* Output Info */}
          <div className="rounded-lg border border-border p-4">
            <h4 className="mb-2 font-medium">Output</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                High-quality PDF (300 DPI)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                Unique QR code verification
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                ZIP archive download (auto-downloads)
              </li>
              {sendEmails && emailField && (
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  Email certificates to recipients
                </li>
              )}
            </ul>
          </div>

          {/* Certificate Info Warning */}
          {!isCertificateInfoComplete && (
            <div className="flex items-start gap-3 rounded-lg bg-warning/10 border border-warning/20 p-4">
              <Info className="h-5 w-5 text-warning shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-warning">Certificate Info Required</p>
                <p className="text-muted-foreground mt-1">
                  Please fill in the Certificate Information (Title, Issued By, Description) 
                  before generating certificates. Click the <strong>Info</strong> button in the toolbar.
                </p>
              </div>
            </div>
          )}

          {rows.length > 50 && (
            <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/10 p-4">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <p className="text-sm text-muted-foreground">
                Large high-resolution batches work best on a desktop. Keep this tab open and avoid other memory-heavy tasks during generation.
              </p>
            </div>
          )}

          {/* Free Tier Limit Warning */}
          {!premiumCheck.loading && !premiumCheck.canGenerate && (
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-4">
              <p className="font-semibold">Free limit reached</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Paid upgrades are not currently available. You can continue editing and exporting the template itself.
              </p>
            </div>
          )}

          {/* Free Tier Remaining Info */}
          {!premiumCheck.loading && premiumCheck.canGenerate && !premiumCheck.isPremium && (
            <div className="flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/20 p-3">
              <Info className="h-4 w-4 text-primary shrink-0" />
              <p className="text-xs text-muted-foreground">
                Free plan: <strong>{premiumCheck.remaining}</strong> generation{premiumCheck.remaining !== 1 ? 's' : ''} remaining.{' '}
                Billing is not currently available.
              </p>
            </div>
          )}

          {/* Save Error Alert */}
          {saveError && (
            <div className="flex items-start gap-3 rounded-lg bg-destructive/10 border border-destructive/30 p-3">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">Cannot Generate Certificates</p>
                <p className="text-xs text-destructive/80 mt-1">{saveError}</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={handleGenerate} 
              className="flex-1"
              disabled={!isCertificateInfoComplete || premiumCheck.loading || !premiumCheck.canGenerate}
            >
              {premiumCheck.loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking...</>
              ) : !premiumCheck.canGenerate ? (
                <><Lock className="mr-2 h-4 w-4" /> Limit Reached</>
              ) : (
                'Start Generation'
              )}
            </Button>
          </div>
        </div>
      )}

      {step === 'generating' && (
        <div className="space-y-6 py-4">
          <GenerationProgress
            current={current}
            total={total}
            status={status}
            errors={errors}
            onCancel={handleCancel}
          />

          <p className="text-center text-sm text-muted-foreground">
            Please keep this window open while generating.
            <br />
            Processing happens in your browser for privacy.
          </p>
        </div>
      )}

      {step === 'emailing' && (
        <div className="space-y-6 py-4">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
            <h3 className="text-xl font-semibold">Sending Emails...</h3>
            <p className="mt-2 text-muted-foreground">
              {emailProgress.current} of {emailProgress.total} emails sent
            </p>
          </div>
          
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${emailProgress.total > 0 ? (emailProgress.current / emailProgress.total) * 100 : 0}%` }}
            />
          </div>

          <p className="text-center text-sm text-muted-foreground">
            ZIP file has been downloaded. Sending emails to recipients...
          </p>
        </div>
      )}

      {step === 'complete' && (
        <div className="space-y-4 sm:space-y-6 py-2 sm:py-4">
          {/* Outcome summary, derived from the generation result so a
              successful "retry saving" clears earlier save errors. */}
          <div className="text-center">
            {outcome.allGood ? (
              <>
                <div className="mx-auto mb-3 sm:mb-4 flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-success/20">
                  <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-success" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold">All Done!</h3>
                <p className="mt-1 sm:mt-2 text-sm text-muted-foreground">
                  Generated and saved {outcome.savedCount} certificate{outcome.savedCount === 1 ? '' : 's'}
                </p>
              </>
            ) : (
              <>
                <div className="mx-auto mb-3 sm:mb-4 flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-warning/20">
                  <AlertCircle className="h-6 w-6 sm:h-8 sm:w-8 text-warning" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold">
                  {outcome.cancelled ? 'Generation Cancelled' : 'Completed with Issues'}
                </h3>
                <p className="mt-1 sm:mt-2 text-sm text-muted-foreground">
                  Generated {outcome.generatedCount} of {total} certificates
                </p>
                {outcome.renderFailures > 0 && (
                  <p className="text-xs sm:text-sm text-error">
                    {outcome.renderFailures} certificate{outcome.renderFailures === 1 ? '' : 's'} could not be rendered
                  </p>
                )}
              </>
            )}
          </div>

          {outcome.unsavedCount > 0 && (
            <div className="space-y-3 rounded-lg border border-warning/40 bg-warning/10 p-3 sm:p-4" role="alert">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <div className="text-sm">
                  <p className="font-medium text-warning">
                    {outcome.unsavedCount} certificate{outcome.unsavedCount === 1 ? ' is' : 's are'} not saved yet
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Their QR codes and verification links will report &ldquo;not found&rdquo; until they are saved,
                    so the ZIP was not downloaded automatically and no emails were sent.
                  </p>
                  {retryError && <p className="mt-2 text-xs text-error">{retryError}</p>}
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button onClick={handleRetrySave} disabled={retrying || outcome.limitReached} className="flex-1">
                  {retrying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Retry saving
                </Button>
                {resultBlob && !zipDownloaded && (
                  <Button variant="outline" onClick={handleDownloadAnyway} className="flex-1">
                    <Download className="mr-2 h-4 w-4" />
                    Download anyway
                  </Button>
                )}
              </div>
              {outcome.limitReached && (
                <p className="text-xs text-muted-foreground">
                  Your plan allowance was reached while saving. Contact us about Pro to save the remaining certificates.
                </p>
              )}
            </div>
          )}

          {/* Email Results Summary */}
          {emailResults.length > 0 && (
            <div className="rounded-lg border border-border p-3 sm:p-4 space-y-2 sm:space-y-3">
              <h4 className="text-sm sm:text-base font-medium flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email Delivery Results
              </h4>
              <div className="flex gap-3 sm:gap-4 text-xs sm:text-sm">
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-success" />
                  <span>{emailResults.filter(r => r.success).length} sent</span>
                </div>
                <div className="flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-error" />
                  <span>{emailResults.filter(r => !r.success).length} failed</span>
                </div>
              </div>
              
              {/* Show successful emails */}
              {emailResults.filter(r => r.success).length > 0 && (
                <details className="group">
                  <summary className="text-xs font-medium text-success cursor-pointer hover:underline flex items-center gap-1">
                    <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                    View {emailResults.filter(r => r.success).length} successful emails
                  </summary>
                  <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                    {emailResults.filter(r => r.success).map((result, i) => (
                      <div key={i} className="text-xs p-2 bg-success dark:bg-success/20 rounded flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-success shrink-0" />
                        <span className="font-medium">{result.recipientName}</span>
                        <span className="text-muted-foreground">({result.email})</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
              
              {/* Show failed emails */}
              {emailResults.filter(r => !r.success).length > 0 && (
                <details className="group" open>
                  <summary className="text-xs font-medium text-error cursor-pointer hover:underline flex items-center gap-1">
                    <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                    View {emailResults.filter(r => !r.success).length} failed emails
                  </summary>
                  <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                    {emailResults.filter(r => !r.success).map((result, i) => (
                      <div key={i} className="text-xs p-2 bg-error dark:bg-error/20 rounded">
                        <span className="font-medium">{result.recipientName}</span>
                        <span className="text-muted-foreground ml-1">({result.email})</span>
                        <span className="text-error ml-2">- {result.error}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}

          {/* Download */}
          {resultBlob && zipDownloaded && (
            <Button
              onClick={handleDownload}
              className="w-full"
              size="lg"
            >
              <Download className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
              <span className="text-sm sm:text-base">Re-download ZIP ({(resultBlob.size / 1024 / 1024).toFixed(1)} MB)</span>
            </Button>
          )}

          {/* Info about auto-download */}
          {zipDownloaded && (
          <div className="flex items-start gap-2 sm:gap-3 rounded-lg bg-primary/10 border border-primary/20 p-2.5 sm:p-3">
            <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground">
              The ZIP file with all certificates was automatically downloaded. 
              If someone&apos;s email failed, you can manually share their certificate from the downloaded file.
            </div>
          </div>
          )}

          {/* Close */}
          <Button variant="outline" onClick={handleClose} className="w-full">
            Close
          </Button>
        </div>
      )}
    </Modal>
  );
}
