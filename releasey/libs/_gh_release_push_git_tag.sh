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

# Get the commit SHA that the RC tag points to
rc_commit=$(git rev-parse "${rc_tag}")
echo "rc_commit=${rc_commit}" >> $GITHUB_ENV

exec_process git tag -a "${final_release_tag}" "${rc_commit}" -m "Apache Polaris ${version_without_rc} Release"
exec_process git push apache "${final_release_tag}"

cat <<EOT >> $GITHUB_STEP_SUMMARY
## Git Release Tag
Final release tag \`${final_release_tag}\` created and pushed
EOT
