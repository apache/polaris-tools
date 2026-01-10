# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

# Build stage
FROM registry.access.redhat.com/ubi9/nodejs-20-minimal:latest AS builder

# Default environment variables (can be overridden at runtime)
ENV VITE_POLARIS_API_URL=http://polaris:8181
ENV VITE_POLARIS_REALM=POLARIS
ENV VITE_OAUTH_TOKEN_URL=http://polaris:8181/api/catalog/v1/oauth/tokens
ENV VITE_POLARIS_REALM_HEADER_NAME=Polaris-Realm

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install

# Copy source code (excluding docker directory via .dockerignore)
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM registry.access.redhat.com/ubi9/nginx-126:latest

# Switch to root to configure the image
USER 0

# Copy DISCLAIMER, LICENSE, NOTICE files
COPY DISCLAIMER /DISCLAIMER
COPY LICENSE-BUNDLE /LICENSE
COPY NOTICE /NOTICE

# Override Global Nginx Config
COPY docker/nginx-global.conf /etc/nginx/nginx.conf

# Copy custom nginx configuration as template
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf.template

# Copy runtime config generation script
COPY docker/generate-config.sh /generate-config.sh

RUN chmod +x /generate-config.sh && \
    chmod -R g+w /usr/share/nginx/html /etc/nginx/conf.d

# Copy built application from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Switch to runtime user
USER 1001

# Expose port 80
EXPOSE 80

# Use the script as entrypoint to generate config.js from env vars at startup
ENTRYPOINT ["/generate-config.sh"]

