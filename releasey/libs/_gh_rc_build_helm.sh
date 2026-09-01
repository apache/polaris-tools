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

# Make sure these files are always deleted
trap "rm -f /tmp/secring.gpg /tmp/pubring.gpg /tmp/passphrase" EXIT

echo "$GPG_PASSPHRASE" > /tmp/passphrase
gpg --batch --pinentry-mode loopback --passphrase-file /tmp/passphrase --export-secret-keys > /tmp/secring.gpg
gpg --batch --pinentry-mode loopback --export > /tmp/pubring.gpg

exec_process cd helm

find . -mindepth 1 -maxdepth 1 -type d | while read -r helm_dir; do
  chart_name="$(basename "$helm_dir")"
  exec_process cd "${chart_name}"

  # Prerequisite for reproducible helm packages: file modification time must be deterministic
  # Works with helm since version 4.0.0
  exec_process find "${chart_name}" -exec touch -d "1980-01-01 00:00:00" {} +
  exec_process helm package "${chart_name}" --sign --key "." --keyring /tmp/secring.gpg --passphrase-file /tmp/passphrase
  exec_process helm verify "${chart_name}"-${version_without_rc}.tgz --keyring /tmp/pubring.gpg

  calculate_sha512 polaris-${version_without_rc}.tgz
  exec_process gpg --armor --output "${chart_name}"-${version_without_rc}.tgz.asc --detach-sig "${chart_name}"-${version_without_rc}.tgz
  calculate_sha512 polaris-${version_without_rc}.tgz.prov
  exec_process gpg --armor --output "${chart_name}"-${version_without_rc}.tgz.prov.asc --detach-sig "${chart_name}"-${version_without_rc}.tgz.prov

  exec_process cd ..
done
