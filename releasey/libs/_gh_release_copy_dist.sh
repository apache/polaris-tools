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

echo "::add-mask::$SVN_PASSWORD"

source "${LIBS_DIR}/_constants.sh"
source "${LIBS_DIR}/_exec.sh"

# Define source and destination URLs
dev_artifacts_url="${APACHE_DIST_URL}/dev/incubator/polaris-${tool}/${version_without_rc}"
release_artifacts_url="${APACHE_DIST_URL}/release/incubator/polaris-${tool}/${version_without_rc}"

exec_process svn mv --username "$SVN_USERNAME" --password "$SVN_PASSWORD" --non-interactive \
  "${dev_artifacts_url}" "${release_artifacts_url}" \
  -m "Release Apache Polaris ${tool} ${version_without_rc}"

cat <<EOT >> $GITHUB_STEP_SUMMARY
## Distribution
Artifacts and Helm chart moved from dist dev to dist release
EOT
