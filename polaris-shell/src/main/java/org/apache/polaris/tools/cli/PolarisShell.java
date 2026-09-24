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

import org.apache.polaris.tools.planner.IcebergRestQueryExecutor;
import org.apache.polaris.tools.planner.QueryExecutor;
import org.apache.polaris.tools.planner.QueryPlan;
import org.apache.polaris.tools.planner.SqlToQueryPlan;

import java.io.FileInputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.Properties;
import java.util.Scanner;

/**
 * Interactive SQL shell for querying an Iceberg catalog via Polaris.
 *
 * <h2>Usage</h2>
 * <pre>
 *   java -jar sql-engine-demo.jar [path/to/polaris-sql-demo.properties]
 * </pre>
 *
 * <p>If no path is given the shell looks for {@code polaris-sql-demo.properties} in the
 * current working directory.
 *
 * <h2>Required properties</h2>
 * <ul>
 *   <li>{@code polaris.uri} — Polaris REST catalog base URI, e.g.
 *       {@code http://localhost:8181/api/catalog}</li>
 *   <li>{@code polaris.warehouse} — warehouse / catalog name</li>
 *   <li>{@code polaris.client.id} — OAuth2 client ID</li>
 *   <li>{@code polaris.client.secret} — OAuth2 client secret</li>
 * </ul>
 *
 * <h2>Optional properties</h2>
 * <ul>
 *   <li>{@code polaris.token.endpoint} — defaults to {@code {polaris.uri}/v1/oauth/tokens}</li>
 *   <li>{@code cli.max-display-rows} — row cap for SELECT output (default: 100)</li>
 *   <li>Any other key (not prefixed with {@code polaris.} or {@code cli.}) is passed
 *       directly to the Iceberg catalog as a catalog property, e.g. S3 / MinIO settings.</li>
 * </ul>
 */
public class PolarisShell {

    public static void main(String[] args) throws Exception {
        String propsPath = args.length > 0 ? args[0] : "polaris-sql-demo.properties";

        // 1. Load properties
        Properties props = new Properties();
        try (var in = new FileInputStream(propsPath)) {
            props.load(in);
        } catch (java.io.FileNotFoundException e) {
            System.err.println("Properties file not found: " + propsPath);
            System.err.println("Create it from the polaris-sql-demo.properties.example template.");
            System.exit(1);
        }

        String uri           = required(props, "polaris.uri");
        String warehouse     = required(props, "polaris.warehouse");
        String clientId      = required(props, "polaris.client.id");
        String clientSecret  = required(props, "polaris.client.secret");
        int maxRows          = Integer.parseInt(props.getProperty("cli.max-display-rows", "100"));
        String tokenEndpoint = props.getProperty("polaris.token.endpoint", uri + "/v1/oauth/tokens");

        // 2. Obtain token
        System.out.println("Connecting to Polaris at " + uri + " ...");
        String token;
        try {
            token = OAuthHelper.obtainToken(tokenEndpoint, clientId, clientSecret);
        } catch (Exception e) {
            System.err.println("Failed to obtain OAuth token: " + e.getMessage());
            System.exit(1);
            return;
        }
        System.out.println("Authenticated. Type SQL statements or 'exit' to quit.\n");

        // 3. Build extra catalog properties (everything not prefixed polaris.* or cli.*)
        Map<String, String> extraProps = new HashMap<>();
        for (String key : props.stringPropertyNames()) {
            if (!key.startsWith("polaris.") && !key.startsWith("cli.")) {
                extraProps.put(key, props.getProperty(key));
            }
        }

        // 4. Start REPL
        var translator = new SqlToQueryPlan();
        try (var restExecutor  = new IcebergRestQueryExecutor(uri, warehouse, token, extraProps);
             var scanner       = new Scanner(System.in, StandardCharsets.UTF_8)) {

            var catalogExecutor = new QueryExecutor(restExecutor.getCatalog());

            while (true) {
                System.out.print("sql> ");
                if (!scanner.hasNextLine()) break;    // EOF (e.g. piped input)
                String line = scanner.nextLine().trim();

                if (line.isBlank()) continue;
                if (line.equalsIgnoreCase("exit") || line.equalsIgnoreCase("quit")) break;

                try {
                    QueryPlan plan = translator.translate(line);
                    ResultPrinter.print(plan, restExecutor, catalogExecutor, maxRows);
                } catch (IllegalArgumentException e) {
                    System.err.println("Parse error: " + e.getMessage());
                } catch (Exception e) {
                    System.err.println("Error: " + e.getMessage());
                }
            }
        }

        System.out.println("Bye.");
    }

    private static String required(Properties props, String key) {
        String value = props.getProperty(key);
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Missing required property: " + key);
        }
        return value.trim();
    }
}
