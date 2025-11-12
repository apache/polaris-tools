# Polaris Console 

A modern web interface for Apache Polaris, built with React, TypeScript, TanStack Query, and Tailwind CSS.

## Getting Started

### Prerequisites
- Node.js 18+ and npm (or yarn)

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Environment Variables

Create a `.env` file based on `.env.example`:

```env
VITE_POLARIS_API_URL=http://localhost:8181
VITE_POLARIS_REALM=POLARIS 
VITE_OAUTH_TOKEN_URL=http://localhost:8181/api/v1/oauth/tokens  # optional
```

## Project Structure

```
src/
├── api/              # API client and endpoints
│   ├── client.ts     # Axios instance with interceptors
│   ├── auth.ts       # Authentication API
│   └── management/   # Management Service APIs
├── components/        # React components
│   ├── ui/           # Shadcn UI components
│   ├── layout/       # Layout components
│   └── forms/        # Form components
├── hooks/            # Custom React hooks
├── lib/              # Utilities
├── pages/            # Page components
├── types/            # TypeScript type definitions
└── App.tsx           # Main app component
```

## Technology Stack

- **Framework**: React 19 with TypeScript
- **Routing**: React Router v7
- **State Management**: TanStack Query (React Query)
- **Tables**: TanStack Table (React Table)
- **Styling**: Tailwind CSS
- **Components**: Shadcn UI (Radix UI primitives)
- **Forms**: React Hook Form with Zod validation
- **HTTP Client**: Axios
- **Icons**: Lucide React

## Development

The project uses:
- Vite for fast development and building
- ESLint for code linting
- TypeScript for type safety

To start developing:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Building

```bash
npm run build
```

Output will be in the `dist/` directory.

## Production Deployment

After building, you can serve the production files in several ways:

### Quick Test
```bash
bun run preview  # or npm run preview
```



