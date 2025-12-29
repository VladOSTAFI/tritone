export type DocumentStatus = 'empty' | 'uploaded' | 'converted' | 'signed' | 'failed';

export interface SignatureField {
  page: number;
  xN: number;  // Normalized x position (0-1)
  yN: number;  // Normalized y position (0-1)
  wN: number;  // Normalized width (0-1)
  hN: number;  // Normalized height (0-1)
}

export interface DocumentMeta {
  status: DocumentStatus;
  createdAt: string | null;
  originalDocxPath: string | null;
  previewPdfPath: string | null;
  signedPdfPath: string | null;
  signatureField: SignatureField | null;
  lastError: string | null;
}

export const DEFAULT_META: DocumentMeta = {
  status: 'empty',
  createdAt: null,
  originalDocxPath: null,
  previewPdfPath: null,
  signedPdfPath: null,
  signatureField: null,
  lastError: null,
};
