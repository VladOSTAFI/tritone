# Tritone

A Next.js document signing MVP with automatic DOCX to PDF conversion using external conversion service.

## Features

- Upload DOCX files (max 15MB)
- Automatic conversion to PDF using external conversion service
- Interactive signature placement
- Download preview and signed PDFs
- Single active document workflow

## Getting Started

**Prerequisites:**

- Node.js 20+
- pnpm

**Steps:**

1. Install dependencies:

```bash
pnpm install
```

2. Configure environment variables:

Create a `.env.local` file with required configuration:

```bash
cp .env.example .env.local
```

**Required:** Set `BLOB_READ_WRITE_TOKEN` for Vercel Blob Storage (see Environment Variables section below)

3. Run the development server:

```bash
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Environment Variables

Configuration via `.env.local`:

**Required:**

- `BLOB_READ_WRITE_TOKEN` - Vercel Blob Storage token
  - Get from: https://vercel.com/dashboard/stores
  - Create a new Blob Store and copy the token

**Optional:**

- `CONVERSION_SERVICE_URL` - URL of document conversion service (default: production GCP service)
- `PDF_CONVERSION_TIMEOUT_MS` - Timeout in milliseconds (default: 60000)

## How It Works

1. Upload a .docx file (max 15MB)
2. Backend converts to PDF via external service (~1-5 seconds)
3. Download preview PDF
4. Place signature by clicking on document preview
5. Sign the document with your name
6. Download signed PDF

## Storage

The application uses **Vercel Blob Storage** to store document files:

- Original DOCX files
- Converted PDF previews
- Signed PDFs with signatures
- Document metadata

This approach ensures:

- Compatibility with Vercel's serverless deployment
- No ephemeral filesystem issues
- Automatic scalability and redundancy
- Public access to blob URLs for downloads

For detailed migration information, see [BLOB_STORAGE_MIGRATION.md](./BLOB_STORAGE_MIGRATION.md).

### Available Scripts

- `pnpm run dev` - Start development server with Turbopack
- `pnpm run build` - Build for production
- `pnpm run start` - Start production server
- `pnpm run lint` - Run ESLint
- `pnpm run format` - Format code with Prettier

## Project Structure

```
tritone/
├── src/
│   ├── app/
│   │   ├── layout.tsx    # Root layout
│   │   ├── page.tsx      # Home page
│   │   └── globals.css   # Global styles
│   └── lib/              # Utility functions
├── .env.example          # Environment variables template
├── .prettierrc.json      # Prettier configuration
├── eslint.config.mjs     # ESLint configuration
├── tailwind.config.ts    # Tailwind configuration
├── tsconfig.json         # TypeScript configuration
└── next.config.ts        # Next.js configuration
```

## Tech Stack

- **Framework:** Next.js 16.1 (App Router)
- **Language:** TypeScript
- **Styling:** TailwindCSS
- **Linting:** ESLint
- **Formatting:** Prettier
- **Package Manager:** pnpm

## Path Aliases

This project uses `@/*` as a path alias for the `src/` directory.

Example:

```typescript
import { myUtil } from '@/lib/myUtil';
```
