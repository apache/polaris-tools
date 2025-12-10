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

out_params_file="$(mktemp --tmpdir maven-stage-XXXXXXXXXX)"

# Call tool-specific maven-stage script
(cd ${tool} ; ./releasey/maven-stage.sh "$out_params_file")

source "$out_params_file"

echo "staging_repo_id=${staging_repo_id}" >> $GITHUB_OUTPUT
echo "staging_repo_url=${staging_repo_url}" >> $GITHUB_OUTPUT

cat <<EOT >> $GITHUB_STEP_SUMMARY
## Nexus Staging Repository
Artifacts published and staging repository closed successfully

| Property | Value |
| --- | --- |
| Staging Repository ID | \`${staging_repo_id:-"Not extracted"}\` |
| Staging Repository URL | ${staging_repo_url:-"Not extracted"} |

## Summary
🎉 Artifacts built and published successfully:

| Operation | Status |
| --- | --- |
| Build source and binary distributions | ✅ |
| Stage artifacts to Apache dist dev repository | ✅ |
| Stage artifacts to Apache Nexus staging repository | ✅ |
| Close Nexus staging repository | ✅ |
EOT
