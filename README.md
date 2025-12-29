# Tritone

A Next.js document signing MVP with automatic DOCX to PDF conversion using LibreOffice.

## Features

- Upload DOCX files (max 15MB)
- Automatic conversion to PDF using LibreOffice headless
- Interactive signature placement
- Download preview and signed PDFs
- Single active document workflow

## Getting Started

### Running with Docker (Recommended)

The easiest way to run Tritone with LibreOffice support:

```bash
docker-compose up --build
```

The app will be available at [http://localhost:3000](http://localhost:3000)

Data is persisted in the `./data` directory.

To stop the container:

```bash
docker-compose down
```

### Local Development (Alternative)

**Prerequisites:**
- Node.js 20+
- pnpm
- LibreOffice (must be in PATH)
  - macOS: `brew install libreoffice`
  - Ubuntu: `apt-get install libreoffice`
  - Windows: Download from [libreoffice.org](https://www.libreoffice.org/)

**Steps:**

1. Install dependencies:

```bash
pnpm install
```

2. Run the development server:

```bash
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## How It Works

1. Upload a .docx file (max 15MB)
2. Backend converts to PDF using LibreOffice (~5-60 seconds)
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
