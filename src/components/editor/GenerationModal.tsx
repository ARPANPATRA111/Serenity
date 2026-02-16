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
import { generateBatch, downloadZip } from '@/lib/generator';
import { Download, FileText, Mail, CheckCircle, AlertCircle, Info, Loader2, ChevronRight, Crown, Lock } from 'lucide-react';
import Link from 'next/link';

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
    isCancelled,
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
  const [premiumCheck, setPremiumCheck] = useState<{ loading: boolean; canGenerate: boolean; remaining: number; isPremium: boolean }>({
    loading: true, canGenerate: true, remaining: 5, isPremium: false,
  });

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
      
      // Check premium status
      if (user?.id) {
        setPremiumCheck(prev => ({ ...prev, loading: true }));
        fetch(`/api/users/premium?userId=${user.id}`)
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
      
      if (headers.length > 0 && !nameField) {
        const nameColumn = headers.find((h) =>
          h.toLowerCase().includes('name')
        );
        setNameField(nameColumn || headers[0]);
      }
      
      if (emailColumns.length > 0 && !emailField) {
        setEmailField(emailColumns[0]);
      }
    }
  }, [isOpen, headers, reset, emailColumns, nameField, emailField, user?.id]);

  // Only title and issuedBy are required - description is optional
  const isCertificateInfoComplete = certificateMetadata.title.trim() && 
    certificateMetadata.issuedBy.trim();

  const handleGenerate = useCallback(async () => {
    if (!fabricInstance || !dataSource) return;

    if (!isCertificateInfoComplete) {
      return;
    }

    // Clear any previous save error
    setSaveError(null);

    // Save the template first - generation requires a saved template
    if (onSave) {
      const saveResult = await onSave();
      if (!saveResult.success) {
        setSaveError(saveResult.error || 'Failed to save template. Please fix the issue and try again.');
        return; // Block generation if save fails
      }
    }

    const templateJSON = JSON.stringify(fabricInstance.toJSON());
    
    setStep('generating');
    startGeneration(rows.length);

    const result = await generateBatch({
      templateJSON,
      dataRows: rows,
      nameField,
      generateQRCodes: true,
      outputFormat: 'pdf',
      templateId: templateId || undefined,
      templateName: templateName || 'Untitled Template',
      userId: user?.id,
      issuerName: certificateMetadata.issuedBy || user?.name || 'Serenity',
      certificateTitle: certificateMetadata.title || 'Certificate of Completion',
      certificateDescription: certificateMetadata.description || '',
      onProgress: (current, total, status) => {
        updateProgress(current, status);
      },
      onError: (index, message) => {
        addError(index, message);
      },
      onCertificateGenerated: (id) => {
        addGeneratedId(id);
      },
      isCancelled: () => isCancelled,
    });

    // Check if limit was reached
    if (result.limitReached) {
      complete();
      // Update premium check state to reflect the limit
      setPremiumCheck(prev => ({
        ...prev,
        canGenerate: false,
        remaining: result.remaining ?? 0,
      }));
      setStep('configure'); // Go back to configure to show the limit error
      return;
    }

    complete();

    // Increment certificate generation counter for the user
    if (user?.id && result.certificateIds.length > 0) {
      try {
        await fetch(`/api/users/premium`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            action: 'incrementCount',
            count: result.certificateIds.length,
          }),
        });
      } catch (e) {
        console.warn('Failed to update generation count:', e);
      }
    }

    if (result.zipBlob) {
      setResultBlob(result.zipBlob);
      downloadZip(result.zipBlob, `certificates_${Date.now()}.zip`);
    }

    if (sendEmails && emailField && result.certificateIds.length > 0) {
      setStep('emailing');
      const emailResultsList: EmailResult[] = [];
      const rowsWithEmail = rows.filter(row => {
        const email = row[emailField];
        return email && typeof email === 'string' && email.includes('@');
      });
      
      setEmailProgress({ current: 0, total: rowsWithEmail.length });

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const email = row[emailField];
        const recipientName = String(row[nameField] || `Recipient ${i + 1}`);
        const certificateId = result.certificateIds[i];
        
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
            error: 'Certificate generation failed',
          });
          continue;
        }

        try {
          const pdfBlob = result.certificatePdfBlobs.get(certificateId);
          let certificatePdfBase64: string | undefined;
          
          if (pdfBlob) {
            const arrayBuffer = await pdfBlob.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            let binary = '';
            for (let j = 0; j < bytes.byteLength; j++) {
              binary += String.fromCharCode(bytes[j]);
            }
            certificatePdfBase64 = btoa(binary);
          }
          
          const response = await fetch('/api/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: email,
              recipientName,
              certificateId,
              certificateTitle: certificateMetadata.title || 'Certificate of Completion',
              issuerName: certificateMetadata.issuedBy || user?.name || 'Serenity',
              userId: user?.id,
              certificatePdfBase64,
            }),
          });

          const data = await response.json();
          
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

        setEmailProgress(prev => ({ ...prev, current: i + 1 }));
        setEmailResults([...emailResultsList]);
      }
      
      setEmailResults(emailResultsList);
    }

    setStep('complete');
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
    isCancelled,
    startGeneration,
    updateProgress,
    addError,
    addGeneratedId,
    complete,
    onSave,
    certificateMetadata,
    isCertificateInfoComplete,
  ]);

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
                  <div className="flex items-start gap-3 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
                    <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <p className="font-medium text-amber-600 dark:text-amber-400">
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
                  <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    <span>All {rows.length} recipients have valid email addresses</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Output Info */}
          <div className="rounded-lg border border-border p-4">
            <h4 className="mb-2 font-medium">Output</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                High-quality PDF (300 DPI)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Unique QR code verification
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
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
            <div className="flex items-start gap-3 rounded-lg bg-amber-500/10 border border-amber-500/20 p-4">
              <Info className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-600 dark:text-amber-400">Certificate Info Required</p>
                <p className="text-muted-foreground mt-1">
                  Please fill in the Certificate Information (Title, Issued By, Description) 
                  before generating certificates. Click the <strong>Info</strong> button in the toolbar.
                </p>
              </div>
            </div>
          )}

          {/* Free Tier Limit Warning */}
          {!premiumCheck.loading && !premiumCheck.canGenerate && (
            <div className="rounded-lg border-2 border-amber-500/50 bg-gradient-to-br from-amber-500/10 to-orange-500/10 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20">
                  <Crown className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <h4 className="font-bold text-foreground">Free Limit Reached</h4>
                  <p className="text-sm text-muted-foreground">You&apos;ve used all 5 free certificate generations</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Upgrade to <strong className="text-amber-600 dark:text-amber-400">Premium</strong> for unlimited certificate generation and email delivery (up to 300/day).
              </p>
              <Link
                href="/premium"
                className="flex items-center justify-center gap-2 w-full rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 transition-opacity"
              >
                <Crown className="h-4 w-4" />
                Upgrade to Premium — $25 Lifetime
              </Link>
            </div>
          )}

          {/* Free Tier Remaining Info */}
          {!premiumCheck.loading && premiumCheck.canGenerate && !premiumCheck.isPremium && (
            <div className="flex items-center gap-2 rounded-lg bg-blue-500/10 border border-blue-500/20 p-3">
              <Info className="h-4 w-4 text-blue-500 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Free plan: <strong>{premiumCheck.remaining}</strong> generation{premiumCheck.remaining !== 1 ? 's' : ''} remaining.{' '}
                <Link href="/premium" className="text-primary hover:underline font-medium">Upgrade for unlimited</Link>
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
                <><Lock className="mr-2 h-4 w-4" /> Upgrade Required</>
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
          {/* Success/Partial Success */}
          <div className="text-center">
            {errors.length === 0 ? (
              <>
                <div className="mx-auto mb-3 sm:mb-4 flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-green-500/20">
                  <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-500" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold">All Done!</h3>
                <p className="mt-1 sm:mt-2 text-sm text-muted-foreground">
                  Successfully generated {generatedIds.length} certificates
                </p>
              </>
            ) : (
              <>
                <div className="mx-auto mb-3 sm:mb-4 flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-yellow-500/20">
                  <AlertCircle className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-500" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold">Completed with Errors</h3>
                <p className="mt-1 sm:mt-2 text-sm text-muted-foreground">
                  Generated {generatedIds.length} of {total} certificates
                </p>
                <p className="text-xs sm:text-sm text-red-500">
                  {errors.length} errors occurred
                </p>
              </>
            )}
          </div>

          {/* Email Results Summary */}
          {emailResults.length > 0 && (
            <div className="rounded-lg border border-border p-3 sm:p-4 space-y-2 sm:space-y-3">
              <h4 className="text-sm sm:text-base font-medium flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email Delivery Results
              </h4>
              <div className="flex gap-3 sm:gap-4 text-xs sm:text-sm">
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500" />
                  <span>{emailResults.filter(r => r.success).length} sent</span>
                </div>
                <div className="flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-500" />
                  <span>{emailResults.filter(r => !r.success).length} failed</span>
                </div>
              </div>
              
              {/* Show successful emails */}
              {emailResults.filter(r => r.success).length > 0 && (
                <details className="group">
                  <summary className="text-xs font-medium text-green-600 dark:text-green-400 cursor-pointer hover:underline flex items-center gap-1">
                    <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                    View {emailResults.filter(r => r.success).length} successful emails
                  </summary>
                  <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                    {emailResults.filter(r => r.success).map((result, i) => (
                      <div key={i} className="text-xs p-2 bg-green-50 dark:bg-green-900/20 rounded flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-green-500 shrink-0" />
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
                  <summary className="text-xs font-medium text-red-600 dark:text-red-400 cursor-pointer hover:underline flex items-center gap-1">
                    <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                    View {emailResults.filter(r => !r.success).length} failed emails
                  </summary>
                  <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                    {emailResults.filter(r => !r.success).map((result, i) => (
                      <div key={i} className="text-xs p-2 bg-red-50 dark:bg-red-900/20 rounded">
                        <span className="font-medium">{result.recipientName}</span>
                        <span className="text-muted-foreground ml-1">({result.email})</span>
                        <span className="text-red-500 ml-2">- {result.error}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}

          {/* Download */}
          {resultBlob && (
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
          <div className="flex items-start gap-2 sm:gap-3 rounded-lg bg-blue-500/10 border border-blue-500/20 p-2.5 sm:p-3">
            <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground">
              The ZIP file with all certificates was automatically downloaded. 
              If someone&apos;s email failed, you can manually share their certificate from the downloaded file.
            </div>
          </div>

          {/* Close */}
          <Button variant="outline" onClick={handleClose} className="w-full">
            Close
          </Button>
        </div>
      )}
    </Modal>
  );
}
