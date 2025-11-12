<!--
  - Licensed to the Apache Software Foundation (ASF) under one
  - or more contributor license agreements.  See the NOTICE file
  - distributed with this work for additional information
  - regarding copyright ownership.  The ASF licenses this file
  - to you under the Apache License, Version 2.0 (the
  - "License"); you may not use this file except in compliance
  - with the License.  You may obtain a copy of the License at
  -
  -   http://www.apache.org/licenses/LICENSE-2.0
  -
  - Unless required by applicable law or agreed to in writing,
  - software distributed under the License is distributed on an
  - "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
  - KIND, either express or implied.  See the License for the
  - specific language governing permissions and limitations
  - under the License.
  -->

# Getting Started

This document provides a step-by-step guide on how to use the Iceberg Catalog Migrator.
This guide uses an example of migrating from a Polaris catalog to another Polaris catalog that are backed by an AWS S3 bucket.

## Prerequisites
1. Java 21 or later installed
2. Have a target catalog created and configured
3. Have a source catalog to migrate from
4. Block in-progress commits to the source catalog

## Getting Started
Migration happens in five steps:
1. Build the Iceberg Catalog Migrator
2. Set the object storage environment variables
3. Get access to the source and target catalogs
4. Validate the migration
5. Migrate the tables

### Step 1: Build the Iceberg Catalog Migrator
Execute the following commands to build the tool:
```shell
git clone https://github.com/apache/polaris-tools.git 
cd polaris-tools/iceberg-catalog-migrator
./gradlew build
```

These commands:
1. Clone the repository
2. Navigate to the `iceberg-catalog-migrator` directory
3. Build the tool
4. Create a JAR file in `iceberg-catalog-migrator/cli/build/libs/` directory

The JAR file will be created with name `iceberg-catalog-migrator-cli-<version>.jar` where `<version>` is the version of the tool found in the `iceberg-catalog-migrator/version.txt` file.  For the examples below, we will assume the version is `0.0.1-SNAPSHOT`, so the JAR file name will be `iceberg-catalog-migrator-cli-0.0.1-SNAPSHOT.jar`.

### Step 2: Set the Object Storage Environment Variables
The tool will need access to the underlying object storage via environmental variables. For this example, we will use AWS S3 with an access key and id:
```shell
export AWS_ACCESS_KEY_ID=<access_key>
export AWS_SECRET_ACCESS_KEY=<secret_key>
```

For more information on configuring access to object storage, please see [this guide](./object-store-access-configuration.md).

### Step 3: Get Access to the Source and Target Catalogs
The tool will need to be authorized to the source & target catalogs. In this example, we will use two Polaris catalogs. For getting access to a Polaris catalog, use the OAuth token endpoint like:
```shell
curl -X POST http://sourcecatalog:8181/api/catalog/v1/oauth/tokens \
-d "grant_type=client_credentials" \
-d "client_id=my-client-id" \
-d "client_secret=my-client-secret" \
-d "scope=PRINCIPAL_ROLE:ALL"

export TOKEN_SOURCE=xxxxxxx

curl -X POST http://targetcatalog:8181/api/catalog/v1/oauth/tokens \
-d "grant_type=client_credentials" \
-d "client_id=my-client-id" \
-d "client_secret=my-client-secret" \
-d "scope=PRINCIPAL_ROLE:ALL"

export TOKEN_TARGET=xxxxxxx
```

### Step 4: Validate the Migration
Execute the following command to understand how to migrate the tables:
```shell
java -jar ./cli/build/libs/iceberg-catalog-migrator-cli-0.0.1-SNAPSHOT.jar register -h  
```

In the example, execute the following command to perform a dry run migration. This will not migrate the tables but will provide information on the operation:
```shell
java -jar ./cli/build/libs/iceberg-catalog-migrator-cli-0.0.1-SNAPSHOT.jar register \
--source-catalog-type REST \
--source-catalog-properties uri=http://sourcecatalog:8181/api/catalog,warehouse=test,token=$TOKEN_SOURCE \
--target-catalog-type REST  \
--target-catalog-properties uri=http://targetcatalog:8181/api/catalog,warehouse=test,token=$TOKEN_TARGET \
--dry-run
```

After validating all inputs, the console will display a list of table identifiers that are identified for migration. This information will also be written to a file called `dry_run.txt`,

### Step 5: Migrate the Tables

In the example, execute the following command to perform a migration:
```shell
java -jar ./cli/build/libs/iceberg-catalog-migrator-cli-0.0.1-SNAPSHOT.jar migrate \
--source-catalog-type REST \
--source-catalog-properties uri=http://sourcecatalog:8181/api/catalog,warehouse=test,token=$TOKEN_SOURCE \
--target-catalog-type REST  \
--target-catalog-properties uri=http://targetcatalog:8181/api/catalog,warehouse=test,token=$TOKEN_TARGET
```

Please note that a log file will be created to verify the migration proceeded successfully.
If any issues occur, please use [the troubleshooting guide](./troubleshooting.md).

For more example migrations, please see [this guide](./examples.md).
