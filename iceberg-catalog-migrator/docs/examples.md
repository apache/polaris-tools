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

# Examples

This document provides examples of how to use the Iceberg Catalog Migrator for various Iceberg Catalogs. It is broken into:
1. [Registration Examples](#registration-examples)
2. [Migration Examples](#migration-examples)
3. [Tips](#tips)

For more information on how handle failures, please refer to [the troubleshooting guide](./troubleshooting.md).

## Registration Examples
Below are some examples of registering tables from one catalog to another.

### Registering All Tables from Hadoop Catalog to Polaris Catalog

```shell
java -jar iceberg-catalog-migrator-cli-0.0.1.jar register \
--source-catalog-type HADOOP \
--source-catalog-properties warehouse=/tmp/warehouse,type=hadoop \
--target-catalog-type REST  \
--target-catalog-properties uri=http://localhost:60904/api/catalog,warehouse=test,token=$TOKEN 
```

## Migration Examples

### Migrate Selected Tables from Hadoop Catalog to Polaris Catalog

In this example, only tables t1 and t2 in namespace foo will be migrated.

```shell
java -jar iceberg-catalog-migrator-cli-0.0.1.jar migrate \
--source-catalog-type HADOOP \
--source-catalog-properties warehouse=/tmp/warehouse,type=hadoop \
--target-catalog-type REST  \
--target-catalog-properties uri=http://localhost:60904/api/catalog,warehouse=test,token=$TOKEN \
--identifiers foo.t1,foo.t2
```

### Migrate from GLUE Catalog to Polaris Catalog
```shell
java -jar iceberg-catalog-migrator-cli-0.0.1.jar migrate \
--source-catalog-type GLUE \
--source-catalog-properties warehouse=s3a://some-bucket/wh/,io-impl=org.apache.iceberg.aws.s3.S3FileIO \
--target-catalog-type REST  \
--target-catalog-properties uri=http://localhost:60904/api/catalog,warehouse=test,token=$TOKEN
```

### Migrate from HIVE Catalog to Polaris Catalog
```shell
java -jar iceberg-catalog-migrator-cli-0.0.1.jar migrate \
--source-catalog-type HIVE \
--source-catalog-properties warehouse=s3a://some-bucket/wh/,io-impl=org.apache.iceberg.aws.s3.S3FileIO,uri=thrift://localhost:9083 \
--target-catalog-type REST  \
--target-catalog-properties uri=http://localhost:60904/api/catalog,warehouse=test,token=$TOKEN
```

Note: You will need to configure `ALLOW_UNSTRUCTURED_TABLE_LOCATION` property on the Polaris server side as
HMS creates a namespace folder with ".db" extension. In addition, you will need to configure `allowedLocations` to be
source catalog directory in `storage_configuration_info`.

### Migrate from DYNAMODB Catalog to Polaris Catalog
```shell
java -jar iceberg-catalog-migrator-cli-0.0.1.jar migrate \
--source-catalog-type DYNAMODB \
--source-catalog-properties warehouse=s3a://some-bucket/wh/,io-impl=org.apache.iceberg.aws.s3.S3FileIO \
--target-catalog-type REST  \
--target-catalog-properties uri=http://localhost:60904/api/catalog,warehouse=test,token=$TOKEN
```

### Migrate from JDBC Catalog to Polaris Catalog
```shell
java -jar iceberg-catalog-migrator-cli-0.0.1.jar migrate \ 
--source-catalog-type JDBC \
--source-catalog-properties warehouse=/tmp/warehouseJdbc,jdbc.user=root,jdbc.password=pass,uri=jdbc:mysql://localhost:3306/db1,name=catalogName \
--target-catalog-type REST  \
--target-catalog-properties uri=http://localhost:60904/api/catalog,warehouse=test,token=$TOKEN
```

### Migrate Only Tables Starting with "foo"
```shell
java -jar iceberg-catalog-migrator-cli-0.0.1.jar migrate \
--source-catalog-type HIVE \
--source-catalog-properties warehouse=s3a://some-bucket/wh/,io-impl=org.apache.iceberg.aws.s3.S3FileIO,uri=thrift://localhost:9083 \
--target-catalog-type NESSIE  \
--target-catalog-properties uri=http://localhost:19120/api/v1,ref=main,warehouse=/tmp/warehouse \
--identifiers-regex ^foo\..*

```

### Migrate Tables from a File
The file idx.txt contains each table identifier to migrate delimited by a newline.

```shell
java -jar iceberg-catalog-migrator-cli-0.0.1.jar migrate \
--source-catalog-type HIVE \
--source-catalog-properties warehouse=/tmp/warehouse,type=hadoop \
--target-catalog-type NESSIE  \
--target-catalog-properties uri=http://localhost:19120/api/v1,ref=main,warehouse=/tmp/warehouse \
--identifiers-from-file ids.txt
```


## Tips
1. Before migrating tables to Polaris, make sure the catalog is configured to the `base-location` same as source catalog `warehouse` location during catalog creation.
