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

package org.apache.polaris.tools.cli;

import org.apache.iceberg.DataFile;
import org.apache.iceberg.DataFiles;
import org.apache.iceberg.FileFormat;
import org.apache.iceberg.PartitionKey;
import org.apache.iceberg.PartitionSpec;
import org.apache.iceberg.Schema;
import org.apache.iceberg.Table;
import org.apache.iceberg.aws.s3.S3FileIO;
import org.apache.iceberg.catalog.Namespace;
import org.apache.iceberg.catalog.TableIdentifier;
import org.apache.iceberg.data.GenericRecord;
import org.apache.iceberg.data.Record;
import org.apache.iceberg.data.parquet.GenericParquetWriter;
import org.apache.iceberg.io.FileAppender;
import org.apache.iceberg.io.OutputFile;
import org.apache.iceberg.parquet.Parquet;
import org.apache.iceberg.rest.RESTCatalog;
import org.apache.iceberg.types.Types;

import java.io.FileInputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.Random;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Seeds a local Polaris + MinIO demo environment with realistic Iceberg tables and data.
 *
 * <p>Usage: java -cp polaris-sql-engine-*-demo.jar \
 *               org.apache.polaris.tools.cli.DemoDataSeeder [path/to/demo.properties]
 *
 * <p>Idempotent: re-running skips already-existing catalogs, namespaces, and tables.
 */
public class DemoDataSeeder {

    private static final Pattern ACCESS_TOKEN_PATTERN =
        Pattern.compile("\"access_token\"\\s*:\\s*\"([^\"]+)\"");

    static final String CATALOG   = "demo";
    static final String NAMESPACE = "retail";
    static final String BUCKET    = "demo-bucket";

    // Internal MinIO endpoint used in catalog storage config (Polaris → MinIO via Docker network).
    // For a host-only demo both point to localhost, which is fine because
    // SKIP_CREDENTIAL_SUBSCOPING_INDIRECTION is enabled.
    static final String MINIO_ENDPOINT = "http://localhost:9000";

    public static void main(String[] args) throws Exception {
        String propsPath = args.length > 0 ? args[0] : "demo.properties";
        Properties props = new Properties();
        try (var in = new FileInputStream(propsPath)) { props.load(in); }

        String polarisUri    = props.getProperty("polaris.uri");
        String clientId      = props.getProperty("polaris.client.id");
        String clientSecret  = props.getProperty("polaris.client.secret");
        String s3Endpoint         = props.getProperty("s3.endpoint", MINIO_ENDPOINT);
        // Polaris runs inside Docker, so it must reach MinIO via the Docker-internal hostname.
        // Falls back to s3.endpoint if not set (e.g. non-Docker deployments).
        String s3InternalEndpoint = props.getProperty("s3.internal-endpoint", s3Endpoint);
        String accessKey          = props.getProperty("s3.access-key-id");
        String secretKey          = props.getProperty("s3.secret-access-key");

        System.out.println("Connecting to Polaris at " + polarisUri + " ...");
        String token = obtainToken(polarisUri, clientId, clientSecret);
        System.out.println("Authenticated.");

        createCatalogIfAbsent(polarisUri, token, accessKey, secretKey, s3Endpoint, s3InternalEndpoint);

        // Build RESTCatalog
        Map<String, String> catalogProps = new HashMap<>();
        catalogProps.put("uri", polarisUri);
        catalogProps.put("warehouse", CATALOG);
        catalogProps.put("token", token);
        catalogProps.put("io-impl", "org.apache.iceberg.aws.s3.S3FileIO");
        catalogProps.put("s3.endpoint", s3Endpoint);
        catalogProps.put("s3.path-style-access", "true");
        catalogProps.put("s3.access-key-id", accessKey);
        catalogProps.put("s3.secret-access-key", secretKey);

        try (RESTCatalog catalog = new RESTCatalog()) {
            catalog.initialize("demo-seed", catalogProps);

            Namespace ns = Namespace.of(NAMESPACE);
            if (!catalog.namespaceExists(ns)) {
                catalog.createNamespace(ns);
                System.out.println("Created namespace: " + NAMESPACE);
            }

            // S3FileIO for writing Parquet files
            S3FileIO fileIO = new S3FileIO();
            fileIO.initialize(Map.of(
                "s3.endpoint", s3Endpoint,
                "s3.path-style-access", "true",
                "s3.access-key-id", accessKey,
                "s3.secret-access-key", secretKey));

            seedOrdersTable(catalog, fileIO);
            seedProductsTable(catalog, fileIO);
            seedRegionsTable(catalog, fileIO);
        }

        System.out.println("\nDemo data ready. Try these queries:");
        System.out.println("  SHOW TABLES IN retail");
        System.out.println("  SELECT * FROM retail.orders WHERE amount > 100 LIMIT 10");
        System.out.println("  SELECT * FROM retail.orders ORDER BY amount DESC LIMIT 5");
        System.out.println("  DESCRIBE STATS retail.orders");
        System.out.println("  DIAGNOSE TABLE retail.orders");
        System.out.println("  EXPLAIN SELECT * FROM retail.orders WHERE region = 'us-east-1'");
    }

