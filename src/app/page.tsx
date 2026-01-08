'use client';

import { useState, useEffect } from 'react';
import type { DocumentMeta } from '@/lib/types';
import { DocumentPreview } from '@/components/DocumentPreview';
import { SignatureModal } from '@/components/SignatureModal';
import { usePdfPreview } from '@/hooks/usePdfPreview';
import { useTemporarySignature } from '@/hooks/useTemporarySignature';

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export default function Home() {
  // File upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [meta, setMeta] = useState<DocumentMeta | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Custom hooks for PDF preview and signing
  const {
    pdfBlobUrl,
    isPdfLoading,
    pdfError,
    numPages,
    pageNumber,
    setPageNumber,
    handleLoadSuccess,
    handleLoadError,
  } = usePdfPreview({ documentStatus: meta?.status || null });

  const {
    temporarySignature,
    isModalOpen,
    modalMode,
    openModalForPlacement,
    openModalForRedraw,
    closeModal,
    placeSignature,
    updateSignaturePosition,
    deleteSignature,
    finalizeSignature,
  } = useTemporarySignature(setMeta);

  // Load existing document status on mount
  useEffect(() => {
    fetch('/api/meta')
      .then((res) => res.json())
      .then((data: DocumentMeta) => {
        setMeta(data);
        // Update UI state based on existing document
        if (data.status === 'uploaded' || data.status === 'converted') {
          setUploadStatus('success');
        }
      })
      .catch((error) => {
        console.error('Failed to load document status:', error);
      });
  }, []);

  // Poll for conversion status when document is uploaded
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (meta?.status === 'uploaded') {
      interval = setInterval(async () => {
        try {
          const res = await fetch('/api/meta');
          const data = await res.json();
          setMeta(data);

          if (data.status !== 'uploaded') {
            clearInterval(interval);
          }
        } catch (error) {
          console.error('Failed to poll meta:', error);
        }
      }, 2000); // Poll every 2 seconds
    }

    return () => clearInterval(interval);
  }, [meta?.status]);

  // Event Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.name.endsWith('.docx')) {
      setUploadedFile(file);
      setErrorMessage('');
    } else {
      setUploadedFile(null);
      setErrorMessage('Only .docx files are allowed');
    }
  };

  const handleUploadClick = async () => {
    if (!uploadedFile) return;

    setUploadStatus('uploading');
    setErrorMessage('');

    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const result = await response.json();
      setUploadStatus('success');
      setMeta(result.meta);
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Upload failed');
    }
  };

  const handleDownload = (type: 'preview' | 'signed') => {
    window.open(`/api/download?type=${type}`, '_blank');
  };

  const handleFinalizeSignature = async () => {
    try {
      await finalizeSignature();
      setErrorMessage('');
    } catch (error) {
      console.error('Finalization error:', error);
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to finalize signature'
      );
    }
  };

  const handleClearDocument = async () => {
    if (
      !confirm(
        'Are you sure you want to clear all document data? This will remove all files and reset the application.'
      )
    ) {
      return;
    }

    try {
      setErrorMessage('');

      const response = await fetch('/api/clear', {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to clear document');
      }

      const result = await response.json();

      // Reset all client state
      setMeta(result.meta);
      setUploadedFile(null);
      setUploadStatus('idle');
      deleteSignature();
    } catch (error) {
      console.error('Clear error:', error);
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to clear document'
      );
    }
  };

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-12 md:px-8">
      {/* Page Title */}
      <div className="text-center">
        <h1 className="mb-2 text-3xl font-bold">Tritone</h1>
        <p className="text-base text-gray-600">
          Upload, preview, sign, and download your documents
        </p>
      </div>

      {/* Section 1: Upload DOCX */}
      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-xl font-semibold">1. Upload DOCX</h2>
        <div className="space-y-3">
          <div>
            <input
              type="file"
              accept=".docx"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-600 file:mr-4 file:cursor-pointer file:rounded-md file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white file:transition hover:file:bg-blue-700"
            />
          </div>
          {uploadedFile && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                Selected: {uploadedFile.name}
              </span>
            </div>
          )}
          <button
            onClick={handleUploadClick}
            disabled={!uploadedFile}
            className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            Upload Document
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Status:</span>
            {uploadStatus === 'idle' && (
              <span className="rounded bg-gray-200 px-2 py-1 text-xs text-gray-800">
                Idle
              </span>
            )}
            {uploadStatus === 'uploading' && (
              <span className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-800">
                Uploading...
              </span>
            )}
            {meta?.status === 'uploaded' && (
              <span className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-800">
                Converting to PDF...
              </span>
            )}
            {meta?.status === 'converted' && (
              <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-800">
                Converted
              </span>
            )}
            {meta?.status === 'signed' && (
              <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-800">
                Signed
              </span>
            )}
            {meta?.status === 'failed' && (
              <span className="rounded bg-red-100 px-2 py-1 text-xs text-red-800">
                Failed
              </span>
            )}
            {uploadStatus === 'error' && !meta && (
              <span className="rounded bg-red-100 px-2 py-1 text-xs text-red-800">
                Error
              </span>
            )}
          </div>
          {errorMessage && (
            <div className="rounded bg-red-50 p-2 text-sm text-red-600">
              {errorMessage}
            </div>
          )}
          {meta?.status === 'failed' && meta.lastError && (
            <div className="rounded bg-red-50 p-2 text-sm text-red-600">
              {meta.lastError}
            </div>
          )}
          {meta &&
            (meta.status === 'uploaded' ||
              meta.status === 'converted' ||
              meta.status === 'signed') &&
            meta.createdAt && (
              <div className="text-xs text-gray-500">
                Uploaded: {new Date(meta.createdAt).toLocaleString()}
              </div>
            )}
          {meta && meta.status !== 'empty' && (
            <button
              onClick={handleClearDocument}
              className="mt-2 rounded-md bg-red-600 px-4 py-2 font-medium text-white transition hover:bg-red-700"
            >
              Clear Document
            </button>
          )}
        </div>
      </section>

      {/* Section 2: Preview */}
      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-xl font-semibold">2. Preview</h2>
        {(meta?.status === 'converted' || meta?.status === 'signed') && (
          <div className="mb-4">
            <a
              href="/api/download?type=preview"
              download="preview.pdf"
              className="inline-block text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
            >
              Download Preview PDF
            </a>
          </div>
        )}
        <DocumentPreview
          pdfBlobUrl={pdfBlobUrl}
          isPdfLoading={isPdfLoading}
          pdfError={pdfError}
          temporarySignature={temporarySignature}
          pageNumber={pageNumber}
          numPages={numPages}
          onPageNumberChange={setPageNumber}
          onLoadSuccess={handleLoadSuccess}
          onLoadError={handleLoadError}
          onDocumentClick={openModalForPlacement}
          onSignatureUpdate={updateSignaturePosition}
        />
      </section>

      {/* Section 3: Signature Controls */}
      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-xl font-semibold">3. Signature Controls</h2>

        {temporarySignature ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Signature placed. Drag to reposition or use the controls below.
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={openModalForRedraw}
                className="rounded-md bg-gray-600 px-4 py-2 font-medium text-white transition hover:bg-gray-700"
              >
                Redraw Signature
              </button>

              <button
                onClick={deleteSignature}
                className="rounded-md bg-red-600 px-4 py-2 font-medium text-white transition hover:bg-red-700"
              >
                Delete Signature
              </button>

              <button
                onClick={handleFinalizeSignature}
                className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700"
              >
                Finalize Signature
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-500">
              Click on the document preview above to place your signature.
            </p>
            {meta?.status !== 'converted' && (
              <p className="mt-2 text-xs text-gray-400">
                (Upload and convert a document first)
              </p>
            )}
          </div>
        )}
      </section>

      {/* Section 4: Downloads */}
      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-xl font-semibold">4. Downloads</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleDownload('preview')}
              disabled={
                meta?.status !== 'converted' && meta?.status !== 'signed'
              }
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                meta?.status === 'converted' || meta?.status === 'signed'
                  ? 'cursor-pointer bg-blue-600 text-white hover:bg-blue-700'
                  : 'cursor-not-allowed bg-gray-200 text-gray-400'
              }`}
            >
              Download Preview PDF
            </button>
            {meta?.status !== 'converted' && meta?.status !== 'signed' && (
              <span className="text-xs text-gray-500">
                (Upload and convert a document first)
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleDownload('signed')}
              disabled={meta?.status !== 'signed'}
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                meta?.status === 'signed'
                  ? 'cursor-pointer bg-blue-600 text-white hover:bg-blue-700'
                  : 'cursor-not-allowed bg-gray-200 text-gray-400'
              }`}
            >
              Download Signed PDF
            </button>
            {meta?.status !== 'signed' && (
              <span className="text-xs text-gray-500">
                (Complete signing first)
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Signature Modal */}
      <SignatureModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSave={placeSignature}
        mode={modalMode}
      />
    </main>
  );
}
