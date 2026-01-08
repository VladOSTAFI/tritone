'use client';

import { useState, useCallback } from 'react';
import type { DocumentMeta } from '@/lib/types';

interface UseDocumentSignReturn {
  isSigningModalOpen: boolean;
  openSigningModal: () => void;
  closeSigningModal: () => void;
  handleSign: (signatureDataUrl: string) => Promise<void>;
}

export function useDocumentSign(
  onMetaUpdate: (meta: DocumentMeta) => void
): UseDocumentSignReturn {
  const [isSigningModalOpen, setIsSigningModalOpen] = useState<boolean>(false);

  const openSigningModal = useCallback(() => {
    setIsSigningModalOpen(true);
  }, []);

  const closeSigningModal = useCallback(() => {
    setIsSigningModalOpen(false);
  }, []);

  const handleSign = useCallback(
    async (signatureDataUrl: string) => {
      const response = await fetch('/api/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureDataUrl }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to sign document');
      }

      const data = await response.json();
      onMetaUpdate(data.meta);
      setIsSigningModalOpen(false);
    },
    [onMetaUpdate]
  );

  return {
    isSigningModalOpen,
    openSigningModal,
    closeSigningModal,
    handleSign,
  };
}
