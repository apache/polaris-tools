# Objective

To provide users of [Apache Polaris (Incubating)](https://github.com/apache/polaris) a tool to be able to easily and efficiently
migrate their entities from one Polaris instance to another.

Polaris is a catalog of catalogs. It can become cumbersome to perform catalog-by-catalog migration of each and every catalog contained
within a Polaris instance. Additionally, while migrating catalog-by-catalog Iceberg entities is achievable using the
existing generic [iceberg-catalog-migrator](../iceberg-catalog-migrator/README.md), the existing tool will not migrate
Polaris specific entities, like principal-roles, catalog-roles, grants.

## Use Cases
* **Migration:** A user may have an active Polaris deployment that they want to migrate to a managed cloud offering like
  [Snowflake Open Catalog](https://www.snowflake.com/en/product/features/open-catalog/).
* **Preventing Vendor Lock-In:** A user may currently have a managed Polaris offering and want the freedom to switch providers or to host Polaris themselves.
* **Mirroring/Disaster Recovery:** Modern data solutions require employing redundancy to ensure no single point of
  failure. The tool can be scheduled on a cron to run periodic incremental syncs.

The tool currently supports migrating the following Polaris Management entities:
* Principal roles
* Catalogs
* Catalog Roles
* Assignment of Catalog Roles to Principal Roles
* Grants


> :warning: Polaris principals and their assignments to Principal roles are not supported for migration
> by this tool. Migrating client credentials stored in Polaris is not possible nor is it secure. Polaris
> principals must be manually migrated between Polaris instances.

The tool currently supports migrating the following Iceberg entities:
* Namespaces
* Tables

# Building the Tool from Source

**Prerequisite:** Must have Java installed in your machine (Java 21 is recommended and the minimum Java version) to use this CLI tool.

```
gradlew build # build and run tests
gradlew assemble # build without running tests
```

The default build location for the built JAR will be `cli/build/libs/`

# Migrating between Polaris Instances

### Step 1: Create a principal with read-only access to catalog internals on the source Polaris instance.

**This step only has to be completed once.**

Polaris is built with a separation between access and metadata management permissions. The `service_admin`
may have permissions to create access related entities like principal roles, catalog roles, and grants, but may not necessarily
possess the ability to view Iceberg content of catalogs, like namespaces and tables. We need to create a super user principal
that has access to all entities on the source Polaris instance in order to migrate them.

To do this, we can use the `create-omnipotent-principal` command to create a principal, principal role,
and a catalog role per catalog with the appropriate grants to read all entities on the source Polaris instance.

**Example:** Create a **read-only** principal on the source Polaris instance, and replace it if it already exists,
with 10 concurrent catalog setup threads:
```
java -jar polaris-synchronizer-cli.jar create-omnipotent-principal \
--polaris-client-id root \ 
--polaris-client-secret <client-secret> \
--polaris-base-url http://localhost:8181 \
--polaris-oauth2-server-uri http://localhost:8181/api/catalog/v1/oauth/tokens \
--polaris-scope PRINCIPAL_ROLE:ALL \
--replace \ # replace if it exists
--concurrency 10 # 10 concurrent catalog setup threads
```

Upon finishing execution, the tool will output the principal name and client credentials for this
principal. **Make sure to note these down as they will be necessary for the migration step.**

**Example Output:**
```
======================================================
Omnipotent Principal Credentials:
name = omnipotent-principal-XXXXX
clientId = ff7s8f9asbX10
clientSecret = <client-secret>
======================================================
```

Additionally, at the end of execution the command will output a list of catalogs for which catalog setup failed.
**These catalogs may experience failure during migration**.

**Example Output:**
```
Encountered issues creating catalog roles for the following catalogs: [catalog-1, catalog-2]
```

### Step 2: Create a principal with read-write access to catalog internals on the target Polaris instance.

**This step only has to be completed once.**

The same `create-omnipotent-principal` command can also be used to now create a **read-write** principal on the target
Polaris instance so that the tool can create entities on the target.

To create a read-write principal, we simply specify the `--write-access` option.

**Example:** Create a read-write principal on your target Polaris instance, replacing it if it exists, with 10 concurrent
catalog setup threads.
```
java -jar polaris-synchronizer-cli.jar create-omnipotent-principal \
--polaris-client-id root \ 
--polaris-client-secret <client-secret> \
--polaris-base-url http://localhost:8181 \
--polaris-oauth2-server-uri http://localhost:8181/api/catalog/v1/oauth/tokens \
--polaris-scope PRINCIPAL_ROLE:ALL \
--replace \ # replace if it exists
--concurrency 10 \ # 10 concurrent catalog setup threads 
--write-access # give the principal write access to catalog internals
```

Similarly to the last step, the tool will output the client credentials and principal name. Again, these need to be noted
for subsequent steps.

**Example Output:**
```
======================================================
Omnipotent Principal Credentials:
name = omnipotent-principal-YYYYY
clientId = 0af20a3a0037a40d
clientSecret = <client-secret>
======================================================
```

> :warning: `service_admin` is not guaranteed to have access management level grants on every catalog. This is usually
> delegated to the `catalog_admin` role, which is automatically granted to whichever principal role was used to create
> the catalog. This means that while the tool can detect this catalog when run with `service_admin` level access,
> it cannot create an omnipotent principal for this catalog. To remedy this, create a catalog-role with `CATALOG_MANAGE_ACCESS`
> grants for the catalog, and assign it to the principal used to run this tool (presumably, a principal with the `servic_admin`
> principal role). Then, re-running `create-omnipotent-principal` should be able to create the relevant entities for that catalog.

### Step 3: Running the Migration/Synchronization

Running the synchronization requires minimal reconfiguration, can be run idempotently, and will attempt to only copy over the
diff between the source and target Polaris instances. This can be achieved using the `sync-polaris` command.

**Example** Running the synchronization between source Polaris instance using an access token, and a target Polaris instance
using client credentials.
```
java -jar polaris-synchronizer-cli.jar sync-polaris \
--source-base-url http://localhost:8182 \
--source-access-token <bearer-token> \
--target-base-url http://localhost:8181 \
--target-client-id root \
--target-client-secret <secret> \
--target-oauth2-server-uri http://localhost:8181/api/catalog/v1/oauth/tokens \
--target-scope PRINCIPAL_ROLE:ALL \
--source-omni-principal-name omnipotent-principal-XXXXX \
--source-omni-client-id ff7s8f9asbX10 \
--source-omni-client-secret <secret> \
--target-omni-principal-name omnipotent-principal-YYYYY \
--target-omni-client-id 0af20a3a0037a40d \
--target-omni-client-secret <client-secret>
```

> :warning: The tool will not migrate the `service_admin`, `catalog_admin`, nor the omnipotent principals from the source
> nor remove or modify them on the target. This is to accommodate that the tool itself will be running with the permission
> levels for these principals and roles, and we do not want to modify the tool's permissions at runtime.
