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

import org.apache.iceberg.data.Record;
import org.apache.iceberg.io.CloseableIterable;
import org.apache.iceberg.types.Types;
import org.apache.polaris.tools.planner.IcebergRestQueryExecutor;
import org.apache.polaris.tools.planner.QueryExecutor;
import org.apache.polaris.tools.planner.QueryPlan;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.OptionalLong;

/**
 * Formats and prints the results of executing a {@link QueryPlan} to stdout.
 *
 * <p>SELECT plans are executed via {@link IcebergRestQueryExecutor} and rows are
 * printed one per line. All other plans are executed via {@link QueryExecutor} and
 * the returned {@code Map} is printed as aligned key-value pairs.
 */
class ResultPrinter {

    /**
     * Executes the given plan and prints results to stdout.
     *
     * @param plan            the plan to execute
     * @param restExecutor    executor for SELECT plans (reads actual table data)
     * @param catalogExecutor executor for metadata plans (SHOW, DESCRIBE, DIAGNOSE, EXPLAIN)
     * @param maxRows         display cap for SELECT results; ignored if the plan already has a LIMIT
     */
    static void print(QueryPlan plan,
                      IcebergRestQueryExecutor restExecutor,
                      QueryExecutor catalogExecutor,
                      int maxRows) throws Exception {
        switch (plan) {
            case QueryPlan.Select select -> printSelect(select, restExecutor, maxRows);
            case QueryPlan.Explain ex   -> printExplain(ex, catalogExecutor);
            default                     -> printCatalogResult(catalogExecutor.execute(plan));
        }
    }

    private static void printSelect(QueryPlan.Select plan,
                                    IcebergRestQueryExecutor executor,
                                    int maxRows) throws Exception {
        // Honour an existing LIMIT; otherwise cap at maxRows to protect the terminal
        QueryPlan.Select capped = plan.limit().isPresent()
                ? plan
                : new QueryPlan.Select(
                        plan.namespacedTable(),
                        plan.projectedColumns(),
                        plan.filter(),
                        plan.orderBy(),
                        OptionalLong.of(maxRows));

        int count = 0;
        if (!plan.orderBy().isEmpty()) {
            List<Record> rows = executor.executeOrdered(capped);
            for (Record r : rows) {
                System.out.println(formatRecord(r));
                count++;
            }
        } else {
            try (CloseableIterable<Record> records = executor.executeWithLimit(capped)) {
                for (Record r : records) {
                    System.out.println(formatRecord(r));
                    count++;
                }
            }
        }
        System.out.printf("(%d row%s)%n", count, count == 1 ? "" : "s");
    }

    private static void printExplain(QueryPlan.Explain plan, QueryExecutor catalogExecutor) {
        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) catalogExecutor.execute(plan);

        int width = 70;
        String border = "─".repeat(width);
        System.out.println("┌" + border + "┐");
        System.out.printf("│  ICEBERG SCAN PLAN — %-49s│%n", result.get("table"));
        System.out.println("├──────────────────────────────────────┬" + "─".repeat(32) + "┤");
        printRow("Snapshot ID",             result.get("snapshotId"));
        printRow("Snapshot timestamp (ms)", result.get("snapshotTimestampMs"));
        printRow("Partition spec",          result.get("partitionSpec"));
        printRow("Schema columns",          result.get("schemaColumnCount"));
        printRow("Projected columns",       result.get("projectedColumnCount"));
        System.out.println("├──────────────────────────────────────┬" + "─".repeat(32) + "┤");
        long total = (long) result.get("totalDataFiles");
        long after = (long) result.get("dataFilesAfterFilter");
        double pct  = total > 0 ? 100.0 * (total - after) / total : 0.0;
        printRow("Total manifest files",    result.get("totalManifestFiles"));
        printRow("Manifests after pruning", result.get("manifestsAfterPruning"));
        printRow("Data files total",        total);
        printRow("Data files after filter", String.format("%d  (%.1f%% eliminated)", after, pct));
        printRow("Estimated bytes scanned", formatBytes((long) result.get("estimatedBytes")));
        printRow("Pushdown filter",         result.get("pushdownFilter"));
        @SuppressWarnings("unchecked")
        List<String> warnings = (List<String>) result.get("warnings");
        if (!warnings.isEmpty()) {
            System.out.println("├──────────────────────────────────────┴" + "─".repeat(32) + "┤");
            System.out.println("│  ⚠ Warnings" + " ".repeat(width - 12) + "│");
            for (String w : warnings) System.out.printf("│  • %-67s│%n", w);
        }
        System.out.println("└" + border + "┘");
    }

    private static void printRow(String label, Object value) {
        System.out.printf("│  %-36s│  %-30s│%n", label, value);
    }

    private static String formatBytes(long bytes) {
        if (bytes < 1024)            return bytes + " B";
        if (bytes < 1024 * 1024)     return String.format("%.1f KiB", bytes / 1024.0);
        if (bytes < 1024L*1024*1024) return String.format("%.1f MiB", bytes / (1024.0 * 1024));
        return String.format("%.2f GiB", bytes / (1024.0 * 1024 * 1024));
    }

    private static void printCatalogResult(Object result) {
        if (result instanceof Map<?, ?> map) {
            map.forEach((k, v) -> System.out.printf("  %-28s %s%n", k + ":", v));
        } else {
            System.out.println(result);
        }
        System.out.println();
    }

    /**
     * Formats a single record as {@code field1=value1, field2=value2, ...}.
     * Uses positional field access to ensure ordering matches the schema.
     */
    private static String formatRecord(Record r) {
        StringBuilder sb = new StringBuilder();
        List<Types.NestedField> fields = r.struct().fields();
        for (int i = 0; i < fields.size(); i++) {
            if (i > 0) sb.append(", ");
            String name = fields.get(i).name();
            sb.append(name).append("=").append(r.getField(name));
        }
        return sb.toString();
    }

    private ResultPrinter() {}
}
