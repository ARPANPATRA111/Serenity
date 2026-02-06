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
import { Download, FileText, Mail, CheckCircle, AlertCircle, Info, Loader2 } from 'lucide-react';

interface GenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => Promise<void> | void;
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
  }, [isOpen, headers, reset, emailColumns]);

  const isCertificateInfoComplete = certificateMetadata.title.trim() && 
    certificateMetadata.issuedBy.trim() && 
    certificateMetadata.description.trim();

  const handleGenerate = useCallback(async () => {
    if (!fabricInstance || !dataSource) return;

    if (!isCertificateInfoComplete) {
      return;
    }

    if (onSave) {
      try {
        await onSave();
      } catch (e) {
        console.warn('Failed to auto-save before generation:', e);
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

    complete();

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
      className="max-w-lg"
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

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={handleGenerate} 
              className="flex-1"
              disabled={!isCertificateInfoComplete}
            >
              Start Generation
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
        <div className="space-y-6 py-4">
          {/* Success/Partial Success */}
          <div className="text-center">
            {errors.length === 0 ? (
              <>
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
                <h3 className="text-xl font-semibold">All Done!</h3>
                <p className="mt-2 text-muted-foreground">
                  Successfully generated {generatedIds.length} certificates
                </p>
              </>
            ) : (
              <>
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/20">
                  <AlertCircle className="h-8 w-8 text-yellow-500" />
                </div>
                <h3 className="text-xl font-semibold">Completed with Errors</h3>
                <p className="mt-2 text-muted-foreground">
                  Generated {generatedIds.length} of {total} certificates
                </p>
                <p className="text-sm text-red-500">
                  {errors.length} errors occurred
                </p>
              </>
            )}
          </div>

          {/* Email Results Summary */}
          {emailResults.length > 0 && (
            <div className="rounded-lg border border-border p-4 space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email Delivery Results
              </h4>
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>{emailResults.filter(r => r.success).length} sent</span>
                </div>
                <div className="flex items-center gap-1">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span>{emailResults.filter(r => !r.success).length} failed</span>
                </div>
              </div>
              
              {/* Show failed emails */}
              {emailResults.filter(r => !r.success).length > 0 && (
                <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                  {emailResults.filter(r => !r.success).map((result, i) => (
                    <div key={i} className="text-xs p-2 bg-red-50 dark:bg-red-900/20 rounded">
                      <span className="font-medium">{result.recipientName}</span>
                      <span className="text-muted-foreground ml-1">({result.email})</span>
                      <span className="text-red-500 ml-2">- {result.error}</span>
                    </div>
                  ))}
                </div>
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
              <Download className="mr-2 h-5 w-5" />
              Re-download ZIP ({(resultBlob.size / 1024 / 1024).toFixed(1)} MB)
            </Button>
          )}

          {/* Info about auto-download */}
          <div className="flex items-start gap-3 rounded-lg bg-blue-500/10 border border-blue-500/20 p-3">
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
