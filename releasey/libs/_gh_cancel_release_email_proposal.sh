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

# The ^0 suffix "resolves" a Git tag SHA to a commit SHA, if necessary.
git_commit="$(git rev-parse ${git_tag}^0)"

cat <<EOT >> "$GITHUB_STEP_SUMMARY"

## \`[RESULT][VOTE]\` email proposal

### Subject
\`\`\`
[RESULT][VOTE] Release Apache Polaris ${tool}${version_without_rc} (rc${rc_number})
\`\`\`

### Body
\`\`\`
Hello everyone,

Thanks to all who participated in the vote for Release Apache Polaris ${tool} ${version_without_rc} (rc${rc_number}).

The vote failed due to [REASON - TO BE FILLED BY RELEASE MANAGER].

A new release candidate will be proposed soon once the issues are addressed.

Thanks,
\`\`\`

## Summary
🔄 Release candidate cancellation completed:

| Component | Status |
| --- | --- |
| Nexus staging repository | ✅ Dropped |
| Distribution artifacts (dist dev) | ✅ Deleted |
| Helm chart (dist dev) | ✅ Deleted |
EOT
