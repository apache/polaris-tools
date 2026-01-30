<!--
  Licensed to the Apache Software Foundation (ASF) under one
  or more contributor license agreements.  See the NOTICE file
  distributed with this work for additional information
  regarding copyright ownership.  The ASF licenses this file
  to you under the Apache License, Version 2.0 (the
  "License"); you may not use this file except in compliance
  with the License.  You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing,
  software distributed under the License is distributed on an
  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
  KIND, either express or implied.  See the License for the
  specific language governing permissions and limitations
  under the License.
-->

# Apache Polaris Console

Apache Polaris Console is a React-based web application for managing Apache Polaris catalogs and resources.

## Prerequisites

- Node.js 22.12.0 (exact version recommended for reproducible builds)
- npm 10.x or later
- [Devbox](https://www.jetify.com/devbox) (optional, for reproducible builds)

## Getting Started

### Development

1. Install dependencies:

```bash
npm ci
```

2. Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173`.

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Reproducible Builds

For Apache releases and verification purposes, we use [Devbox](https://www.jetify.com/devbox) to ensure reproducible builds.

### Prerequisites

Install Devbox:

```bash
curl -fsSL https://get.jetify.com/devbox | bash
```

### Creating a Reproducible Build

```bash
make build-reproducible
```

### Verifying Reproducibility

To verify that builds are reproducible (builds twice and compares checksums):

```bash
make verify-reproducible
```

This command will:
1. Build the project
2. Create a tarball of the `dist` directory
3. Clean and rebuild
4. Create another tarball
5. Compare SHA256 checksums
6. Report if builds are identical

### Using Devbox Directly

```bash
# Enter devbox shell with exact Node.js version
devbox shell

# Or run commands directly
devbox run build
devbox run dev
devbox run lint
```

## Docker

### Building the Docker Image

```bash
make docker-build
```

### Running the Docker Container

```bash
make docker-run
```

The application will be available at `http://localhost:8080`.

### Custom Polaris Host

```bash
make docker-build POLARIS_HOST=http://your-polaris-host:8181
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `POLARIS_API_BASE_URL` | Polaris API base URL | `http://localhost:8181` |

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run lint` | Run ESLint |
| `npm run format` | Check code formatting |
| `npm run preview` | Preview production build |

## Makefile Targets

| Target | Description |
|--------|-------------|
| `make install` | Install dependencies using npm ci |
| `make build` | Build the application |
| `make dev` | Start development server |
| `make lint` | Run linter |
| `make build-reproducible` | Build using devbox for reproducibility |
| `make verify-reproducible` | Verify builds are reproducible |
| `make docker-build` | Build Docker image |
| `make docker-run` | Run Docker container |
| `make clean` | Clean build artifacts |

## Project Structure

```
console/
├── src/
│   ├── api/          # API clients
│   ├── components/   # React components
│   ├── hooks/        # Custom React hooks
│   ├── lib/          # Utility functions
│   ├── pages/        # Route pages
│   └── routes/       # TanStack Router routes
├── docker/           # Docker configuration
├── devbox.json       # Devbox configuration for reproducible builds
├── Makefile          # Build automation
└── vite.config.ts    # Vite configuration
```

## License

Licensed under the Apache License, Version 2.0.
