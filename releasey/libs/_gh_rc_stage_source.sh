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

dist_dev_dir="${RELEASEY_DIR}/polaris-dist-dev"
version_dir="${dist_dev_dir}/${version_without_rc}"
tool_base_name="apache-polaris-${tool}"

exec_process svn checkout --username "$SVN_USERNAME" --password "$SVN_PASSWORD" --non-interactive "${APACHE_DIST_URL}${APACHE_DIST_PATH}" "${dist_dev_dir}"

exec_process mkdir -p "${version_dir}"

git archive \
  --prefix="${tool_base_name}/" \
  --format=tar \
  --mtime="1980-02-01 00:00:00" \
  HEAD | gzip -6 --no-name > "${version_dir}/${tool_base_name}.tar.gz"

exec_process gpg \
  --sign \
  --armor \
  --passphrase "${GPG_PASSPHRASE}" \
  "${version_dir}/${tool_base_name}.tar.gz"
exec_process cd "${version_dir}"
exec_process md5sum -b "${tool_base_name}.tar.gz" > "${tool_base_name}.tar.gz.md5"
exec_process shasum -b -a 256 "${tool_base_name}.tar.gz" > "${tool_base_name}.tar.gz.sha256"
exec_process shasum -b -a 512 "${tool_base_name}.tar.gz" > "${tool_base_name}.tar.gz.sha512"

exec_process cd "${dist_dev_dir}"
exec_process svn add "${tool}/${version_without_rc}/${tool_base_name}.tar.gz*"
exec_process svn commit --username "$SVN_USERNAME" --password "$SVN_PASSWORD" --non-interactive -m "Stage source tarball of Apache Polaris ${tool} ${version_without_rc} RC${rc_number}"

cat <<EOT >> $GITHUB_STEP_SUMMARY
  ## Staging source tarball to dist dev
  Source tarball staged to Apache dist dev repository
EOT
