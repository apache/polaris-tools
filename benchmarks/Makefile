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

.PHONY: create-dataset-simulation
create-dataset-simulation:
	./gradlew gatlingRun --simulation org.apache.polaris.benchmarks.simulations.CreateTreeDataset \
      -Dconfig.file=./application.conf

.PHONY: read-simulation
read-simulation:
	./gradlew gatlingRun --simulation org.apache.polaris.benchmarks.simulations.ReadTreeDataset \
      -Dconfig.file=./application.conf

.PHONY: read-update-simulation
read-update-simulation:
	./gradlew gatlingRun --simulation org.apache.polaris.benchmarks.simulations.ReadUpdateTreeDataset \
      -Dconfig.file=./application.conf

.PHONY: create-commits-simulation
create-commits-simulation:
	./gradlew gatlingRun --simulation org.apache.polaris.benchmarks.simulations.CreateCommits \
      -Dconfig.file=./application.conf

.PHONY: reports-list
reports-list:
	@for report in $$(ls -d build/reports/gatling/*/ 2>/dev/null | sort -r); do \
		basename="$$(basename $$report)"; \
		name="$$(echo $$basename | sed 's/-[0-9]\{17\}$$//')"; \
		timestamp="$$(echo $$basename | grep -o '[0-9]\{17\}$$')"; \
		if [ -n "$$timestamp" ]; then \
			date="$$(echo $$timestamp | cut -c1-8)"; \
			time="$$(echo $$timestamp | cut -c9-14)"; \
			millis="$$(echo $$timestamp | cut -c15-17)"; \
			formatted_date="$$(echo $$date | sed 's/\([0-9]\{4\}\)\([0-9]\{2\}\)\([0-9]\{2\}\)/\1-\2-\3/')"; \
			formatted_time="$$(echo $$time | sed 's/\([0-9]\{2\}\)\([0-9]\{2\}\)\([0-9]\{2\}\)/\1:\2:\3/')"; \
			index_path="$${report}index.html"; \
			if [ -f "$$index_path" ]; then \
				echo "$$name | $$formatted_date $$formatted_time.$$millis | $$index_path"; \
			else \
				echo "$$name | $$formatted_date $$formatted_time.$$millis | ERROR"; \
			fi; \
		fi; \
	done

.PHONY: reports-clean
reports-clean:
	@rm -rf build/reports/gatling/*/ 2>/dev/null || true

