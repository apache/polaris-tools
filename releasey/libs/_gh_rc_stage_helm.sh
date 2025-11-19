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

dist_dev_dir=${RELEASEY_DIR}/polaris-tools-dist-dev
helm_base_dir="${dist_dev_dir}/${version_without_rc}/helm-charts"
exec_process svn checkout --username "$SVN_USERNAME" --password "$SVN_PASSWORD" --non-interactive "${APACHE_DIST_URL}${APACHE_DIST_PATH}" "${dist_dev_dir}"

exec_process cd helm

find . -mindepth 1 -maxdepth 1 -type d | while read -r helm_dir; do
  chart_name="$(basename "$helm_dir")"
  exec_process cd "${chart_name}"

  exec_process mkdir -p "${helm_base_dir}/${chart_name}"
  exec_process cp helm/polaris-${version_without_rc}.tgz* "${helm_base_dir}/${chart_name}"

  exec_process cd "${helm_base_dir}/${chart_name}"
  exec_process helm repo index .

  exec_process cd ..
done

exec_process cd "${dist_dev_dir}"
exec_process svn add "${version_without_rc}/helm-charts"

exec_process svn commit --username "$SVN_USERNAME" --password "$SVN_PASSWORD" --non-interactive -m "Stage Apache Polaris ${tool} Helm chart(s) ${version_without_rc} RC${rc_number}"

echo "## Helm Chart Summary" >> $GITHUB_STEP_SUMMARY
cat <<EOT >> $GITHUB_STEP_SUMMARY
🎉 Helm chart built and staged successfully:

| Component | Status |
| --- | --- |
| Helm package | ✅ Created and signed |
| Apache dist dev repository | ✅ Staged |
EOT
