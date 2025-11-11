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
  { path: "/users", label: "Users", icon: "Shield" },
] as const

