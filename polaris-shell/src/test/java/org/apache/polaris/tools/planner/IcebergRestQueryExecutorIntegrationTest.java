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

package org.apache.polaris.tools.planner;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.apache.iceberg.DataFile;
import org.apache.iceberg.DataFiles;
import org.apache.iceberg.FileFormat;
import org.apache.iceberg.PartitionSpec;
import org.apache.iceberg.Schema;
import org.apache.iceberg.Table;
import org.apache.iceberg.catalog.Namespace;
import org.apache.iceberg.catalog.TableIdentifier;
import org.apache.iceberg.data.GenericRecord;
import org.apache.iceberg.data.Record;
import org.apache.iceberg.data.parquet.GenericParquetWriter;
import org.apache.iceberg.io.CloseableIterable;
import org.apache.iceberg.io.FileAppender;
import org.apache.iceberg.io.OutputFile;
import org.apache.iceberg.parquet.Parquet;
import org.apache.iceberg.aws.s3.S3FileIO;
import org.apache.iceberg.rest.RESTCatalog;
import org.apache.iceberg.types.Types;
import org.apache.polaris.test.minio.MinioContainer;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.Network;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class IcebergRestQueryExecutorIntegrationTest {

    static final String CATALOG_NAME = "sqltestcatalog";
    static final String NAMESPACE = "testns";
    static final String TABLE_NAME = "events";
    static final String CLIENT_ID = "root";
    static final String CLIENT_SECRET = "s3cr3t";
    static final String MINIO_ACCESS_KEY = "sqltest-ak";
    static final String MINIO_SECRET_KEY = "sqltest-sk";
    static final String BUCKET = "sqltest-bucket";
    static final String MINIO_ALIAS = "minio";
    static final int MINIO_PORT = 9000;

    static final Network network = Network.newNetwork();

    @Container
    static final MinioContainer minio = new MinioContainer(
            null, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, BUCKET, "us-east-1")
            .withNetwork(network)
            .withNetworkAliases(MINIO_ALIAS);

    @Container
    static final GenericContainer<?> polaris = new GenericContainer<>("apache/polaris:latest")
            .withNetwork(network)
            .withExposedPorts(8181, 8182)
            .withEnv("POLARIS_BOOTSTRAP_CREDENTIALS", "POLARIS," + CLIENT_ID + "," + CLIENT_SECRET)
            .withEnv("quarkus.otel.sdk.disabled", "true")
            .withEnv("AWS_REGION", "us-east-1")
            .withEnv("AWS_ACCESS_KEY_ID", MINIO_ACCESS_KEY)
            .withEnv("AWS_SECRET_ACCESS_KEY", MINIO_SECRET_KEY)
            .withEnv("polaris.features.\"ALLOW_INSECURE_STORAGE_TYPES\"", "true")
            .withEnv("polaris.features.\"SUPPORTED_CATALOG_STORAGE_TYPES\"", "[\"S3\"]")
            .withEnv("polaris.features.\"SKIP_CREDENTIAL_SUBSCOPING_INDIRECTION\"", "true")
            .withEnv("polaris.readiness.ignore-severe-issues", "true")
            .waitingFor(
                    Wait.forHttp("/q/health")
                            .forPort(8182)
                            .withStartupTimeout(Duration.ofMinutes(3)));

    static RESTCatalog restCatalog;
    static Schema schema;
    static String polarisBase;
    static String token;

    @BeforeAll
    void setUpCatalogAndData() throws Exception {
        polarisBase = "http://localhost:" + polaris.getMappedPort(8181);

        token = obtainToken(polarisBase, CLIENT_ID, CLIENT_SECRET);
        createPolarisS3Catalog(polarisBase, token, minio);

        // Build RESTCatalog pointed at Polaris with MinIO S3 FileIO properties
        Map<String, String> props = new HashMap<>();
        props.put("uri", polarisBase + "/api/catalog");
        props.put("warehouse", CATALOG_NAME);
        props.put("token", token);
        props.putAll(minio.icebergProperties());
        props.put("s3.path-style-access", "true");
        props.put("io-impl", "org.apache.iceberg.aws.s3.S3FileIO");

        restCatalog = new RESTCatalog();
        restCatalog.initialize("polaris-inttest", props);

        schema = new Schema(
                Types.NestedField.required(1, "id", Types.IntegerType.get()),
                Types.NestedField.required(2, "name", Types.StringType.get()),
                Types.NestedField.required(3, "value", Types.DoubleType.get()));

        Namespace ns = Namespace.of(NAMESPACE);
        restCatalog.createNamespace(ns);
        Table table = restCatalog.createTable(
                TableIdentifier.of(ns, TABLE_NAME),
                schema,
                PartitionSpec.unpartitioned());

        writeTestRecords(table);
    }

    // ── SELECT via IcebergRestQueryExecutor ───────────────────────────────────

    @Test
    void selectAllColumnsReturnsAllRows() throws Exception {
        SqlToQueryPlan translator = new SqlToQueryPlan();
        QueryPlan plan = translator.translate("SELECT * FROM " + NAMESPACE + "." + TABLE_NAME);

        Map<String, String> s3Props = new HashMap<>(minio.icebergProperties());
        s3Props.put("s3.path-style-access", "true");
        s3Props.put("io-impl", "org.apache.iceberg.aws.s3.S3FileIO");

        try (IcebergRestQueryExecutor executor = new IcebergRestQueryExecutor(
                polarisBase + "/api/catalog", CATALOG_NAME, token, s3Props);
             CloseableIterable<Record> records = executor.execute((QueryPlan.Select) plan)) {

            List<Record> rows = toList(records);
            assertThat(rows).hasSize(3);
        }
    }

    @Test
    void selectWithFilterReturnsMatchingRows() throws Exception {
        SqlToQueryPlan translator = new SqlToQueryPlan();
        QueryPlan plan = translator.translate(
                "SELECT id, name, value FROM " + NAMESPACE + "." + TABLE_NAME + " WHERE value > 50");

        Map<String, String> s3Props = new HashMap<>(minio.icebergProperties());
        s3Props.put("s3.path-style-access", "true");
        s3Props.put("io-impl", "org.apache.iceberg.aws.s3.S3FileIO");

        try (IcebergRestQueryExecutor executor = new IcebergRestQueryExecutor(
                polarisBase + "/api/catalog", CATALOG_NAME, token, s3Props);
             CloseableIterable<Record> records = executor.executeWithLimit((QueryPlan.Select) plan)) {

            List<Record> rows = toList(records);
            // Alice (75.0) and Carol (90.0) pass the filter; Bob (25.0) does not
            assertThat(rows).hasSize(2);
            assertThat(rows).extracting(r -> r.getField("name"))
                    .containsExactlyInAnyOrder("Alice", "Carol");
            // Verify the predicate actually filtered on value, not just row count
            assertThat(rows).extracting(r -> r.getField("value"))
                    .allSatisfy(v -> assertThat((Double) v).isGreaterThan(50.0));
        }
    }

    @Test
    void selectWithLimitReturnsAtMostNRows() throws Exception {
        SqlToQueryPlan translator = new SqlToQueryPlan();
        QueryPlan plan = translator.translate(
                "SELECT * FROM " + NAMESPACE + "." + TABLE_NAME + " LIMIT 1");

        Map<String, String> s3Props = new HashMap<>(minio.icebergProperties());
        s3Props.put("s3.path-style-access", "true");
        s3Props.put("io-impl", "org.apache.iceberg.aws.s3.S3FileIO");

        try (IcebergRestQueryExecutor executor = new IcebergRestQueryExecutor(
                polarisBase + "/api/catalog", CATALOG_NAME, token, s3Props);
             CloseableIterable<Record> records = executor.executeWithLimit((QueryPlan.Select) plan)) {

            List<Record> rows = toList(records);
            assertThat(rows).hasSize(1);
        }
    }

    // ── Stats commands via QueryExecutor ──────────────────────────────────────

    @Test
    void showTablesReturnsEventsTable() {
        QueryExecutor executor = new QueryExecutor(restCatalog);
        Object result = executor.execute(new QueryPlan.ShowTables(NAMESPACE));

        @SuppressWarnings("unchecked")
        Map<String, Object> map = (Map<String, Object>) result;
        assertThat(map).containsEntry("namespace", NAMESPACE);
        assertThat((int) map.get("tableCount")).isGreaterThanOrEqualTo(1);
    }

    @Test
    void describeStatsReturnsSnapshotInfo() {
        QueryExecutor executor = new QueryExecutor(restCatalog);
        Object result = executor.execute(new QueryPlan.DescribeStats(NAMESPACE + "." + TABLE_NAME));

        @SuppressWarnings("unchecked")
        Map<String, Object> map = (Map<String, Object>) result;
        assertThat((long) map.get("snapshotCount")).isGreaterThanOrEqualTo(1L);
        assertThat((long) map.get("currentSnapshotId")).isNotEqualTo(-1L);
    }

    @Test
    void showLocationReturnsS3Uri() {
        QueryExecutor executor = new QueryExecutor(restCatalog);
        Object result = executor.execute(new QueryPlan.ShowLocation(NAMESPACE + "." + TABLE_NAME));

        @SuppressWarnings("unchecked")
        Map<String, Object> map = (Map<String, Object>) result;
        assertThat((String) map.get("location")).startsWith("s3://");
    }

    // ── EXPLAIN via QueryExecutor ─────────────────────────────────────────────

    @Test
    void explainSelectShowsDataFileStats() {
        SqlToQueryPlan translator = new SqlToQueryPlan();
        QueryPlan plan = translator.translate(
            "EXPLAIN SELECT * FROM " + NAMESPACE + "." + TABLE_NAME + " WHERE value > 50");

        QueryExecutor executor = new QueryExecutor(restCatalog);
        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) executor.execute(plan);

        assertThat(result).containsKey("snapshotId");
        assertThat((long) result.get("totalDataFiles")).isGreaterThanOrEqualTo(1L);
        assertThat((long) result.get("dataFilesAfterFilter")).isGreaterThanOrEqualTo(0L);
        assertThat(result.get("warnings")).isInstanceOf(List.class);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** POST to Polaris /oauth/tokens and extract the access_token value. */
    private static String obtainToken(String base, String clientId, String clientSecret)
            throws Exception {
        String body = "grant_type=client_credentials"
                + "&client_id=" + URLEncoder.encode(clientId, StandardCharsets.UTF_8)
                + "&client_secret=" + URLEncoder.encode(clientSecret, StandardCharsets.UTF_8)
                + "&scope=PRINCIPAL_ROLE:ALL";

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(base + "/api/catalog/v1/oauth/tokens"))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

        HttpResponse<String> resp = HttpClient.newHttpClient()
                .send(req, HttpResponse.BodyHandlers.ofString());
        assertThat(resp.statusCode()).as("OAuth token response").isIn(200, 201);

        String body2 = resp.body();
        Matcher matcher = Pattern.compile("\"access_token\"\\s*:\\s*\"([^\"]+)\"").matcher(body2);
        if (!matcher.find()) {
            throw new IllegalStateException("No access_token in OAuth response: " + body2);
        }
        return matcher.group(1);
    }

    /**
     * Creates a Polaris catalog backed by the MinIO bucket using the Management API.
     * Uses a fake roleArn with ALLOW_INSECURE_STORAGE_TYPES enabled so Polaris accepts
     * S3 storage without real AWS credential validation.
     */
    private static void createPolarisS3Catalog(
            String base, String token, MinioContainer minio) throws Exception {
        String bucket = minio.bucket();
        // Internal endpoint: Polaris container → MinIO via Docker network alias.
        // All catalog properties use this so that both Polaris server-side AND
        // vended client-side configs can reach MinIO. Our test JVM overrides the
        // endpoint in its own RESTCatalog init properties.
        String serverEndpoint = "http://" + MINIO_ALIAS + ":" + MINIO_PORT + "/";

        String json = String.format(
                """
                {
                  "catalog": {
                    "type": "INTERNAL",
                    "name": "%s",
                    "properties": {
                      "default-base-location": "s3://%s/warehouse",
                      "s3.endpoint": "%s",
                      "s3.path-style-access": "true",
                      "s3.access-key-id": "%s",
                      "s3.secret-access-key": "%s",
                      "table-default.s3.endpoint": "%s",
                      "table-default.s3.path-style-access": "true",
                      "table-default.s3.access-key-id": "%s",
                      "table-default.s3.secret-access-key": "%s"
                    },
                    "storageConfigInfo": {
                      "storageType": "S3",
                      "allowedLocations": ["s3://%s"],
                      "roleArn": "arn:aws:iam::123456789012:role/polaris-inttest",
                      "endpoint": "%s"
                    }
                  }
                }
                """,
                CATALOG_NAME,
                bucket,
                serverEndpoint,
                minio.accessKey(),
                minio.secretKey(),
                serverEndpoint,
                minio.accessKey(),
                minio.secretKey(),
                bucket,
                serverEndpoint);

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(base + "/api/management/v1/catalogs"))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + token)
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build();

        HttpResponse<String> resp = HttpClient.newHttpClient()
                .send(req, HttpResponse.BodyHandlers.ofString());
        assertThat(resp.statusCode())
                .as("Create catalog response body: " + resp.body())
                .isIn(200, 201);
    }

    /**
     * Writes 3 test records to the Iceberg table as a Parquet data file.
     * Uses a local S3FileIO configured with the external MinIO endpoint
     * (localhost mapped port) because the table's own FileIO is configured
     * with the Docker-internal endpoint (minio:9000) which isn't reachable
     * from the test JVM.
     */
    private static void writeTestRecords(Table table) throws Exception {
        List<Record> records = List.of(
                row(table.schema(), 1, "Alice", 75.0),
                row(table.schema(), 2, "Bob", 25.0),
                row(table.schema(), 3, "Carol", 90.0));

        // Create a FileIO that reaches MinIO from the test JVM (localhost port)
        S3FileIO localFileIO = new S3FileIO();
        Map<String, String> ioProps = new HashMap<>(minio.icebergProperties());
        ioProps.put("s3.path-style-access", "true");
        localFileIO.initialize(ioProps);

        String location = table.locationProvider()
                .newDataLocation(UUID.randomUUID() + ".parquet");
        OutputFile outputFile = localFileIO.newOutputFile(location);

        FileAppender<Record> writer = Parquet.write(outputFile)
                .schema(table.schema())
                .createWriterFunc(GenericParquetWriter::create)
                .build();
        writer.addAll(records);
        writer.close();
        org.apache.iceberg.Metrics fileMetrics = writer.metrics();
        long fileSize = localFileIO.newInputFile(location).getLength();
        DataFile dataFile = DataFiles.builder(table.spec())
                .withPath(location)
                .withFileSizeInBytes(fileSize)
                .withMetrics(fileMetrics)
                .withFormat(FileFormat.PARQUET)
                .build();

        table.newAppend().appendFile(dataFile).commit();
    }

    private static Record row(Schema schema, int id, String name, double value) {
        GenericRecord record = GenericRecord.create(schema);
        record.setField("id", id);
        record.setField("name", name);
        record.setField("value", value);
        return record;
    }

    private static List<Record> toList(CloseableIterable<Record> iterable) {
        List<Record> list = new ArrayList<>();
        iterable.forEach(list::add);
        return list;
    }
}
