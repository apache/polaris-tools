#
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
#

source "${LIBS_DIR}/_exec.sh"

# Drop the staging repository using Nexus REST API
# The Gradle nexus-publish plugin doesn't provide a drop task, so we use the REST API directly
nexus_url="https://repository.apache.org/service/local"
drop_url="${nexus_url}/staging/bulk/drop"

# Create the JSON payload for dropping the repository
drop_payload=$(cat <<EOF
{
  "data": {
    "stagedRepositoryIds": ["${STAGING_REPOSITORY_ID}"],
    "description": "Dropping release candidate after vote failure"
  }
}
EOF
)

# Execute the drop request
if [[ ${DRY_RUN:-1} -ne 1 ]]; then
  echo "Executing: Dropping staging repository ${STAGING_REPOSITORY_ID}"
  response=$(curl -s -w "\n%{http_code}" --max-time 60 -X POST \
    -u "${NEXUS_USERNAME}:${NEXUS_PASSWORD}" \
    -H "Content-Type: application/json" \
    -d "${drop_payload}" \
    "${drop_url}")

  http_code=$(echo "$response" | tail -n1)
  response_body=$(echo "$response" | sed '$d')

  if [[ "$http_code" -ge 200 && "$http_code" -lt 300 ]]; then
    echo "✅ Successfully dropped staging repository ${STAGING_REPOSITORY_ID}"
  else
    echo "❌ Failed to drop staging repository. HTTP status: ${http_code}"
    echo "Response: ${response_body}"
    exit 1
  fi
else
  echo "Dry-run, WOULD execute: curl -X POST --max-time 60 -u \${NEXUS_USERNAME}:\${NEXUS_PASSWORD} -H 'Content-Type: application/json' -d '${drop_payload}' ${drop_url}"
fi

cat <<EOT >> "$GITHUB_STEP_SUMMARY"
## Nexus Staging Repository
✅ Staging repository \`${STAGING_REPOSITORY_ID}\` dropped successfully
EOT
