'use client';

import { useCallback, useRef } from 'react';
import { useFabricContext } from './FabricContext';
import { useDataSourceStore } from '@/store/dataSourceStore';
import { useEditorStore } from '@/store/editorStore';
import { createVariableTextbox } from '@/lib/fabric';
import {
  Upload,
  FileSpreadsheet,
  X,
  ChevronLeft,
  ChevronRight,
  Variable,
} from 'lucide-react';
import { plural } from '@/lib/utils';

interface RightSidebarProps {
  onToggle?: () => void;
  onUpsell?: (feature: string) => void;
}

const SUPPORTED_EXTENSIONS = ['.xlsx', '.xls', '.csv', '.ods'];
const SPREADSHEET_LIMITS = { maxRows: 1000, maxColumns: 100 } as const;

function isSupportedFile(file: File) {
  const extension = `.${file.name.split('.').pop()?.toLowerCase() || ''}`;
  return SUPPORTED_EXTENSIONS.includes(extension);
}

export function RightSidebar({ onToggle, onUpsell }: RightSidebarProps = {}) {
  const { fabricInstance } = useFabricContext();
  const {
    rows,
    headers,
    dataSource,
    sourceFile,
    setDataSource,
    previewRowIndex,
    setPreviewRowIndex,
    isLoading,
    error,
    setLoading,
    setError,
  } = useDataSourceStore();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Toggle button handler
  const handleToggle = () => {
    if (onToggle) {
        onToggle();
    } else {
        useEditorStore.getState().setRightSidebarOpen(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isSupportedFile(file)) {
      const message = 'Please upload a valid spreadsheet (.xlsx, .xls, .csv, or .ods).';
      setError(message);
      alert(message);
      return;
    }

    try {
      setError(null);
      setLoading(true);
      const { parseSpreadsheet } = await import('@/lib/excel');
      // The first worksheet; a workbook with several offers a chooser below.
      const data = await parseSpreadsheet(file);
      if (data.rows && data.rows.length > 0) {
        setDataSource(data, file);
      } else {
        setError('This sheet has a header row but no recipients. Add one row per recipient below the headers.');
      }
    } catch (error) {
      console.error('Failed to parse file:', error);
      const message = error instanceof Error
        ? error.message
        : 'Failed to parse the file. Please check if it is a valid spreadsheet.';
      setError(message);
      alert(message);
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const chooseSheet = async (sheetName: string) => {
    if (!sourceFile || sheetName === dataSource?.sheetName) return;
    try {
      setError(null);
      setLoading(true);
      const { parseSpreadsheet } = await import('@/lib/excel');
      const data = await parseSpreadsheet(sourceFile, sheetName);
      if (data.rows.length === 0) throw new Error(`The sheet "${sheetName}" has no recipient rows.`);
      setDataSource(data, sourceFile);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'That worksheet could not be read.');
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, header: string) => {
    e.dataTransfer.setData('text/plain', header);
    e.dataTransfer.setData('variable', header); // Use specific key for variable drop
    e.dataTransfer.effectAllowed = 'copy';
  };

  const addVariableToCanvas = useCallback((header: string) => {
    // Create a special variable textbox
    // We'll implement this function in fabric utils or use the custom class
    if (!fabricInstance) return;
    
    // Check if the custom class is registered/available
    // For now, create a textbox with special styling and metadata
    const canvas = fabricInstance.getCanvas();
    if (!canvas) return;
    
    // Calculate center
    const center = canvas.getCenter();
    
    const textbox = createVariableTextbox(`{{${header}}}`, {
      left: center.left,
      top: center.top,
      fontSize: 24,
      width: 200,
      textAlign: 'center',
      dynamicKey: header,
      isPlaceholder: true,
    });
    
    canvas.add(textbox);
    canvas.setActiveObject(textbox);
    canvas.requestRenderAll();
    
  }, [fabricInstance]);

  return (
    <div className="flex h-full flex-col bg-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border p-4">
        <h2 className="font-semibold text-foreground">Data Source</h2>
        <button
          onClick={handleToggle}
          className="rounded-sm p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="Close Data Source"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center space-y-4 rounded-lg border border-dashed border-border p-8 text-center">
            <div className="rounded-full bg-muted p-3">
              <Upload className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h3 className="font-medium">Upload Data</h3>
              <p className="text-sm text-muted-foreground">
                Upload your Excel or CSV file containing recipient data.
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.ods"
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              data-roster-upload
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {isLoading ? 'Loading...' : 'Select File'}
            </button>
            <p className="text-xs text-muted-foreground">
              Import limit: up to {SPREADSHEET_LIMITS.maxRows.toLocaleString()} rows and {SPREADSHEET_LIMITS.maxColumns} columns per file.
              How many certificates you can save depends on your plan, shown when you generate.
            </p>
            {error && (
              <p className="text-xs text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-success" />
                <div className="min-w-0 text-sm">
                  <p className="font-medium">{rows.length} {plural(rows.length, 'record')}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {dataSource?.fileName ? `${dataSource.fileName}, ` : ''}{headers.length} {plural(headers.length, 'column')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setDataSource(null);
                }}
                className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-destructive"
                title="Remove Data Link in sidebar"
                aria-label="Unlink spreadsheet"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {(dataSource?.availableSheets?.length ?? 0) > 1 && (
              <div className="space-y-1">
                <label htmlFor="roster-sheet" className="text-sm font-medium text-foreground">Worksheet</label>
                <select
                  id="roster-sheet"
                  value={dataSource?.sheetName}
                  onChange={(event) => void chooseSheet(event.target.value)}
                  disabled={isLoading || !sourceFile}
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                >
                  {dataSource?.availableSheets?.map((sheet) => <option key={sheet} value={sheet}>{sheet}</option>)}
                </select>
                {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
              </div>
            )}

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-foreground">Available Variables</h3>
              <p className="text-xs text-muted-foreground">
                Drag and drop these fields onto your certificate or click to add.
              </p>
              
              <div className="grid gap-2">
                {headers.map((header) => (
                  <button
                    type="button"
                    key={header}
                    draggable
                    onDragStart={(e) => handleDragStart(e, header)}
                    onClick={() => addVariableToCanvas(header)}
                    aria-label={`Insert ${header} field`}
                    className="group flex cursor-grab items-center gap-2 rounded-md border border-border bg-background p-2 text-left transition-colors hover:border-primary hover:bg-primary/5 active:cursor-grabbing"
                  >
                    <Variable className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                    <span className="text-sm">{header}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
               <h3 className="text-sm font-medium text-foreground">Preview Data</h3>
               <div className="rounded-md border border-border bg-muted/50 p-2 text-xs font-mono">
                  <div className="flex justify-between items-center mb-2 pb-2 border-b border-border">
                     <button 
                       disabled={previewRowIndex === 0}
                       aria-label="Previous record"
                       onClick={() => setPreviewRowIndex(Math.max(0, previewRowIndex - 1))}
                       className="p-1 hover:bg-background rounded disabled:opacity-20"
                     >
                       <ChevronLeft className="h-3 w-3" />
                     </button>
                     <span aria-live="polite">Record {previewRowIndex + 1} of {rows.length}</span>
                     <button
                        disabled={previewRowIndex >= rows.length - 1}
                        aria-label="Next record"
                        onClick={() => setPreviewRowIndex(Math.min(rows.length - 1, previewRowIndex + 1))}
                        className="p-1 hover:bg-background rounded disabled:opacity-20"
                     >
                       <ChevronRight className="h-3 w-3" />
                     </button>
                  </div>
                  <div className="space-y-1">
                     {headers.map(h => (
                        <div key={h} className="flex gap-2">
                           <span className="font-semibold text-muted-foreground">{h}:</span>
                           <span className="truncate">{String((rows[previewRowIndex] as any)[h] || '')}</span>
                        </div>
                     ))}
                  </div>
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
