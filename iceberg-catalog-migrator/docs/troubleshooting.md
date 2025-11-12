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

# Troubleshooting

This document provides troubleshooting information for common issues encountered while using the Iceberg Catalog Migrator:
1. [Errors while migrating tables](#errors-while-migrating-tables)
2. [Manually aborting the migration](#manually-aborting-the-migration)

## Errors while Migrating Tables
There can be errors while migrating tables. These errors can come from the source or the target. To troubleshoot:
1. Look at the console output or the log file to identify the failed tables. In the logs, there will be an exception stracktrace for each failed table.
2. If the migration of those tables failed with `TableAlreadyExists` exception, there is a conflict in the table identifiers in the target catalog. Users can rename the tables in the source catalog.
3. If the migration of those tables failed with `ConnectionTimeOut` exception, users can retry migrating only those tables using the `--identifiers-from-file` option with the `failed_identifiers.txt` file created in the output directory.
4. If the migration is successful but deletion of some tables form source catalog is failed, summary will mention that these table names were written into the `failed_to_delete.txt` file and logs will capture the failure reason. Do not operate these tables from the source catalog and user will have to delete them manually.

## Manually Aborting the Migration
If a migration was manually aborted:
1. Determine the number of migrated tables. A user can either review the log or use the `listTables()` function in the target catalog.
2. Migrated tables may not be deleted from the source catalog. Users should avoid manipulating these tables in the source catalog.
3. To recover, the user can manually remove these tables from the source catalog or attempt a bulk migration to transfer all tables from the source catalog. Please note that this may result in several `TableAlreadyExists` exceptions as many of the tables may have already been migrated.