    // ── Table: retail.orders ──────────────────────────────────────────────────

    private static void seedOrdersTable(RESTCatalog catalog, S3FileIO fileIO) throws Exception {
        TableIdentifier id = TableIdentifier.of(NAMESPACE, "orders");
        Schema schema = new Schema(
            Types.NestedField.required(1, "order_id",   Types.IntegerType.get()),
            Types.NestedField.required(2, "customer",   Types.StringType.get()),
            Types.NestedField.required(3, "region",     Types.StringType.get()),
            Types.NestedField.required(4, "amount",     Types.DoubleType.get()),
            Types.NestedField.required(5, "status",     Types.StringType.get()));

        PartitionSpec spec = PartitionSpec.builderFor(schema).identity("region").build();
        Table table = getOrCreateTable(catalog, id, schema, spec);

        // Write two data files — one per region — to exercise partition pruning in EXPLAIN
        List<Record> usEast = new ArrayList<>();
        List<Record> euWest = new ArrayList<>();
        String[] statuses = {"COMPLETED", "PENDING", "SHIPPED", "CANCELLED"};
        Random rng = new Random(42);
        for (int i = 1; i <= 200; i++) {
            GenericRecord r = GenericRecord.create(schema);
            r.setField("order_id", i);
            r.setField("customer", "Customer-" + i);
            r.setField("amount",   Math.round(rng.nextDouble() * 500 * 100.0) / 100.0);
            r.setField("status",   statuses[rng.nextInt(statuses.length)]);
            if (i % 2 == 0) {
                r.setField("region", "us-east-1");
                usEast.add(r);
            } else {
                r.setField("region", "eu-west-1");
                euWest.add(r);
            }
        }
        appendRecords(table, fileIO, schema, spec, usEast);
        appendRecords(table, fileIO, schema, spec, euWest);
        System.out.println("Seeded retail.orders (200 rows)");
    }

    // ── Table: retail.products ────────────────────────────────────────────────

    private static void seedProductsTable(RESTCatalog catalog, S3FileIO fileIO) throws Exception {
        TableIdentifier id = TableIdentifier.of(NAMESPACE, "products");
        Schema schema = new Schema(
            Types.NestedField.required(1, "product_id", Types.IntegerType.get()),
            Types.NestedField.required(2, "name",       Types.StringType.get()),
            Types.NestedField.required(3, "category",   Types.StringType.get()),
            Types.NestedField.required(4, "price",      Types.DoubleType.get()),
            Types.NestedField.required(5, "in_stock",   Types.BooleanType.get()));

        Table table = getOrCreateTable(catalog, id, schema, PartitionSpec.unpartitioned());

        String[] categories = {"Electronics", "Clothing", "Food", "Books", "Tools"};
        List<Record> rows = new ArrayList<>();
        Random rng = new Random(7);
        for (int i = 1; i <= 50; i++) {
            GenericRecord r = GenericRecord.create(schema);
            r.setField("product_id", i);
            r.setField("name",       "Product-" + i);
            r.setField("category",   categories[i % categories.length]);
            r.setField("price",      Math.round(rng.nextDouble() * 200 * 100.0) / 100.0);
            r.setField("in_stock",   rng.nextBoolean());
            rows.add(r);
        }
        appendRecords(table, fileIO, schema, PartitionSpec.unpartitioned(), rows);
        System.out.println("Seeded retail.products (50 rows)");
    }

    // ── Table: retail.regions ─────────────────────────────────────────────────

