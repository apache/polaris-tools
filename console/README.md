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

# Polaris Console 

A modern web interface for Apache Polaris, built with React, TypeScript, TanStack Query, and Tailwind CSS.

## Getting Started

### Prerequisites
- Node.js 20.19+ (or 22.12+) and npm (or yarn)

### Installation

```bash
# Install dependencies
make install

# Start development server
make dev

# Build for production
make build
```

### Environment Variables

Create a `.env` file based on `.env.example`:

```env
VITE_POLARIS_API_URL=http://localhost:8181
VITE_POLARIS_REALM=POLARIS
VITE_POLARIS_PRINCIPAL_SCOPE=PRINCIPAL_ROLE:ALL
VITE_POLARIS_REALM_HEADER_NAME=Polaris-Realm  # optional, defaults to "Polaris-Realm"
VITE_OAUTH_TOKEN_URL=http://localhost:8181/api/v1/oauth/tokens  # optional
```

### Server-Side CORS Configuration

The console makes direct API calls to the Polaris server. Configure CORS on your Polaris server (Quarkus-based).

#### Option 1: Using application.properties

Add to your Polaris `application.properties` file:

```properties
quarkus.http.cors.enabled=true
quarkus.http.cors.origins=http://localhost:5173,https://your-console-domain.com
quarkus.http.cors.methods=GET,POST,PUT,DELETE,PATCH,OPTIONS
quarkus.http.cors.headers=Content-Type,Authorization,Polaris-Realm
quarkus.http.cors.exposed-headers=*
quarkus.http.cors.access-control-allow-credentials=true
quarkus.http.cors.access-control-max-age=PT10M
```

#### Option 2: Using Environment Variables

Set these environment variables:

```bash
QUARKUS_HTTP_CORS_ENABLED=true
QUARKUS_HTTP_CORS_ORIGINS=http://localhost:5173,https://your-console-domain.com
QUARKUS_HTTP_CORS_METHODS=GET,POST,PUT,DELETE,PATCH,OPTIONS
QUARKUS_HTTP_CORS_HEADERS=Content-Type,Authorization,Polaris-Realm
QUARKUS_HTTP_CORS_EXPOSED_HEADERS=*
QUARKUS_HTTP_CORS_ACCESS_CONTROL_ALLOW_CREDENTIALS=true
QUARKUS_HTTP_CORS_ACCESS_CONTROL_MAX_AGE=PT10M
```

#### Option 3: Using Kubernetes ConfigMap

For Kubernetes/Helm deployments, create a ConfigMap:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: polaris-config
data:
  application.properties: |
    quarkus.http.cors.enabled=true
    quarkus.http.cors.origins=http://localhost:5173,https://your-console-domain.com
    quarkus.http.cors.methods=GET,POST,PUT,DELETE,PATCH,OPTIONS
    quarkus.http.cors.headers=Content-Type,Authorization,Polaris-Realm
    quarkus.http.cors.exposed-headers=*
    quarkus.http.cors.access-control-allow-credentials=true
    quarkus.http.cors.access-control-max-age=PT10M
```

Mount it in your Polaris deployment at `/deployment/config/application.properties`.

See [Quarkus CORS documentation](https://quarkus.io/guides/security-cors) for more details.

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
make dev
```

The app will be available at `http://localhost:5173`

## Building

```bash
make build
```

Output will be in the `dist/` directory.

## Production Deployment

After building, you can serve the production files in several ways:

### Quick Test
```bash
bun run preview  # or npm run preview
```

## Docker image

You can build Polaris Console docker image using:

```bash
make build-docker
```

Then, you run Polaris Console using:

```bash
docker run -p 8080:80 \
  -e VITE_POLARIS_API_URL=http://polaris:8181 \
  -e VITE_POLARIS_REALM=POLARIS \
  -e VITE_POLARIS_PRINCIPAL_SCOPE=PRINCIPAL_ROLE:ALL
  apache/polaris-console:latest
```

NB: Hopefully, the Apache Polaris official docker image will be available soon.

## K8S Deployment with Helm

You can check [the Apache Polaris documentation](https://github.com/apache/polaris/tree/main/helm/polaris) 
and start Polaris instance in `polaris` namespace via helm.

### Quick Start with Minikube

1. **Start Minikube:**
   ```bash
   minikube start
   eval $(minikube docker-env)
   ```

2. **Build the image:**
    ```bash
   make build-docker
   ```

3. **Deploy with Helm:**
   ```bash
   helm install polaris-console ./helm -n polaris
   ```

4. **Access the console:**
   ```bash
   kubectl port-forward svc/polaris-console 4000:80 -n polaris
   ```
   Open http://localhost:4000 in your browser.

### Configuration

Customize the deployment by creating a `values.yaml` file:

```yaml
env:
  polarisApiUrl: "http://polaris:8181"
  polarisRealm: "POLARIS"
  oauthTokenUrl: "http://polaris:8181/api/catalog/v1/oauth/tokens"

service:
  type: ClusterIP
  port: 80

replicaCount: 1
```

Then deploy with:
```bash
helm install polaris-console ./helm -f values.yaml -n polaris
```

### Useful Commands

```bash
# Upgrade deployment
helm upgrade polaris-console ./helm -n polaris

# Uninstall
helm uninstall polaris-console -n polaris

# View logs
kubectl logs -l app.kubernetes.io/name=polaris-console -n polaris
```
