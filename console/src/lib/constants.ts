/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

export const QUERY_ENGINES = [
  { value: "apache-spark", label: "Apache Spark" },
  { value: "snowflake", label: "Snowflake" },
  { value: "apache-flink", label: "Apache Flink" },
  { value: "pylceberg", label: "Pylceberg" },
  { value: "apache-doris", label: "Apache Doris" },
  { value: "starburst-galaxy", label: "Starburst Galaxy" },
  { value: "starrocks", label: "StarRocks" },
  { value: "trino", label: "Trino" },
] as const

export const STORAGE_PROVIDERS = [
  { value: "s3", label: "S3" },
  { value: "azure", label: "Azure" },
  { value: "gcs", label: "Google Cloud Storage" },
  { value: "file", label: "File System" },
] as const

export const CATALOG_TYPES = [
  { value: "INTERNAL", label: "Internal" },
  { value: "EXTERNAL", label: "External" },
] as const

export const NAV_ITEMS = [
  { path: "/", label: "Home", icon: "Home" },
  { path: "/connections", label: "Connections", icon: "Link" },
  { path: "/catalogs", label: "Catalogs", icon: "Database" },
  { path: "/access-control", label: "Access Control", icon: "Shield" },
] as const

// Catalog Explorer resize configuration
export const CATALOG_EXPLORER_STORAGE_KEY = "catalog-explorer-width"
export const CATALOG_EXPLORER_MIN_WIDTH = 200
export const CATALOG_EXPLORER_MAX_WIDTH = 600
export const CATALOG_EXPLORER_DEFAULT_WIDTH = 320 // 80 * 4 (w-80 = 20rem = 320px)
export const CATALOG_NODE_PREFIX = "catalog."
