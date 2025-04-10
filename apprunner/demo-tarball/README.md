<!--
  Licensed to the Apache Software Foundation (ASF) under one
  or more contributor license agreements.  See the NOTICE file
  distributed with this work for additional information
  regarding copyright ownership.  The ASF licenses this file
  to you under the Apache License, Version 2.0 (the
  "License"); you may not use this file except in compliance
  with the License.  You may obtain a copy of the License at
 
   http://www.apache.org/licenses/LICENSE-2.0
 
  Unless required by applicable law or agreed to in writing,
  software distributed under the License is distributed on an
  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
  KIND, either express or implied.  See the License for the
  specific language governing permissions and limitations
  under the License.
-->

# Demo - Usage in the main apache/polaris repository

## Prerequisites

1. Checkout the main Apache Polaris repository
2. Run `./gradlew publishToMavenLocal` from the main Apache Polaris code base
3. Run `./gradlew publishToMavenLocal` from the main Apprunner code base
4. Adopt the versions in `build.gradle.kts` in this directory

Then run the demo:

```shell
gradle demoTest --info
```

`--info` is also only for the purpose of the demo to show the Polaris server startup
banned and the output produced by the `DemoTest` class.
