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

if [[ -d "${tool}/build/distributions" ]]; then
  source "${LIBS_DIR}/_constants.sh"
  source "${LIBS_DIR}/_exec.sh"

  dist_dev_dir="${RELEASEY_DIR}/polaris-dist-dev/${tool}"

  exec_process svn checkout --username "$SVN_USERNAME" --password "$SVN_PASSWORD" --non-interactive "${APACHE_DIST_URL}${APACHE_DIST_PATH}" "${dist_dev_dir}"

  version_dir="${tool}/${dist_dev_dir}/${version_without_rc}"
  exec_process mkdir -p "${version_dir}"
  exec_process cp ${tool}/build/distributions/* "${version_dir}/"

  exec_process cd "${dist_dev_dir}"
  exec_process svn add "${tool}/${version_without_rc}"
  exec_process svn commit --username "$SVN_USERNAME" --password "$SVN_PASSWORD" --non-interactive -m "Stage Apache Polaris ${tool} ${version_without_rc} RC${rc_number}"

  cat <<EOT >> $GITHUB_STEP_SUMMARY
  ## Staging to dist dev
  Artifacts staged to Apache dist dev repository
EOT

else

  cat <<EOT >> $GITHUB_STEP_SUMMARY
  ## No artifacts staged to dist dev
EOT

fi
