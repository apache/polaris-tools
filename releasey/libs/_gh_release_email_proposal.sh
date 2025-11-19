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

## \`[ANNOUNCE]\` email proposal

Subject:

\`\`\`
[ANNOUNCE] Apache Polaris ${tool} ${version_without_rc} has been released!
\`\`\`

Message body proposal, read carefully and adapt if necessary:

\`\`\`
The Apache Polaris team is pleased to announce Apache Polaris ${tool} ${version_without_rc}.

This release includes:
## TODO ADD CHANGELOG

This release can be downloaded:
* https://polaris.apache.org/downloads/

The artifacts are available on Maven Central:
* https://repo1.maven.org/maven2/org/apache/polaris/

The Docker images are available on Docker Hub:
* https://hub.docker.com/r/apache/polaris-${tool}/tags

Apache Polaris is an open-source, fully-featured catalog for Apache
Iceberg™. It implements Iceberg's REST API, enabling seamless
multi-engine interoperability across a wide range of platforms,
including Apache Doris™, Apache Flink®, Apache Spark™, Dremio® OSS,
StarRocks, and Trino.

Enjoy !

The Apache Polaris team.

\`\`\`
EOT
