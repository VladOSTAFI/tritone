'use client';

import { useState } from 'react';
import { DocumentPreview } from '@/components/DocumentPreview';
import { SignatureModal } from '@/components/SignatureModal';
import { usePdfPreview } from '@/hooks/usePdfPreview';
import { useTemporarySignature } from '@/hooks/useTemporarySignature';
import { useDocumentContext } from '@/contexts/DocumentContext';

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export default function Home() {
  const { meta, updateMeta, resetMeta } = useDocumentContext();

  // File upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
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
    retryAttempt,
    maxRetries,
  } = usePdfPreview({ documentStatus: meta.status });

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
  } = useTemporarySignature();

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

      // Update metadata on frontend
      updateMeta({
        status: 'converted',
        createdAt: new Date().toISOString(),
        originalDocxPath: result.originalDocxUrl,
        previewPdfPath: result.previewPdfUrl,
        signedPdfPath: null,
        signatureField: null,
        lastError: null,
      });

      setUploadStatus('success');
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Upload failed');

      // Update metadata with error
      updateMeta({
        ...meta,
        status: 'failed',
        lastError: error instanceof Error ? error.message : 'Upload failed',
      });
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

      // Reset all client state
      resetMeta();
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
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 md:px-8 md:py-12">
      {/* Page Title */}
      <div className="text-center">
        <h1 className="mb-3 text-4xl font-bold tracking-tight text-gray-900 md:text-5xl">Tritone</h1>
        <p className="text-lg text-gray-600">
          Upload, preview, sign, and download your documents
        </p>
      </div>

      {/* Section 1: Upload DOCX */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md md:p-8">
        <h2 className="mb-5 text-2xl font-semibold text-gray-900">1. Upload DOCX</h2>
        <div className="space-y-4">
          {/* File Input Area */}
          <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-6 transition-colors hover:border-blue-400 hover:bg-blue-50/50">
            <input
              type="file"
              accept=".docx"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-700 file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-blue-600 file:px-5 file:py-2.5 file:text-sm file:font-semibold file:text-white file:shadow-sm file:transition-all hover:file:bg-blue-700 hover:file:shadow-md focus:outline-none"
            />
          </div>

          {uploadedFile && (
            <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-3">
              <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-sm font-medium text-blue-900">
                {uploadedFile.name}
              </span>
            </div>
          )}

          <button
            onClick={handleUploadClick}
            disabled={!uploadedFile || uploadStatus === 'uploading'}
            className="w-full rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none sm:w-auto"
          >
            {uploadStatus === 'uploading' ? 'Uploading...' : 'Upload Document'}
          </button>

          {/* Status Badge */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Status:</span>
            {uploadStatus === 'idle' && meta.status === 'empty' && (
              <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                Idle
              </span>
            )}
            {uploadStatus === 'uploading' && (
              <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
                <svg className="mr-1.5 h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Uploading...
              </span>
            )}
            {meta.status === 'converted' && (
              <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
                ✓ Converted
              </span>
            )}
            {meta.status === 'signed' && (
              <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
                ✓ Signed
              </span>
            )}
            {meta.status === 'failed' && (
              <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-800">
                ✕ Failed
              </span>
            )}
            {uploadStatus === 'error' && meta.status === 'empty' && (
              <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-800">
                ✕ Error
              </span>
            )}
          </div>

          {/* Error Messages */}
          {errorMessage && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <div className="flex items-start gap-2">
                <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>{errorMessage}</span>
              </div>
            </div>
          )}
          {meta.status === 'failed' && meta.lastError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <div className="flex items-start gap-2">
                <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>{meta.lastError}</span>
              </div>
            </div>
          )}

          {meta.createdAt && meta.status !== 'empty' && (
            <div className="text-xs text-gray-500">
              Uploaded: {new Date(meta.createdAt).toLocaleString()}
            </div>
          )}

          {meta.status !== 'empty' && (
            <button
              onClick={handleClearDocument}
              className="mt-2 rounded-lg bg-red-600 px-5 py-2.5 font-semibold text-white shadow-sm transition-all hover:bg-red-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              Clear Document
            </button>
          )}
        </div>
      </section>

      {/* Section 2: Preview */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md md:p-8">
        <h2 className="mb-5 text-2xl font-semibold text-gray-900">2. Preview</h2>
        {(meta.status === 'converted' || meta.status === 'signed') && (
          <div className="mb-5">
            <a
              href="/api/download?type=preview"
              download="preview.pdf"
              className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 transition-colors hover:text-blue-800"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
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
          retryAttempt={retryAttempt}
          maxRetries={maxRetries}
        />
      </section>

      {/* Section 3: Signature Controls */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md md:p-8">
        <h2 className="mb-5 text-2xl font-semibold text-gray-900">3. Signature Controls</h2>

        {temporarySignature ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-blue-50 p-4">
              <p className="text-sm font-medium text-blue-900">
                Signature placed. Drag to reposition or use the controls below.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={openModalForRedraw}
                className="rounded-lg bg-gray-600 px-5 py-2.5 font-semibold text-white shadow-sm transition-all hover:bg-gray-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Redraw Signature
              </button>

              <button
                onClick={deleteSignature}
                className="rounded-lg bg-red-600 px-5 py-2.5 font-semibold text-white shadow-sm transition-all hover:bg-red-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                Delete Signature
              </button>

              <button
                onClick={handleFinalizeSignature}
                className="rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Finalize Signature
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-6 text-center">
            <svg className="mx-auto mb-3 h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <p className="text-sm font-medium text-gray-700">
              Click on the document preview above to place your signature.
            </p>
            {meta.status !== 'converted' && (
              <p className="mt-2 text-xs text-gray-500">
                (Upload and convert a document first)
              </p>
            )}
          </div>
        )}
      </section>

      {/* Section 4: Downloads */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md md:p-8">
        <h2 className="mb-5 text-2xl font-semibold text-gray-900">4. Downloads</h2>
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              onClick={() => handleDownload('preview')}
              disabled={
                meta.status !== 'converted' && meta.status !== 'signed'
              }
              className={`inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 font-semibold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                meta.status === 'converted' || meta.status === 'signed'
                  ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md focus:ring-blue-500'
                  : 'cursor-not-allowed bg-gray-200 text-gray-400 shadow-none'
              }`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download Preview PDF
            </button>
            {meta.status !== 'converted' && meta.status !== 'signed' && (
              <span className="text-xs text-gray-500">
                (Upload and convert a document first)
              </span>
            )}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              onClick={() => handleDownload('signed')}
              disabled={meta.status !== 'signed'}
              className={`inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 font-semibold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                meta.status === 'signed'
                  ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md focus:ring-blue-500'
                  : 'cursor-not-allowed bg-gray-200 text-gray-400 shadow-none'
              }`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Download Signed PDF
            </button>
            {meta.status !== 'signed' && (
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
