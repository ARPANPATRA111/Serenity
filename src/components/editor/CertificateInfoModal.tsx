'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useEditorStore } from '@/store/editorStore';
import { Building, FileText, Info, AlertCircle, CheckCircle, Award, Eye, ExternalLink } from 'lucide-react';

interface CertificateInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CertificateInfoModal({ isOpen, onClose }: CertificateInfoModalProps) {
  const { certificateMetadata, setCertificateMetadata } = useEditorStore();
  
  const [title, setTitle] = useState(certificateMetadata.title);
  const [issuedBy, setIssuedBy] = useState(certificateMetadata.issuedBy);
  const [description, setDescription] = useState(certificateMetadata.description);
  const [errors, setErrors] = useState<{ title?: string; issuedBy?: string }>({});
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle(certificateMetadata.title);
      setIssuedBy(certificateMetadata.issuedBy);
      setDescription(certificateMetadata.description);
      setErrors({});
      setShowPreview(false);
    }
  }, [isOpen, certificateMetadata]);

  const handleSave = () => {
    const newErrors: { title?: string; issuedBy?: string } = {};
    
    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }
    
    if (!issuedBy.trim()) {
      newErrors.issuedBy = 'Issued By is required';
    }
    
    // Description is now optional
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    setCertificateMetadata({
      title: title.trim(),
      issuedBy: issuedBy.trim(),
      description: description.trim(),
    });
    
    onClose();
  };

  // Only title and issuedBy are required now
  const isComplete = certificateMetadata.title.trim() && certificateMetadata.issuedBy.trim();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Certificate Information"
      className="max-w-2xl"
    >
      <div className="space-y-5">
        {/* Toggle between Edit and Preview */}
        <div className="flex items-center gap-2 p-1 rounded-lg bg-muted">
          <button
            onClick={() => setShowPreview(false)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
              !showPreview
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="h-4 w-4" />
            Edit Info
          </button>
          <button
            onClick={() => setShowPreview(true)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
              showPreview
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Eye className="h-4 w-4" />
            Preview
          </button>
        </div>

        {showPreview ? (
          /* Verification Page Preview */
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-2 bg-muted border-b border-border flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Verification Page Preview</span>
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </div>
            <div className="p-6 bg-gradient-to-br from-background to-muted/50">
              {/* Mini verification page mockup */}
              <div className="max-w-sm mx-auto space-y-4">
                {/* Status Badge */}
                <div className="flex justify-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-success/10 text-success">
                    <CheckCircle className="h-5 w-5" />
                    <span className="text-sm font-semibold">Verified Certificate</span>
                  </div>
                </div>

                {/* Certificate Card Preview */}
                <div className="bg-card rounded-xl border border-border p-4 space-y-3">
                  {/* Certificate Image Placeholder */}
                  <div className="aspect-[1.4/1] bg-muted rounded-lg flex items-center justify-center">
                    <Award className="h-12 w-12 text-muted-foreground/50" />
                  </div>
                  
                  {/* Title */}
                  <h3 className="text-lg font-bold text-center">
                    {title.trim() || 'Certificate Title'}
                  </h3>
                  
                  {/* Recipient */}
                  <p className="text-center text-muted-foreground">
                    Issued by <span className="font-semibold text-foreground">{issuedBy || 'Issuer'}</span>
                  </p>
                  
                  {/* Description */}
                  {description.trim() && (
                    <p className="text-sm text-center text-muted-foreground">
                      {description.trim()}
                    </p>
                  )}
                  

                </div>

                {/* Info Note */}
                <p className="text-xs text-center text-muted-foreground">
                  This is how your certificate will appear on the verification page
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Edit Form */
          <>
            {/* Info banner */}
            <div className="flex items-start gap-3 rounded-lg bg-primary/10 p-4">
              <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-primary">Saved With Template</p>
                <p className="text-muted-foreground mt-1">
                  This information is saved with your template and will be applied to all
                  certificates generated from it. It will be displayed on the verification page.
                </p>
              </div>
            </div>

            {/* Title field */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-2">
                <Award className="h-4 w-4 text-muted-foreground" />
                Certificate Title <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (errors.title) setErrors({ ...errors, title: undefined });
                }}
                placeholder="e.g., Certificate of Completion, Achievement Award"
                className={`w-full h-10 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                  errors.title ? 'border-destructive' : 'border-border'
                }`}
              />
              {errors.title && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.title}
                </p>
              )}
            </div>

            {/* Issued By field */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                Issued By <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={issuedBy}
                onChange={(e) => {
                  setIssuedBy(e.target.value);
                  if (errors.issuedBy) setErrors({ ...errors, issuedBy: undefined });
                }}
                placeholder="e.g., Acme University, Tech Corp"
                className={`w-full h-10 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                  errors.issuedBy ? 'border-destructive' : 'border-border'
                }`}
              />
              {errors.issuedBy && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.issuedBy}
                </p>
              )}
            </div>

            {/* Description field (optional) */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Description <span className="text-muted-foreground text-xs">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => {
                  const value = e.target.value.slice(0, 500);
                  setDescription(value);
                }}
                placeholder="e.g., For successfully completing the Web Development Course"
                rows={3}
                maxLength={500}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="flex justify-end mt-1">
                <span className={`text-xs ${description.length >= 450 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                  {description.length}/500
                </span>
              </div>
            </div>

            {/* Status indicator */}
            <div className={`flex items-center gap-2 rounded-lg p-3 ${
              isComplete ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
            }`}>
              {isComplete ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Certificate info complete</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Please fill in the required fields</span>
                </>
              )}
            </div>
          </>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          {showPreview ? (
            <Button onClick={() => setShowPreview(false)} className="flex-1">
              Back to Edit
            </Button>
          ) : (
            <Button onClick={handleSave} className="flex-1">
              Save Information
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
