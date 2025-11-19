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

source "${LIBS_DIR}/_version.sh"

echo "## Parameters" >> $GITHUB_STEP_SUMMARY

if ! git_tag=$(git describe --tags --exact-match HEAD 2>/dev/null); then
  echo "❌ Current HEAD is not on a release candidate tag. Please checkout a release candidate tag first." >> $GITHUB_STEP_SUMMARY
  exit 1
fi

# Validate git tag format and extract version components
if ! validate_and_extract_git_tag_version "${git_tag}"; then
  echo "❌ Invalid git tag format: \`${git_tag}\`. Expected format: apache-polaris-x.y.z-incubating-rcN." >> $GITHUB_STEP_SUMMARY
  exit 1
fi

if [[ ! -d "${tool}/releasey" ]]; then
  echo "❌ The directory ${tool}/releasey does not exist." >> $GITHUB_STEP_SUMMARY
  exit 1
fi

source "${LIBS_DIR}/_gh_determine_built_artifacts.sh"

# Export variables for next steps and job outputs
( echo "tool=${tool}"
  echo "git_tag=${git_tag}"
  echo "version_without_rc=${version_without_rc}"
  echo "rc_number=${rc_number}"
) >> $GITHUB_ENV

( echo "tool=${tool}"
  echo "git_tag=${git_tag}"
  echo "version_without_rc=${version_without_rc}"
  echo "rc_number=${rc_number}"
) >> $GITHUB_OUTPUT

cat <<EOT >> $GITHUB_STEP_SUMMARY
| Parameter | Value |
| --- | --- |
| Tool | \`${tool}\` |
| Git tag | \`${git_tag}\` |
| Version | \`${version_without_rc}\` |
| RC number | \`${rc_number}\` |
EOT
