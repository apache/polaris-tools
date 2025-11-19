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

# Script to publish Maven artifacts.
#
# Arguments
#   - file name to write the staging repo ID and URL to
# Environment variables:
#   DRY_RUN
#   RELEASEY_DIR
#   LIBS_DIR
#   version_without_rc
#   (and more)

source "$LIBS_DIR/_exec.sh"

# Publish artifacts to staging repository
exec_process ./gradlew publishToApache closeApacheStagingRepository -Prelease -PuseGpgAgent --info 2>&1 | tee gradle_publish_output.txt

# Extract staging repository ID and URL from Gradle output
staging_repo_id=""
staging_repo_url=""

# Look for staging repository ID in the output
if grep -q "Created staging repository" gradle_publish_output.txt; then
  staging_repo_id=$(grep "Created staging repository" gradle_publish_output.txt | sed --regexp-extended "s/^Created staging repository .([a-z0-9-]+). at (.*)/\1/")
  staging_repo_url=$(grep "Created staging repository" gradle_publish_output.txt | sed --regexp-extended "s/^Created staging repository .([a-z0-9-]+). at (.*)/\2/")
fi

out_file="$1"

( echo "staging_repo_id=${staging_repo_id}"
  echo "staging_repo_url=${staging_repo_url}"
) >> "${out_file}"

