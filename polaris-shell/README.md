# Polaris Shell

An interactive SQL shell for exploring [Apache Iceberg](https://iceberg.apache.org/) tables and catalog metadata through [Apache Polaris](https://polaris.apache.org/) via its REST catalog API. No Spark, no Flink, no heavyweight engine — just a single fat JAR and a properties file.

Polaris Shell complements Polaris with a SQL interface for answering routine questions about your catalog — how many tables are in a namespace, how many snapshots a table has, where it is stored, whether it has too many small files — without spinning up Trino, Spark, or pyiceberg.

> **SELECT queries read data directly via the Iceberg Java library and are intended for sampling and exploration, not production workloads.**

> **Try it in minutes** — a fully self-contained Docker demo is included. See [demo/README.md](demo/README.md).

---

## How it works

Polaris Shell connects to a Polaris server using the **Iceberg REST catalog protocol** and OAuth2 client credentials. It parses SQL statements with an [ANTLR 4](https://www.antlr.org/) grammar, converts them to Iceberg API calls, and prints results to the terminal. No JDBC driver, no query engine — queries are executed directly through the Iceberg Java library against the catalog.

```
SQL input → ANTLR parser → QueryPlan → Iceberg REST catalog API → results
```

---

## Supported commands

| Command | Example |
|---|---|
| `SELECT` with predicate, projection, ORDER BY, LIMIT | `SELECT id, amount FROM retail.orders WHERE region = 'us-east-1' ORDER BY amount DESC LIMIT 10` |
| `SHOW TABLES IN <namespace>` | `SHOW TABLES IN retail` |
| `DESCRIBE STATS <table>` | `DESCRIBE STATS retail.orders` |
| `SHOW TABLE LOCATION <table>` | `SHOW TABLE LOCATION retail.products` |
| `SHOW TABLE POLICIES <table>` | `SHOW TABLE POLICIES retail.orders` |
| `DIAGNOSE TABLE <table>` | `DIAGNOSE TABLE retail.orders` |
| `EXPLAIN SELECT ...` | `EXPLAIN SELECT * FROM retail.orders WHERE region = 'us-east-1'` |

**`EXPLAIN`** shows the Iceberg scan plan: snapshot info, partition spec, manifest and data-file counts before and after filter pushdown, estimated bytes scanned, and any warnings (small files, missing column statistics).

**`DIAGNOSE`** scans the table's data files and reports how many are below the 128 MiB target size — a quick check for compaction candidates.

SQL keywords are case-insensitive. Predicates support `=`, `!=`, `<>`, `<`, `<=`, `>`, `>=`, `IS NULL`, `IS NOT NULL`, `IN (...)`, `NOT IN (...)`, `AND`, `OR`, and `NOT`.

### Sample output

```
sql> SELECT id, region, amount FROM retail.orders WHERE region = 'us-east-1' LIMIT 3
id=1, region=us-east-1, amount=312
id=2, region=us-east-1, amount=87
id=5, region=us-east-1, amount=204
(3 rows)

sql> SHOW TABLES IN retail
  namespace:                   retail
  tableCount:                  3
  tables:                      [retail.orders, retail.products, retail.regions]

sql> DIAGNOSE TABLE retail.orders
  smallFileThresholdBytes:     134217728
  smallFileCount:              4

sql> EXPLAIN SELECT * FROM retail.orders WHERE region = 'us-east-1'
┌──────────────────────────────────────────────────────────────────────┐
│  ICEBERG SCAN PLAN — retail.orders                                   │
├──────────────────────────────────────────────────────────────────────┤
│  Snapshot ID                         │  7326491023847162            │
│  Snapshot timestamp (ms)             │  1715000000000               │
│  Partition spec                      │  [region: identity]          │
│  Schema columns                      │  5                           │
│  Projected columns                   │  5                           │
├──────────────────────────────────────┬──────────────────────────────┤
│  Total manifest files                │  3                           │
│  Manifests after pruning             │  1                           │
│  Data files total                    │  10                          │
│  Data files after filter             │  2  (80.0% eliminated)       │
│  Estimated bytes scanned             │  1.2 MiB                     │
│  Pushdown filter                     │  ref(name="region") == ...   │
└──────────────────────────────────────┴──────────────────────────────┘
```

---

## Limitations

- **Single-table reads only** — no `JOIN`
- **No aggregate functions** — `COUNT`, `SUM`, `AVG`, `MIN`, `MAX`, and `GROUP BY` are not supported
- **No DML** — `INSERT`, `UPDATE`, and `DELETE` are not supported
- **No DDL** — `CREATE TABLE`, `DROP TABLE`, and `ALTER TABLE` are not supported
- **`ORDER BY` is in-memory** — all rows matching the filter are fetched before sorting; use `LIMIT` to bound the result set
- **No subqueries or CTEs**

---

## Quick start

### Prerequisites
- Java 21+
- A running Polaris server (or use the [demo](demo/README.md) — no server setup required)

### 1. Build

```bash
./gradlew generateGrammarSource shadowJar
```

This produces `build/libs/polaris-shell-demo.jar`.

### 2. Configure

Copy the example properties file and fill in your Polaris connection details:

```bash
cp polaris-sql-demo.properties.example polaris-sql-demo.properties
```

```properties
# Required
polaris.uri=http://localhost:8181/api/catalog
polaris.warehouse=my-catalog
polaris.client.id=root
polaris.client.secret=s3cr3t

# Optional
polaris.token.endpoint=http://localhost:8181/api/catalog/v1/oauth/tokens
cli.max-display-rows=100

# S3 / MinIO FileIO properties (pass-through to the Iceberg catalog)
# s3.endpoint=http://localhost:9000
# s3.path-style-access=true
# io-impl=org.apache.iceberg.aws.s3.S3FileIO
```

Any property not prefixed with `polaris.` or `cli.` is passed directly to the Iceberg catalog (useful for S3 region, MinIO credentials, custom FileIO implementations, etc.).

### 3. Run

```bash
java -jar build/libs/polaris-shell-demo.jar polaris-sql-demo.properties
```

```
Connecting to Polaris at http://localhost:8181/api/catalog ...
Authenticated. Type SQL statements or 'exit' to quit.

sql> SHOW TABLES IN retail
sql> SELECT * FROM retail.orders WHERE amount > 100 LIMIT 5
sql> EXPLAIN SELECT * FROM retail.orders WHERE region = 'us-east-1'
sql> exit
```

---

## Demo

The [`demo/`](demo/README.md) directory contains a fully local environment using **Docker Compose + MinIO** — no AWS account or external Polaris server required. It spins up Polaris, MinIO, and seeds three sample Iceberg tables in under a minute.

See **[demo/README.md](demo/README.md)** for step-by-step instructions.

---

## Configuration reference

| Property | Required | Default | Description |
|---|---|---|---|
| `polaris.uri` | Yes | — | Polaris REST catalog base URI |
| `polaris.warehouse` | Yes | — | Warehouse / catalog name |
| `polaris.client.id` | Yes | — | OAuth2 client ID |
| `polaris.client.secret` | Yes | — | OAuth2 client secret |
| `polaris.token.endpoint` | No | `{polaris.uri}/v1/oauth/tokens` | Token endpoint override |
| `cli.max-display-rows` | No | `100` | Row cap for SELECT output |
| *(any other key)* | No | — | Passed through to the Iceberg catalog |

---

## Building from source

```bash
# Generate ANTLR sources and build the fat JAR
./gradlew generateGrammarSource shadowJar

# Run tests
./gradlew test
```

Requires Java 21. The Gradle wrapper is included — no local Gradle installation needed.
