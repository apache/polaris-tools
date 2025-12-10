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

cat <<EOT >> $GITHUB_STEP_SUMMARY

## \`VOTE\` email proposal

Subject:

\`\`\`
[VOTE] Release Apache Polaris ${tool} ${version_without_rc} (rc${rc_number})
\`\`\`

Message body proposal, read carefully and adapt if necessary:

\`\`\`
Hi everyone,

I propose that we release the following RC${rc_number} as the official
Apache Polaris ${tool} ${version_without_rc} release.

* This corresponds to the tag: ${git_tag}
* https://github.com/apache/polaris-tools/commits/${git_tag}
* https://github.com/apache/polaris-tools/tree/${git_commit}

The release tarball, signature, and checksums are here:
* https://dist.apache.org/repos/dist/dev/incubator/polaris-tools/${tool}/${version_without_rc}
EOT

if [[ ${skip_maven} != 1 ]]; then
cat <<EOT >> $GITHUB_STEP_SUMMARY
Convenience binary artifacts are staged on Nexus. The Maven repositories URLs are:
* https://repository.apache.org/content/repositories/${staging_repo_id}/
EOT
fi

if [[ ${skip_python} != 1 ]]; then
cat <<EOT >> $GITHUB_STEP_SUMMARY
## TODO ADD PYTHON
EOT
fi

if [[ ${skip_docker} != 1 ]]; then
cat <<EOT >> $GITHUB_STEP_SUMMARY
## TODO ADD DOCKER
EOT
fi

if [[ ${skip_helm} != 1 ]]; then
  cat <<EOT >> $GITHUB_STEP_SUMMARY
Helm charts are available on:
* https://dist.apache.org/repos/dist/dev/incubator/polaris-tools/${tool}/$version_without_rc}/helm-charts
EOT
fi

cat <<EOT >> $GITHUB_STEP_SUMMARY
You can find the KEYS file here:
* https://downloads.apache.org/incubator/polaris-tools/KEYS

Please download, verify, and test.

Please vote in the next 72 hours.

[ ] +1 Release this as Apache Polaris ${tool} ${version_without_rc}
[ ] +0
[ ] -1 Do not release this because...

Only PPMC members and mentors have binding votes, but other community
members are encouraged to cast non-binding votes. This vote will pass if
there are
3 binding +1 votes and more binding +1 votes than -1 votes.

Best,
YOUR_NAME_HERE
\`\`\`
EOT
