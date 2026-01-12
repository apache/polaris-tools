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

# Object Store Access Configuration

This document provides a guide on how to configure access to object stores for the Iceberg Catalog Migrator.

## Required Dependencies

The Iceberg Catalog Migrator CLI jar does not include cloud provider dependencies to keep the distribution size small.
Users must supplement the appropriate Iceberg object store bundle jar based on the object store being used.

Download the required bundle jar from [Maven Central](https://repo1.maven.org/maven2/org/apache/iceberg/)

## AWS S3

### Required Dependencies
Users must include the Iceberg AWS bundle jar (can be downloaded from [here](https://mvnrepository.com/artifact/org.apache.iceberg/iceberg-aws-bundle)) in the classpath:
```shell
java -cp iceberg-catalog-migrator-cli-0.1.0-SNAPSHOT.jar:iceberg-aws-bundle-x.x.x.jar \
  org.apache.polaris.iceberg.catalog.migrator.cli.CatalogMigrationCLI register \
  [your-options]
```

For more information on AWS integration, refer to the [Iceberg AWS documentation](https://iceberg.apache.org/docs/nightly/aws/#enabling-aws-integration).

### Environment Variables
For AWS, use the following environment variables:
```shell
export AWS_ACCESS_KEY_ID=xxxxxxx
export AWS_SECRET_ACCESS_KEY=xxxxxxx
export AWS_S3_ENDPOINT=xxxxxxx
```

## Azure Data Lake Storage (ADLS)

### Required Dependencies
Users must include the Iceberg Azure bundle jar (can be downloaded from [here](https://mvnrepository.com/artifact/org.apache.iceberg/iceberg-azure-bundle)) in the classpath:
```shell
java -cp iceberg-catalog-migrator-cli-0.1.0.jar:iceberg-azure-bundle-x.x.x.jar \
  org.apache.polaris.iceberg.catalog.migrator.cli.CatalogMigrationCLI register \
  [your-options]
```

### Environment Variables
For ADLS, use the following environment variables:
```shell
export AZURE_SAS_TOKEN=xxxxxxx
```

## Google Cloud Storage (GCS)

### Required Dependencies
Users must include the Iceberg GCP bundle jar (can be downloaded from [here](https://mvnrepository.com/artifact/org.apache.iceberg/iceberg-gcp-bundle)) in the classpath:
```shell
java -cp iceberg-catalog-migrator-cli-0.1.0.jar:iceberg-gcp-bundle-x.x.x.jar \
  org.apache.polaris.iceberg.catalog.migrator.cli.CatalogMigrationCLI register \
  [your-options]
```

## Notes
- Replace `x.x.x` with the Iceberg version matching the release version of the migrator tool.
- Multiple bundle jars can be included if users need to access multiple cloud providers.
