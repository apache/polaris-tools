#!/usr/bin/env bash
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

# Script to update the version.
#
# Every tool MUST have an update_version.sh script.
#
# Environment variables:
#   DRY_RUN
#   RELEASEY_DIR
#   LIBS_DIR
#   version_without_rc
#   (and more)

source "$LIBS_DIR/_exec.sh"

if [[ ${DRY_RUN:-1} -ne 1 ]]; then
  exec_process echo "$version_without_rc" > version.txt
else
  exec_process "echo $version_without_rc > version.txt"
fi

exec_process git add version.txt
            "$VERSION_FILE" \
            "$HELM_CHART_YAML_FILE" \
            "$HELM_README_FILE" \
            "$CHANGELOG_FILE"
