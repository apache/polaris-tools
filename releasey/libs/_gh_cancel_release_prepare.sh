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

echo "## Parameters" >> "$GITHUB_STEP_SUMMARY"

if [[ ! -d "${tool}/releasey" ]]; then
  echo "❌ The directory ${tool}/releasey does not exist." >> "$GITHUB_STEP_SUMMARY"
  exit 1
fi

# Extract the ref name from github.ref
# github_ref environment format: refs/heads/branch-name or refs/tags/tag-name
if [[ "${github_ref}" =~ ^refs/heads/release/(.+)$ ]]; then
  # Running from a release branch
  branch_version="${BASH_REMATCH[1]}"
  current_branch="release/${branch_version}"
else
  cat <<EOT >> "$GITHUB_STEP_SUMMARY"
❌ This workflow must be run from a release branch (release/major.minor.x).

Current ref: \`${github_ref}\`

Please select a release branch (e.g., \`release/1.0.x\`) from the 'Use workflow from' dropdown in the GitHub UI.
EOT
  exit 1
fi
# Validate that we're on a release branch
if [[ ! "${current_branch}" =~ ^release/(.+)$ ]]; then
  echo "❌ This workflow must be run from a release branch (release/major.minor.x). Current branch: \`${current_branch}\`." >> "$GITHUB_STEP_SUMMARY"
  exit 1
fi

# Validate branch version format and extract components
if ! validate_and_extract_branch_version "${branch_version}"; then
  echo "❌ Invalid release branch version format: \`${branch_version}\`. Expected format: major.minor.x." >> "$GITHUB_STEP_SUMMARY"
  exit 1
fi

# Find the next patch number for this major.minor version by looking at existing tags
# Note: find_next_patch_number returns the current patch if no final tag exists,
# which is exactly what we need for publishing (we publish from an RC that has no final tag yet)
find_next_patch_number "${major}" "${minor}"

# Build the version string for the latest existing patch
version_without_rc="${major}.${minor}.${patch}-incubating"

# Find the latest RC tag for this version
find_next_rc_number "${version_without_rc}"
latest_rc=$((rc_number - 1))

if [[ ${latest_rc} -lt 0 ]]; then
  echo "❌ No RC tags found for version \`${version_without_rc}\`. Expected at least one RC to be created before publishing a release." >> "$GITHUB_STEP_SUMMARY"
  exit 1
fi

rc_tag="apache-polaris-${tool}-${version_without_rc}-rc${latest_rc}"

# Verify the RC tag exists
if ! git rev-parse "${rc_tag}" >/dev/null 2>&1; then
  echo "❌ RC tag \`${rc_tag}\` does not exist in repository." >> "$GITHUB_STEP_SUMMARY"
  exit 1
fi

# Verify that current HEAD is at the RC tag commit
rc_commit=$(git rev-parse "${rc_tag}")
current_commit=$(git rev-parse HEAD)

if [[ "${current_commit}" != "${rc_commit}" ]]; then
  cat <<EOT >> "$GITHUB_STEP_SUMMARY"
❌ Current HEAD (\`${current_commit}\`) does not match RC tag \`${rc_tag}\` (\`${rc_commit}\`).

This means that some commits have been made on the release branch after the last RC was created.
You should not publish a release from a branch that has received additional commits after the last RC was created.
Either remove the commits from the release branch so that it points to the last RC that was voted on, or create a new RC from the current state of the branch.
EOT
  exit 1
fi

echo "✅ Current HEAD matches RC tag \`${rc_tag}\`" >> "$GITHUB_STEP_SUMMARY"

# Create final release tag name
final_release_tag="apache-polaris-${tool}-${version_without_rc}"

# Check if final release tag already exists
if git rev-parse "${final_release_tag}" >/dev/null 2>&1; then
  echo "❌ Final release tag \`${final_release_tag}\` already exists. This release may have already been published." >> "$GITHUB_STEP_SUMMARY"
  exit 1
fi

# Export variables for next steps
cat <<EOT >> "$GITHUB_ENV"
version_without_rc=${version_without_rc}
tool=${tool}
rc_tag=${rc_tag}
final_release_tag=${final_release_tag}
release_branch=${current_branch}
EOT

cat <<EOT >> "$GITHUB_STEP_SUMMARY"
| Parameter | Value |
| --- | --- |
| Tool | \`${tool}\` |
| Version | \`${version_without_rc}\` |
| RC tag to promote | \`${rc_tag}\` |
| Final release tag | \`${final_release_tag}\` |
| Release branch | \`${current_branch}\` |
EOT
