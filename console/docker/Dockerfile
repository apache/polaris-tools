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
FROM registry.access.redhat.com/ubi9/nodejs-22-minimal:9.7-1767673763 AS builder

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
FROM registry.access.redhat.com/ubi9/nginx-126:9.7-1767846422

# Copy DISCLAIMER, LICENSE, NOTICE files
COPY DISCLAIMER /DISCLAIMER
COPY LICENSE-BUNDLE /LICENSE
COPY NOTICE /NOTICE

# Copy custom nginx configuration as template
COPY docker/nginx.conf /etc/nginx/templates/default.conf.template

# Copy built application from builder stage
COPY --from=builder /app/dist /opt/app-root/src
# Expose port 80
EXPOSE 80

# Start nginx
CMD ["/bin/sh", "-c", "/etc/nginx/templates/default.conf.template > /opt/app-root/etc/nginx.d/default.conf && nginx -g 'daemon off;'"]

