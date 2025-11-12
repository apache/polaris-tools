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

# Iceberg Catalog Migrator
 
The Iceberg Catalog Migrator is a command-line tool that enables bulk migration of [Apache Iceberg](https://iceberg.apache.org/) tables from one [Iceberg Catalog](https://iceberg.apache.org/rest-catalog-spec/) to another without the need to copy the data. This tool works with all Iceberg Catalogs; not just Polaris.

The migrator tool provides two operations:
* Migrate - Bulk migration of the Iceberg tables from source catalog to target catalog. Table entries from source catalog will be deleted after the successful migration to the target catalog.
* Register - Bulk register the Iceberg tables from source catalog to target catalog. 

> :warning: `register` command just registers the table.
Which means the table will be present in both the catalogs after registering.
**Operating same table from more than one catalog can lead to missing updates, loss of data, and table corruption.
It is recommended to use the 'migrate' command in CLI to automatically delete the table from source catalog after registering
or avoid operating tables from the source catalog after registering if 'migrate' command is not used.**

> :warning: **Avoid using this tool when there are in-progress commits for tables in the source catalog 
to prevent missing updates, data loss and table corruption in the target catalog. 
In-progress commits may not be properly transferred and could compromise the integrity of your data.**

Please use the [getting started guide](docs/getting-started.md) for a step-by-step guide on how to use the tool.

Please use the [examples guide](./docs/examples.md) to learn about the different options available in the tool.
