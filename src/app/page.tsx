'use client';

import { useState, useEffect } from 'react';
import type { DocumentMeta } from '@/lib/types';

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export default function Home() {
  // File upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [meta, setMeta] = useState<DocumentMeta | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Signature state
  const [isSignaturePlaced, setIsSignaturePlaced] = useState<boolean>(false);
  const [signaturePosition, setSignaturePosition] = useState<{ x: number; y: number } | null>(null);

  // Modal state
  const [isSigningModalOpen, setIsSigningModalOpen] = useState<boolean>(false);

  // Download state
  const [downloadReady, setDownloadReady] = useState<boolean>(false);

  // Load existing document status on mount
  useEffect(() => {
    fetch('/api/meta')
      .then(res => res.json())
      .then((data: DocumentMeta) => {
        setMeta(data);
        // Update UI state based on existing document
        if (data.status === 'uploaded') {
          setUploadStatus('success');
        }
      })
      .catch(error => {
        console.error('Failed to load document status:', error);
      });
  }, []);

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

  const handlePreviewClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (uploadStatus === 'success') {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setSignaturePosition({ x, y });
      setIsSignaturePlaced(true);
    }
  };

  const handleResetSignature = () => {
    setIsSignaturePlaced(false);
    setSignaturePosition(null);
  };

  const handleSignClick = () => {
    setIsSigningModalOpen(true);
  };

  const handleModalClose = () => {
    setIsSigningModalOpen(false);
    setDownloadReady(true);
  };

  const handleDownload = (type: 'preview' | 'signed') => {
    console.log(`Downloading ${type} PDF...`);
  };

  return (
    <main className="flex flex-col gap-8 px-4 md:px-8 py-12 max-w-4xl mx-auto">
      {/* Page Title */}
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Document Signing MVP</h1>
        <p className="text-base text-gray-600">Upload, preview, sign, and download your documents</p>
      </div>

      {/* Section 1: Upload DOCX */}
      <section className="rounded-lg border border-gray-200 p-6 bg-white">
        <h2 className="text-xl font-semibold mb-4">1. Upload DOCX</h2>
        <div className="space-y-3">
          <div>
            <input
              type="file"
              accept=".docx"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white file:cursor-pointer hover:file:bg-blue-700 file:transition"
            />
          </div>
          {uploadedFile && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Selected: {uploadedFile.name}</span>
            </div>
          )}
          <button
            onClick={handleUploadClick}
            disabled={!uploadedFile}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Upload Document
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Status:</span>
            {uploadStatus === 'idle' && (
              <span className="px-2 py-1 text-xs rounded bg-gray-200 text-gray-800">Idle</span>
            )}
            {uploadStatus === 'uploading' && (
              <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800">Uploading...</span>
            )}
            {uploadStatus === 'success' && (
              <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-800">Success</span>
            )}
            {uploadStatus === 'error' && (
              <span className="px-2 py-1 text-xs rounded bg-red-100 text-red-800">Error</span>
            )}
          </div>
          {errorMessage && (
            <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
              {errorMessage}
            </div>
          )}
          {meta && meta.status === 'uploaded' && meta.createdAt && (
            <div className="text-xs text-gray-500">
              Uploaded: {new Date(meta.createdAt).toLocaleString()}
            </div>
          )}
        </div>
      </section>

      {/* Section 2: Preview */}
      <section className="rounded-lg border border-gray-200 p-6 bg-white">
        <h2 className="text-xl font-semibold mb-4">2. Preview</h2>
        <div
          onClick={handlePreviewClick}
          className={`h-96 md:h-[600px] border-2 border-dashed border-gray-300 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center transition ${
            uploadStatus === 'success' ? 'cursor-pointer hover:bg-gray-300' : 'cursor-not-allowed'
          }`}
        >
          <div className="text-center">
            {uploadStatus !== 'success' ? (
              <p className="text-gray-500">Upload a document to preview</p>
            ) : (
              <div>
                <p className="text-gray-600 font-medium mb-2">Document Preview Placeholder</p>
                <p className="text-sm text-gray-500">Click anywhere to place signature</p>
                {isSignaturePlaced && signaturePosition && (
                  <div className="mt-4 text-xs text-gray-500">
                    Signature placed at ({Math.round(signaturePosition.x)}, {Math.round(signaturePosition.y)})
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Section 3: Signature Placement */}
      <section className="rounded-lg border border-gray-200 p-6 bg-white">
        <h2 className="text-xl font-semibold mb-4">3. Signature Placement</h2>
        <div className="space-y-3">
          <p className="text-sm text-gray-500">Click on preview to place signature</p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Signature Status:</span>
            {isSignaturePlaced ? (
              <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-800">Placed</span>
            ) : (
              <span className="px-2 py-1 text-xs rounded bg-gray-200 text-gray-800">Not Placed</span>
            )}
          </div>
          {isSignaturePlaced && signaturePosition && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                Position: X={Math.round(signaturePosition.x)}, Y={Math.round(signaturePosition.y)}
              </p>
              <button
                onClick={handleResetSignature}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-md transition text-sm"
              >
                Reset Signature Placement
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Section 4: Sign */}
      <section className="rounded-lg border border-gray-200 p-6 bg-white">
        <h2 className="text-xl font-semibold mb-4">4. Sign Document</h2>
        <button
          onClick={handleSignClick}
          disabled={!isSignaturePlaced}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-md transition disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Sign Document
        </button>
      </section>

      {/* Section 5: Downloads */}
      <section className="rounded-lg border border-gray-200 p-6 bg-white">
        <h2 className="text-xl font-semibold mb-4">5. Downloads</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleDownload('preview')}
              disabled={!downloadReady}
              className={`text-sm font-medium py-2 px-4 rounded-md transition ${
                downloadReady
                  ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Download Preview PDF
            </button>
            {!downloadReady && <span className="text-xs text-gray-500">(Complete signing first)</span>}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleDownload('signed')}
              disabled={!downloadReady}
              className={`text-sm font-medium py-2 px-4 rounded-md transition ${
                downloadReady
                  ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Download Signed PDF
            </button>
            {!downloadReady && <span className="text-xs text-gray-500">(Complete signing first)</span>}
          </div>
        </div>
      </section>

      {/* Modal Overlay */}
      {isSigningModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Sign Document</h3>
              <button
                onClick={handleModalClose}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              >
                &times;
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
                <input
                  type="text"
                  placeholder="Enter your name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Timestamp</label>
                <input
                  type="text"
                  value={new Date().toLocaleString()}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                />
              </div>
              <button
                onClick={handleModalClose}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition"
              >
                Complete Signature
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