    private static void seedRegionsTable(RESTCatalog catalog, S3FileIO fileIO) throws Exception {
        TableIdentifier id = TableIdentifier.of(NAMESPACE, "regions");
        Schema schema = new Schema(
            Types.NestedField.required(1, "region_id",   Types.StringType.get()),
            Types.NestedField.required(2, "description", Types.StringType.get()),
            Types.NestedField.required(3, "timezone",    Types.StringType.get()));

        Table table = getOrCreateTable(catalog, id, schema, PartitionSpec.unpartitioned());

        List<Record> rows = List.of(
            row(schema, "us-east-1", "US East (N. Virginia)",   "America/New_York"),
            row(schema, "eu-west-1", "EU West (Ireland)",        "Europe/Dublin"),
            row(schema, "ap-south-1","Asia Pacific (Mumbai)",    "Asia/Kolkata"));

        appendRecords(table, fileIO, schema, PartitionSpec.unpartitioned(), rows);
        System.out.println("Seeded retail.regions (3 rows)");
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static Table getOrCreateTable(
            RESTCatalog catalog, TableIdentifier id, Schema schema, PartitionSpec spec) {
        if (catalog.tableExists(id)) {
            System.out.println("Table already exists, skipping: " + id);
            return catalog.loadTable(id);
        }
        return catalog.createTable(id, schema, spec);
    }

    private static void appendRecords(
            Table table, S3FileIO fileIO, Schema schema, PartitionSpec spec,
            List<Record> records) throws Exception {
        if (records.isEmpty()) return;

        String location = table.locationProvider()
            .newDataLocation(UUID.randomUUID() + ".parquet");
        OutputFile outputFile = fileIO.newOutputFile(location);

        FileAppender<Record> appender = Parquet.write(outputFile)
            .schema(schema)
            .createWriterFunc(GenericParquetWriter::create)
            .build();
        appender.addAll(records);
        appender.close();

        DataFiles.Builder fileBuilder = DataFiles.builder(spec)
            .withPath(location)
            .withFileSizeInBytes(fileIO.newInputFile(location).getLength())
            .withMetrics(appender.metrics())
            .withFormat(FileFormat.PARQUET)
            .withRecordCount(records.size());

        if (spec.isPartitioned()) {
            PartitionKey key = new PartitionKey(spec, schema);
            key.partition(records.get(0));
            fileBuilder = fileBuilder.withPartition(key);
        }

        DataFile dataFile = fileBuilder.build();

        table.newAppend().appendFile(dataFile).commit();
    }

    private static GenericRecord row(Schema schema, Object... values) {
        GenericRecord r = GenericRecord.create(schema);
        List<Types.NestedField> fields = schema.columns();
        for (int i = 0; i < values.length; i++) r.setField(fields.get(i).name(), values[i]);
        return r;
    }

    private static void createCatalogIfAbsent(
            String polarisUri, String token,
            String accessKey, String secretKey,
            String s3Endpoint, String s3InternalEndpoint) throws Exception {
        String json = String.format("""
            {
              "catalog": {
                "type": "INTERNAL",
                "name": "%s",
                "properties": {
                  "default-base-location": "s3://%s/warehouse",
                  "s3.endpoint": "%s",
                  "s3.path-style-access": "true",
                  "s3.access-key-id": "%s",
                  "s3.secret-access-key": "%s"
                },
                "storageConfigInfo": {
                  "storageType": "S3",
                  "allowedLocations": ["s3://%s"],
                  "roleArn": "arn:aws:iam::000000000000:role/demo",
                  "endpoint": "%s",
                  "endpointInternal": "%s",
                  "pathStyleAccess": true,
                  "stsUnavailable": true
                }
              }
            }
            """, CATALOG, BUCKET, s3Endpoint, accessKey, secretKey, BUCKET, s3Endpoint, s3InternalEndpoint);

        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create(polarisUri.replace("/api/catalog", "") + "/api/management/v1/catalogs"))
            .header("Content-Type", "application/json")
            .header("Authorization", "Bearer " + token)
            .POST(HttpRequest.BodyPublishers.ofString(json))
            .build();
        HttpResponse<String> resp = HttpClient.newHttpClient()
            .send(req, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() == 409) {
            System.out.println("Catalog already exists, skipping creation.");
        } else if (resp.statusCode() >= 300) {
            throw new RuntimeException("Failed to create catalog: " + resp.body());
        }
    }

    private static String obtainToken(String uri, String clientId, String clientSecret)
            throws Exception {
        String body = "grant_type=client_credentials"
            + "&client_id=" + URLEncoder.encode(clientId, StandardCharsets.UTF_8)
            + "&client_secret=" + URLEncoder.encode(clientSecret, StandardCharsets.UTF_8)
            + "&scope=PRINCIPAL_ROLE:ALL";
        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create(uri + "/v1/oauth/tokens"))
            .header("Content-Type", "application/x-www-form-urlencoded")
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build();
        HttpResponse<String> resp = HttpClient.newHttpClient()
            .send(req, HttpResponse.BodyHandlers.ofString());
        Matcher m = ACCESS_TOKEN_PATTERN.matcher(resp.body());
        if (!m.find()) throw new IllegalStateException("No access_token in: " + resp.body());
        return m.group(1);
    }
}
