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

# Create a temporary directory for downloading artifacts
artifacts_dir="${RELEASEY_DIR}/release-artifacts"
exec_process mkdir -p "${artifacts_dir}"

# Download artifacts from Apache dist release space
release_artifacts_url="${APACHE_DIST_URL}/release/incubator/polaris-${tool}/${version_without_rc}"
exec_process svn export --username "$SVN_USERNAME" --password "$SVN_PASSWORD" --non-interactive \
  "${release_artifacts_url}" "${artifacts_dir}/artifacts"

# Prepare the content of the Github Release
# ********************************************************************************
release_title="Release ${version_without_rc}"
release_notes="Apache Polaris ${version_without_rc} Release

## Release Artifacts
This release includes:
- Source and binary distributions"

if [[ -n "${skip_helm}" ]]; then
  release_notes="${release_notes}
- Helm chart package"
fi
if [[ -n "${skip_docker}" ]]; then
  release_notes="${release_notes}
- Docker images published to Docker Hub"
fi
if [[ -n "${skip_maven}" ]]; then
  release_notes="${release_notes}
- Maven artifacts published to Maven Central"
fi

## Verification
release_notes="${release_notes}
All artifacts have been signed with GPG and include SHA-512 checksums for verification."

if [[ -n "${skip_docker}" ]]; then
release_notes="${release_notes}
## Docker Images
- \`apache/polaris:${final_release_tag}\` - Polaris Server
- \`apache/polaris-admin:${final_release_tag}\` - Polaris Admin Tool"
fi
# ********************************************************************************

# Create GitHub release
exec_process gh release create "${final_release_tag}" \
  --title "${release_title}" \
  --notes "${release_notes}" \
  --target "${rc_commit}"

# Attach all artifacts from the artifacts directory
artifacts_dir="${RELEASEY_DIR}/release-artifacts"
if [[ -d "${artifacts_dir}" ]]; then
  find "${artifacts_dir}" -type f -name "*.tar.gz" -o -name "*.tgz" -o -name "*.asc" -o -name "*.sha512" -o -name "*.prov" | while read -r file; do
    exec_process gh release upload "${final_release_tag}" "${file}"
  done
fi

cat <<EOT >> $GITHUB_STEP_SUMMARY
## GitHub Release
GitHub release created: \`${final_release_tag}\`
EOT
