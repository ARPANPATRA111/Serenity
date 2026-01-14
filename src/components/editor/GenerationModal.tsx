'use client';

/**
 * Generation Modal
 * 
 * Handles the batch generation process with progress tracking.
 */

import { useState, useCallback, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ProgressBar, GenerationProgress } from '@/components/ui/ProgressBar';
import { useFabricContext } from './FabricContext';
import { useDataSourceStore } from '@/store/dataSourceStore';
import { useGenerationStore } from '@/store/generationStore';
import { useEditorStore } from '@/store/editorStore';
import { useAuth } from '@/contexts/AuthContext';
import { generateBatch, downloadZip } from '@/lib/generator';
import { Download, FileText, Mail, CheckCircle, AlertCircle } from 'lucide-react';

interface GenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => Promise<void> | void;
}

type GenerationStep = 'configure' | 'generating' | 'complete';

export function GenerationModal({ isOpen, onClose, onSave }: GenerationModalProps) {
  const { fabricInstance } = useFabricContext();
  const { dataSource, headers, rows } = useDataSourceStore();
  const { templateId, templateName } = useEditorStore();
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
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('configure');
      reset();
      setResultBlob(null);
      if (headers.length > 0 && !nameField) {
        // Try to find a "name" field
        const nameColumn = headers.find((h) =>
          h.toLowerCase().includes('name')
        );
        setNameField(nameColumn || headers[0]);
      }
    }
  }, [isOpen, headers, reset]);

  const handleGenerate = useCallback(async () => {
    if (!fabricInstance || !dataSource) return;

    // Auto-save the canvas before generating
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
      issuerName: user?.name || 'Serenity',
      titleField: 'Certificate',
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
    }

    setStep('complete');
  }, [
    fabricInstance,
    dataSource,
    rows,
    nameField,
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
                ZIP archive download
              </li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleGenerate} className="flex-1">
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

          {/* Download */}
          {resultBlob && (
            <Button
              onClick={handleDownload}
              className="w-full"
              size="lg"
            >
              <Download className="mr-2 h-5 w-5" />
              Download ZIP ({(resultBlob.size / 1024 / 1024).toFixed(1)} MB)
            </Button>
          )}

          {/* Email Option */}
          <div className="rounded-lg border border-dashed border-border p-4 text-center">
            <Mail className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-medium">Want to email certificates?</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Coming soon with Serenity Pro
            </p>
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
