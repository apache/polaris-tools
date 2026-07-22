# Manual Test Setup

Brings up two independent Apache Polaris instances (source + target) to
manually validate `polaris-synchronizer`, including the `--skip-iceberg-content`
flag, without needing Postgres/RDS or S3/MinIO:

* Both instances use Polaris's default **in-memory metastore** (no datasource
  configured).
* Both instances share a single **FILE storage volume**, mounted at the same
  path in each container — so table metadata written by source is readable
  by target, and a full sync (including namespace/table content) actually
  succeeds. This lets you run the full sync and the `--skip-iceberg-content`
  sync back-to-back in the same session and compare the results.

`polaris-init` seeds SOURCE with a catalog, principal, principal-role,
catalog-role, grant, namespace, and table. TARGET is left completely empty —
`polaris-synchronizer` is responsible for creating everything there.

## Usage

```bash
cd polaris-synchronizer/manual-test
docker compose up --build -d
docker compose ps        # wait for polaris-init to show "Exited (0)"
cat seed/credentials.json
```

Polaris REST/management APIs are reachable at `http://localhost:8181` (source)
and `http://localhost:8183` (target).

Build the CLI jar from the `polaris-synchronizer` root:

```bash
cd ..
./gradlew assemble
# jar is at cli/build/libs/polaris-synchronizer-cli.jar
```

### Step 1: Create a read-only omnipotent principal on source

```bash
java -jar cli/build/libs/polaris-synchronizer-cli.jar create-omnipotent-principal \
  --polaris-api-connection-properties base-url=http://localhost:8181 \
  --polaris-api-connection-properties oauth2-server-uri=http://localhost:8181/api/catalog/v1/oauth/tokens \
  --polaris-api-connection-properties credential=root:s3cr3t \
  --polaris-api-connection-properties scope=PRINCIPAL_ROLE:ALL \
  --replace
```

Note the `clientId`/`clientSecret` printed at the end — this is
`SOURCE_OMNI_ID` / `SOURCE_OMNI_SECRET` below.

### Step 2: Create a read-write omnipotent principal on target

```bash
java -jar cli/build/libs/polaris-synchronizer-cli.jar create-omnipotent-principal \
  --polaris-api-connection-properties base-url=http://localhost:8183 \
  --polaris-api-connection-properties oauth2-server-uri=http://localhost:8183/api/catalog/v1/oauth/tokens \
  --polaris-api-connection-properties credential=root:s3cr3t \
  --polaris-api-connection-properties scope=PRINCIPAL_ROLE:ALL \
  --replace \
  --write-access
```

Note the credentials printed here — this is `TARGET_OMNI_ID` / `TARGET_OMNI_SECRET`.

Since TARGET starts with no catalogs, this step will report 0 catalogs
processed — that's expected. `sync-polaris` will create the target's catalog
before syncing catalog-roles/grants, so there's nothing to set up yet.

### Step 3a: Run with `--skip-iceberg-content`

```bash
java -jar cli/build/libs/polaris-synchronizer-cli.jar sync-polaris \
  --source-properties base-url=http://localhost:8181 \
  --source-properties credential=root:s3cr3t \
  --source-properties oauth2-server-uri=http://localhost:8181/api/catalog/v1/oauth/tokens \
  --source-properties scope=PRINCIPAL_ROLE:ALL \
  --source-properties omnipotent-principal-name=<name-from-step-1> \
  --source-properties omnipotent-principal-client-id=<SOURCE_OMNI_ID> \
  --source-properties omnipotent-principal-client-secret=<SOURCE_OMNI_SECRET> \
  --target-properties base-url=http://localhost:8183 \
  --target-properties credential=root:s3cr3t \
  --target-properties oauth2-server-uri=http://localhost:8183/api/catalog/v1/oauth/tokens \
  --target-properties scope=PRINCIPAL_ROLE:ALL \
  --target-properties omnipotent-principal-name=<name-from-step-2> \
  --target-properties omnipotent-principal-client-id=<TARGET_OMNI_ID> \
  --target-properties omnipotent-principal-client-secret=<TARGET_OMNI_SECRET> \
  --skip-iceberg-content
```

Catalog, catalog-role, and grant sync complete, but namespace/table sync is
skipped entirely — verify below that target has zero namespaces.

### Step 3b: Re-run without `--skip-iceberg-content` (full sync)

Drop `--skip-iceberg-content` from the same command and re-run it. Since the
storage volume is shared, `test_table`'s metadata is now readable by target
too, so namespace/table sync succeeds this time — target ends up with the
namespace and table that were skipped in Step 3a.

### Verify on target

```bash
TARGET_TOKEN=$(curl -sf -X POST http://localhost:8183/api/catalog/v1/oauth/tokens \
  -d "grant_type=client_credentials&client_id=root&client_secret=s3cr3t&scope=PRINCIPAL_ROLE:ALL" \
  | jq -r '.access_token')

curl -sf http://localhost:8183/api/management/v1/catalogs/test-catalog/catalog-roles \
  -H "Authorization: Bearer $TARGET_TOKEN" | jq

# After Step 3a (--skip-iceberg-content), this returns an empty list.
# After Step 3b (full sync), this returns test_ns.
curl -sf http://localhost:8183/api/catalog/v1/test-catalog/namespaces \
  -H "Authorization: Bearer $TARGET_TOKEN" | jq
```

Tear down with:

```bash
docker compose down -v
```
