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

# Get the current branch name
current_branch=$(git branch --show-current)

echo "## Parameters" >> $GITHUB_STEP_SUMMARY

if [[ ! -d "${tool}/releasey" ]]; then
  echo "❌ The directory ${tool}/releasey does not exist." >> $GITHUB_STEP_SUMMARY
  exit 1
fi

# Validate that we're on a release branch
if [[ ! "${current_branch}" =~ ^release/(.+)$ ]]; then
  echo "❌ This workflow must be run from a release branch (release/major.minor.x). Current branch: \`${current_branch}\`." >> $GITHUB_STEP_SUMMARY
  exit 1
fi

# Extract version from release branch name
branch_version="${BASH_REMATCH[1]}"

# Validate branch version format and extract components
if ! validate_and_extract_branch_version "${branch_version}"; then
  echo "❌ Invalid release branch version format: \`${branch_version}\`. Expected format: major.minor.x." >> $GITHUB_STEP_SUMMARY
  exit 1
fi

# Find the next patch number for this major.minor version by looking at existing tags
find_next_patch_number "${major}" "${minor}"
next_patch=$((patch))
latest_patch=$((next_patch - 1))

if [[ ${next_patch} -eq 0 ]]; then
  echo "❌ No existing tags found for version \`${major}.${minor}.0\`. Expected at least one RC to be created before publishing a release." >> $GITHUB_STEP_SUMMARY
  exit 1
fi

# Build the version string for the latest existing patch
version_without_rc="${major}.${minor}.${latest_patch}-incubating"

# Find the latest RC tag for this version
find_next_rc_number "${version_without_rc}"
latest_rc=$((rc_number - 1))

if [[ ${latest_rc} -lt 0 ]]; then
  echo "❌ No RC tags found for version \`${version_without_rc}\`. Expected at least one RC to be created before publishing a release." >> $GITHUB_STEP_SUMMARY
  exit 1
fi

rc_tag="apache-polaris-${tool}-${version_without_rc}-rc${latest_rc}"

# Verify the RC tag exists
if ! git rev-parse "${rc_tag}" >/dev/null 2>&1; then
  echo "❌ RC tag \`${rc_tag}\` does not exist in repository." >> $GITHUB_STEP_SUMMARY
  exit 1
fi

# Create final release tag name
final_release_tag="apache-polaris-${tool}-${version_without_rc}"

# Check if final release tag already exists
if git rev-parse "${final_release_tag}" >/dev/null 2>&1; then
  echo "❌ Final release tag \`${final_release_tag}\` already exists. This release may have already been published." >> $GITHUB_STEP_SUMMARY
  exit 1
fi

# Export variables for next steps
( echo "version_without_rc=${version_without_rc}"
  echo "tool=${tool}"
  echo "rc_tag=${rc_tag}"
  echo "final_release_tag=${final_release_tag}"
  echo "release_branch=${current_branch}"
) >> $GITHUB_ENV

cat <<EOT >> $GITHUB_STEP_SUMMARY
| Parameter | Value |
| --- | --- |
| Tool | \`${tool}\` |
| Version | \`${version_without_rc}\` |
| RC tag to promote | \`${rc_tag}\` |
| Final release tag | \`${final_release_tag}\` |
| Release branch | \`${current_branch}\` |
EOT
