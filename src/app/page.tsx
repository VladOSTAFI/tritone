'use client';

import { useState, useEffect } from 'react';
import type { DocumentMeta } from '@/lib/types';
import { DocumentPreview } from '@/components/DocumentPreview';
import { SignatureModal } from '@/components/SignatureModal';
import { usePdfPreview } from '@/hooks/usePdfPreview';
import { useSignatureField } from '@/hooks/useSignatureField';
import { useDocumentSign } from '@/hooks/useDocumentSign';

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
    signatureField,
    handleSignatureFieldPlace,
    handleSignatureFieldUpdate,
    setSignatureFieldFromMeta,
    error: signatureFieldError,
  } = useSignatureField(setMeta);

  const {
    isSigningModalOpen,
    openSigningModal,
    closeSigningModal,
    handleSign,
  } = useDocumentSign(setMeta);

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

  // Sync signatureField from meta
  useEffect(() => {
    setSignatureFieldFromMeta(meta?.signatureField || null);
  }, [meta?.signatureField, setSignatureFieldFromMeta]);

  // Sync signature field error
  useEffect(() => {
    if (signatureFieldError) {
      setErrorMessage(signatureFieldError);
    }
  }, [signatureFieldError]);

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

  const handleSignatureFieldPlaceWrapper = async (
    field: Parameters<typeof handleSignatureFieldPlace>[0]
  ) => {
    try {
      await handleSignatureFieldPlace(field);
      setErrorMessage('');
    } catch (error) {
      console.error('Failed to place signature field:', error);
      setErrorMessage('Failed to place signature field');
    }
  };

  const handleSignatureFieldUpdateWrapper = async (
    field: Parameters<typeof handleSignatureFieldUpdate>[0]
  ) => {
    try {
      await handleSignatureFieldUpdate(field);
      setErrorMessage('');
    } catch (error) {
      console.error('Failed to update signature field:', error);
      setErrorMessage('Failed to update signature field');
    }
  };

  const handleSignWrapper = async (signatureDataUrl: string) => {
    try {
      await handleSign(signatureDataUrl);
      setErrorMessage('');
    } catch (error) {
      console.error('Signing error:', error);
      throw error; // Re-throw to let SignatureModal handle it
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
          signatureField={signatureField}
          pageNumber={pageNumber}
          numPages={numPages}
          onPageNumberChange={setPageNumber}
          onLoadSuccess={handleLoadSuccess}
          onLoadError={handleLoadError}
          onSignatureFieldPlace={handleSignatureFieldPlaceWrapper}
          onSignatureFieldUpdate={handleSignatureFieldUpdateWrapper}
          canPlaceSignature={meta?.status === 'converted'}
        />
      </section>

      {/* Section 3: Sign */}
      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-xl font-semibold">3. Sign Document</h2>
        <button
          onClick={openSigningModal}
          disabled={!(meta?.status === 'converted' && signatureField !== null)}
          className="rounded-md bg-blue-600 px-6 py-2 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          Sign Document
        </button>
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
        isOpen={isSigningModalOpen}
        onClose={closeSigningModal}
        onSave={handleSignWrapper}
      />
    </main>
  );
}
