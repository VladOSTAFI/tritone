'use client';

import { useState, useCallback } from 'react';
import type { SignatureField, DocumentMeta } from '@/lib/types';

interface UseSignatureFieldReturn {
  signatureField: SignatureField | null;
  isSignaturePlaced: boolean;
  handleSignatureFieldPlace: (field: SignatureField) => Promise<void>;
  handleSignatureFieldUpdate: (field: SignatureField) => Promise<void>;
  setSignatureFieldFromMeta: (field: SignatureField | null) => void;
  error: string | null;
}

export function useSignatureField(
  onMetaUpdate: (meta: DocumentMeta) => void
): UseSignatureFieldReturn {
  const [signatureField, setSignatureField] = useState<SignatureField | null>(
    null
  );
  const [isSignaturePlaced, setIsSignaturePlaced] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignatureFieldPlace = useCallback(
    async (field: SignatureField) => {
      setError(null);
      try {
        const response = await fetch('/api/field', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(field),
        });

        if (!response.ok) throw new Error('Failed to save signature field');

        const data = await response.json();
        onMetaUpdate(data.meta);
        setSignatureField(field);
        setIsSignaturePlaced(true);
      } catch (err) {
        console.error('Failed to place signature field:', err);
        setError('Failed to place signature field');
        throw err;
      }
    },
    [onMetaUpdate]
  );

  const handleSignatureFieldUpdate = useCallback(
    async (field: SignatureField) => {
      setError(null);
      try {
        const response = await fetch('/api/field', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(field),
        });

        if (!response.ok) throw new Error('Failed to update signature field');

        const data = await response.json();
        onMetaUpdate(data.meta);
        setSignatureField(field);
      } catch (err) {
        console.error('Failed to update signature field:', err);
        setError('Failed to update signature field');
        throw err;
      }
    },
    [onMetaUpdate]
  );

  const setSignatureFieldFromMeta = useCallback(
    (field: SignatureField | null) => {
      setSignatureField(field);
      setIsSignaturePlaced(field !== null);
    },
    []
  );

  return {
    signatureField,
    isSignaturePlaced,
    handleSignatureFieldPlace,
    handleSignatureFieldUpdate,
    setSignatureFieldFromMeta,
    error,
  };
}
