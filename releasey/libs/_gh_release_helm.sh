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

# Checkout the release Helm chart directory
release_artifacts_url="${APACHE_DIST_URL}/release/incubator/polaris-${tool}/${version_without_rc}"
release_helm_dir="${RELEASEY_DIR}/polaris-dist-release-helm-chart"
release_helm_url="${release_artifacts_url}/helm-charts"

exec_process svn checkout --username "$SVN_USERNAME" --password "$SVN_PASSWORD" --non-interactive "${release_helm_url}" "${release_helm_dir}"

exec_process cd "${release_helm_dir}"
find . -mindepth 1 -maxdepth 1 -type d | while read -r helm_dir; do
  chart_name="$(basename "$helm_dir")"
  exec_process cd "${chart_name}"

  exec_process helm repo index .
  exec_process svn add index.yaml

  exec_process cd "${..}"
done

exec_process svn commit --username "$SVN_USERNAME" --password "$SVN_PASSWORD" --non-interactive -m "Update Helm index for ${tool} ${version_without_rc} release"

cat <<EOT >> $GITHUB_STEP_SUMMARY
## Helm Index
Helm index updated in dist release
EOT
