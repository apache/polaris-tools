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

source "${LIBS_DIR}/_constants.sh"
source "${LIBS_DIR}/_exec.sh"

# Define URLs for artifacts and Helm chart in dist dev
dev_artifacts_url="${APACHE_DIST_URL}${APACHE_DIST_PATH}/${tool}/${version_without_rc}"

# Check if artifacts directory exists and delete it
if svn ls --username "$SVN_USERNAME" --password "$SVN_PASSWORD" --non-interactive "${dev_artifacts_url}" >/dev/null 2>&1; then
  exec_process svn rm --username "$SVN_USERNAME" --password "$SVN_PASSWORD" --non-interactive \
    "${dev_artifacts_url}" \
    -m "Cancel Apache Polaris ${version_without_rc} RC${rc_number}"
  echo "✅ Deleted artifacts from ${dev_artifacts_url}" >> "$GITHUB_STEP_SUMMARY"
else
  echo "⚠️ Artifacts directory not found at ${dev_artifacts_url}" >> "$GITHUB_STEP_SUMMARY"
fi

cat <<EOT >> "$GITHUB_STEP_SUMMARY"
## Distribution Cleanup
Artifacts and Helm chart removed from dist dev repository
EOT
