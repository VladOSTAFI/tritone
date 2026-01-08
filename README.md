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

2. (Optional) Configure environment variables:

Create a `.env.local` file if you need to customize the conversion service URL:

```bash
cp .env.example .env.local
```

3. Run the development server:

```bash
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Environment Variables

Optional configuration via `.env.local`:

- `CONVERSION_SERVICE_URL` - URL of document conversion service (default: production GCP service)
- `PDF_CONVERSION_TIMEOUT_MS` - Timeout in milliseconds (default: 60000)

## How It Works

1. Upload a .docx file (max 15MB)
2. Backend converts to PDF via external service (~1-5 seconds)
3. Download preview PDF
4. Place signature by clicking on document preview
5. Sign the document with your name
6. Download signed PDF

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
