import React, { useState, useEffect, useRef } from 'react';
import { Upload, Trash2, FileText, AlertCircle, Loader2 } from 'lucide-react';

interface StoredDocument {
  id: string;
  name: string;
  extension: string;
  sizeBytes: number;
  size: string;
  originalPath: string;
  uploadedAt: string;
  status: 'indexed' | 'processing' | 'failed';
  extractedTextLength: number;
  chunkCount: number;
  error?: string;
}

export const KnowledgeBaseModule: React.FC = () => {
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/rag/documents');
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleUploadFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setStatusMessage({ text: `Uploading and indexing ${files.length} document(s)...` });

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            const commaIdx = result.indexOf(',');
            resolve(commaIdx !== -1 ? result.slice(commaIdx + 1) : result);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const res = await fetch('/api/rag/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            fileData: base64Data
          })
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          setStatusMessage({
            text: `Failed to index "${file.name}": ${data.error || 'Extraction error'}`,
            isError: true
          });
        }
      } catch (err: any) {
        setStatusMessage({
          text: `Error processing "${file.name}": ${err.message}`,
          isError: true
        });
      }
    }

    await fetchDocuments();
    setIsUploading(false);
    setTimeout(() => {
      setStatusMessage(null);
    }, 4000);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (docId: string) => {
    try {
      const res = await fetch(`/api/rag/documents/${docId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setDocuments(prev => prev.filter(d => d.id !== docId));
        setConfirmDeleteId(null);
      } else {
        const data = await res.json().catch(() => ({}));
        setStatusMessage({
          text: data.error || 'Failed to delete document',
          isError: true
        });
        setTimeout(() => setStatusMessage(null), 3500);
      }
    } catch (err: any) {
      setStatusMessage({ text: `Delete failed: ${err.message}`, isError: true });
      setTimeout(() => setStatusMessage(null), 3500);
    }
  };

  return (
    <div
      className={`h-full flex flex-col bg-[#080808] text-[#F5F4F1] font-sans p-8 overflow-y-auto select-none transition-colors ${
        isDragging ? 'bg-[#12100d] ring-2 ring-[#c4a47c]/40 ring-inset' : ''
      }`}
      onDragOver={e => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={e => {
        e.preventDefault();
        setIsDragging(false);
      }}
      onDrop={e => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleUploadFiles(e.dataTransfer.files);
        }
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.pptx,.xlsx,.csv,.txt,.md"
        onChange={e => e.target.files && handleUploadFiles(e.target.files)}
        className="hidden"
      />

      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-6 border-b border-[#222222] shrink-0">
        <h1 className="text-xl font-medium tracking-tight text-[#F5F4F1]">
          Knowledge Base
        </h1>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="px-4 py-2 rounded-xl bg-[#c4a47c] hover:bg-[#b89569] text-[#141414] font-medium text-xs flex items-center space-x-2 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
        >
          {isUploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Upload className="w-3.5 h-3.5" />
          )}
          <span>Upload Document</span>
        </button>
      </div>

      {/* Minimal Processing & Status Notification */}
      {statusMessage && (
        <div
          className={`mt-4 p-3 rounded-xl border text-xs font-mono flex items-center space-x-2 shrink-0 ${
            statusMessage.isError
              ? 'bg-red-950/40 border-red-900/60 text-red-300'
              : 'bg-[#141414] border-[#303030] text-[#c4a47c]'
          }`}
        >
          {statusMessage.isError ? (
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          ) : (
            <Loader2 className="w-4 h-4 shrink-0 animate-spin text-[#c4a47c]" />
          )}
          <span className="truncate">{statusMessage.text}</span>
        </div>
      )}

      {/* Main Content Area */}
      <div className="mt-6 flex-1">
        {isLoading ? (
          <div className="py-20 text-center text-xs text-[#6e6e6e] font-mono">
            Loading documents...
          </div>
        ) : documents.length === 0 ? (
          <div className="py-24 text-center text-xs text-[#6e6e6e] font-sans">
            No documents uploaded.
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map(doc => {
              const extClean = (doc.extension || '').replace('.', '').toUpperCase() || 'FILE';
              const isConfirming = confirmDeleteId === doc.id;

              return (
                <div
                  key={doc.id}
                  className="p-3.5 rounded-xl bg-[#121212] border border-[#222222] hover:border-[#333333] flex items-center justify-between transition-colors"
                >
                  {/* Document Information */}
                  <div className="flex items-center space-x-3 min-w-0 pr-4">
                    <div className="w-8 h-8 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-[#c4a47c]" />
                    </div>

                    <div className="min-w-0">
                      <div className="text-xs font-medium text-[#F5F4F1] truncate">
                        {doc.name}
                      </div>
                      <div className="text-[11px] text-[#737373] space-x-2 pt-0.5">
                        <span className="font-mono">{extClean}</span>
                        <span>•</span>
                        <span>
                          {new Date(doc.uploadedAt).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                        {doc.status === 'failed' && (
                          <>
                            <span>•</span>
                            <span className="text-red-400 font-mono text-[10px]">
                              {doc.error || 'Failed'}
                            </span>
                          </>
                        )}
                        {doc.status === 'processing' && (
                          <>
                            <span>•</span>
                            <span className="text-[#c4a47c] font-mono text-[10px]">
                              Processing...
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Delete Action with Confirmation */}
                  <div className="shrink-0 flex items-center space-x-2">
                    {isConfirming ? (
                      <div className="flex items-center space-x-1.5 text-xs">
                        <span className="text-[11px] text-[#9c9c9c] pr-1">Delete?</span>
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="px-2 py-1 rounded bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-800 text-[11px] transition-colors cursor-pointer"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1 rounded bg-[#202020] hover:bg-[#282828] text-[#cccccc] text-[11px] transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(doc.id)}
                        title="Delete Document"
                        className="p-1.5 rounded-lg text-[#6e6e6e] hover:text-red-400 hover:bg-[#1f1f1f] transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
