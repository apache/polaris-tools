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

# Generate nginx configuration with the backend URL
envsubst '${VITE_POLARIS_API_URL}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

echo "Generated nginx config with backend: ${VITE_POLARIS_API_URL}"

# Generate runtime configuration from environment variables
cat > /usr/share/nginx/html/config.js << EOF
// Runtime configuration generated from environment variables
window.APP_CONFIG = {
  VITE_POLARIS_API_URL: '${VITE_POLARIS_API_URL}',
  VITE_POLARIS_REALM: '${VITE_POLARIS_REALM}',
  VITE_OAUTH_TOKEN_URL: '${VITE_OAUTH_TOKEN_URL}',
  VITE_POLARIS_REALM_HEADER_NAME: '${VITE_POLARIS_REALM_HEADER_NAME}'
};
EOF

echo "Generated config.js with runtime configuration:"
cat /usr/share/nginx/html/config.js

# Start nginx
exec nginx -g 'daemon off;'

