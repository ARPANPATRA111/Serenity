'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useEditorStore } from '@/store/editorStore';
import { Building, FileText, Info, AlertCircle, CheckCircle, Award } from 'lucide-react';

interface CertificateInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CertificateInfoModal({ isOpen, onClose }: CertificateInfoModalProps) {
  const { certificateMetadata, setCertificateMetadata } = useEditorStore();
  
  const [title, setTitle] = useState(certificateMetadata.title);
  const [issuedBy, setIssuedBy] = useState(certificateMetadata.issuedBy);
  const [description, setDescription] = useState(certificateMetadata.description);
  const [errors, setErrors] = useState<{ title?: string; issuedBy?: string; description?: string }>({});

  useEffect(() => {
    if (isOpen) {
      setTitle(certificateMetadata.title);
      setIssuedBy(certificateMetadata.issuedBy);
      setDescription(certificateMetadata.description);
      setErrors({});
    }
  }, [isOpen, certificateMetadata]);

  const handleSave = () => {
    const newErrors: { title?: string; issuedBy?: string; description?: string } = {};
    
    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }
    
    if (!issuedBy.trim()) {
      newErrors.issuedBy = 'Issued By is required';
    }
    
    if (!description.trim()) {
      newErrors.description = 'Description is required';
    }
    
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

  const isComplete = certificateMetadata.title.trim() && certificateMetadata.issuedBy.trim() && certificateMetadata.description.trim();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Certificate Information"
      className="max-w-md"
    >
      <div className="space-y-5">
        {}
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

        {}
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

        {}
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

        {}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium mb-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Description <span className="text-destructive">*</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => {
              const value = e.target.value.slice(0, 500);
              setDescription(value);
              if (errors.description) setErrors({ ...errors, description: undefined });
            }}
            placeholder="e.g., For successfully completing the Web Development Course"
            rows={3}
            maxLength={500}
            className={`w-full px-3 py-2 rounded-md border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary ${
              errors.description ? 'border-destructive' : 'border-border'
            }`}
          />
          <div className="flex justify-between mt-1">
            {errors.description ? (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.description}
              </p>
            ) : (
              <span />
            )}
            <span className={`text-xs ${description.length >= 450 ? 'text-amber-500' : 'text-muted-foreground'}`}>
              {description.length}/500
            </span>
          </div>
        </div>

        {}
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
              <span className="text-sm font-medium">Please fill in all required fields</span>
            </>
          )}
        </div>

        {}
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSave} className="flex-1">
            Save Information
          </Button>
        </div>
      </div>
    </Modal>
  );
}
