#!/bin/sh
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

# Copy nginx configuration (no substitution needed since we use direct API calls)
cp /opt/app-root/etc/nginx.d/default.conf.template /opt/app-root/etc/nginx.d/default.conf

echo "Configured nginx for static file serving"

# Generate runtime configuration from environment variables
cat > /opt/app-root/src/config.js << EOF
// Runtime configuration generated from environment variables
window.APP_CONFIG = {
  VITE_POLARIS_API_URL: '${VITE_POLARIS_API_URL}',
  VITE_POLARIS_REALM: '${VITE_POLARIS_REALM}',
  VITE_POLARIS_PRINCIPAL_SCOPE: '${VITE_POLARIS_PRINCIPAL_SCOPE}',
  VITE_OAUTH_TOKEN_URL: '${VITE_OAUTH_TOKEN_URL}',
  VITE_POLARIS_REALM_HEADER_NAME: '${VITE_POLARIS_REALM_HEADER_NAME}',
  VITE_OIDC_ISSUER_URL: '${VITE_OIDC_ISSUER_URL}',
  VITE_OIDC_CLIENT_ID: '${VITE_OIDC_CLIENT_ID}',
  VITE_OIDC_REDIRECT_URI: '${VITE_OIDC_REDIRECT_URI}',
  VITE_OIDC_SCOPE: '${VITE_OIDC_SCOPE}'
};
EOF

echo "Generated config.js with runtime configuration:"
cat /opt/app-root/src/config.js

# Start nginx
exec nginx -g 'daemon off;'

