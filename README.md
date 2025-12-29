# Tritone

A Next.js MVP project with TypeScript, TailwindCSS, ESLint, and Prettier.

## Getting Started

### Installation

Install dependencies:

```bash
pnpm install
```

### Development

Run the development server:

```bash
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

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
