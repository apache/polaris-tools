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

skip_maven=0
skip_docker=0
skip_helm=0
skip_python=0

if [[ ! -x "${tool}/releasey/maven-build.sh" ]]; then
  skip_maven=1
  echo "## No Maven Artifacts built by ${tool}" >> $GITHUB_STEP_SUMMARY
fi
if [[ ! -x "${tool}/releasey/docker-build.sh" ]]; then
  skip_docker=1
  echo "## No Docker Images built by ${tool}" >> $GITHUB_STEP_SUMMARY
fi
if [[ ! -x "${tool}/releasey/helm-build.sh" ]]; then
  skip_helm=1
  echo "## No Helm Charts built by ${tool}" >> $GITHUB_STEP_SUMMARY
fi
if [[ ! -x "${tool}/releasey/python-build.sh" ]]; then
  skip_python=1
  echo "## No Python packages built by ${tool}" >> $GITHUB_STEP_SUMMARY
fi

( echo "skip_maven=$skip_maven"
  echo "skip_docker=$skip_docker"
  echo "skip_helm=$skip_helm"
  echo "skip_python=$skip_python"
) >> $GITHUB_ENV

( echo "skip_maven=$skip_maven"
  echo "skip_docker=$skip_docker"
  echo "skip_helm=$skip_helm"
  echo "skip_python=$skip_python"
) >> $GITHUB_OUTPUT
