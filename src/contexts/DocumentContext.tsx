'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { DocumentMeta } from '@/lib/types';
import { DEFAULT_META } from '@/lib/types';

interface DocumentContextValue {
  meta: DocumentMeta;
  updateMeta: (meta: DocumentMeta | ((prev: DocumentMeta) => DocumentMeta)) => void;
  resetMeta: () => void;
}

const DocumentContext = createContext<DocumentContextValue | undefined>(undefined);

const STORAGE_KEY = 'tritone_document_meta';

/**
 * Document Context Provider
 * Manages all document metadata on the frontend side using localStorage for persistence
 */
export function DocumentProvider({ children }: { children: React.ReactNode }) {
  const [meta, setMeta] = useState<DocumentMeta>(DEFAULT_META);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load metadata from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsedMeta = JSON.parse(stored) as DocumentMeta;
        setMeta(parsedMeta);
      }
    } catch (error) {
      console.error('Failed to load metadata from localStorage:', error);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  // Save metadata to localStorage whenever it changes
  useEffect(() => {
    if (isHydrated) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
      } catch (error) {
        console.error('Failed to save metadata to localStorage:', error);
      }
    }
  }, [meta, isHydrated]);

  const updateMeta = useCallback((newMeta: DocumentMeta | ((prev: DocumentMeta) => DocumentMeta)) => {
    if (typeof newMeta === 'function') {
      setMeta(newMeta);
    } else {
      setMeta(newMeta);
    }
  }, []);

  const resetMeta = useCallback(() => {
    setMeta(DEFAULT_META);
  }, []);

  const value: DocumentContextValue = {
    meta,
    updateMeta,
    resetMeta,
  };

  return (
    <DocumentContext.Provider value={value}>
      {children}
    </DocumentContext.Provider>
  );
}

/**
 * Hook to access document metadata context
 */
export function useDocumentContext() {
  const context = useContext(DocumentContext);
  if (!context) {
    throw new Error('useDocumentContext must be used within DocumentProvider');
  }
  return context;
}
