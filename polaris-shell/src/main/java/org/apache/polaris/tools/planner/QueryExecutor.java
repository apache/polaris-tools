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

import org.apache.iceberg.FileScanTask;
import org.apache.iceberg.Snapshot;
import org.apache.iceberg.Table;
import org.apache.iceberg.TableScan;
import org.apache.iceberg.catalog.Catalog;
import org.apache.iceberg.catalog.Namespace;
import org.apache.iceberg.catalog.TableIdentifier;
import org.apache.iceberg.io.CloseableIterable;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.StreamSupport;

/**
 * Executes a {@link QueryPlan} against an Iceberg {@link Catalog}.
 * Dispatches each plan type to the appropriate Iceberg API calls and returns
 * the result as a plain Java object (typically a {@code Map}).
 */
public class QueryExecutor {

    private final Catalog catalog;

    public QueryExecutor(Catalog catalog) {
        this.catalog = catalog;
    }

    public Object execute(QueryPlan plan) {
        return switch (plan) {
            case QueryPlan.Select s         -> executeSelect(s);
            case QueryPlan.ShowTables st    -> showTables(st);
            case QueryPlan.DescribeStats d  -> describeStats(d);
            case QueryPlan.ShowLocation sl  -> showLocation(sl);
            case QueryPlan.ShowPolicies sp  -> showPolicies(sp);
            case QueryPlan.Diagnose diag    -> diagnose(diag);
            case QueryPlan.Explain ex       -> explainSelect(ex.innerSelect());
        };
    }

    // Use-case 1: count + list tables under a namespace
    private Object showTables(QueryPlan.ShowTables plan) {
        Namespace ns = Namespace.of(plan.namespace().split("\\."));
        List<TableIdentifier> tables = catalog.listTables(ns);
        return Map.of(
                "namespace", plan.namespace(),
                "tableCount", tables.size(),
                "tables", tables
        );
    }

    // Use-case 2: snapshot count, current snapshot id, partition spec, schema
    private Object describeStats(QueryPlan.DescribeStats plan) {
        Table table = loadTable(plan.namespacedTable());
        var currentSnapshot = table.currentSnapshot();
        long snapshotCount = StreamSupport.stream(table.snapshots().spliterator(), false).count();
        return Map.of(
                "snapshotCount", snapshotCount,
                "currentSnapshotId", currentSnapshot != null ? currentSnapshot.snapshotId() : -1L,
                "partitionSpec", table.spec().toString(),
                "schema", table.schema().toString()
        );
    }

    // Use-case 3: storage location
    private Object showLocation(QueryPlan.ShowLocation plan) {
        Table table = loadTable(plan.namespacedTable());
        return Map.of("location", table.location());
    }

    // Use-case 4: effective policies via table properties (polaris.policy.* prefix only)
    private static final String POLICY_PREFIX = "polaris.policy.";

    private Object showPolicies(QueryPlan.ShowPolicies plan) {
        Table table = loadTable(plan.namespacedTable());
        Map<String, String> policies = new HashMap<>();
        table.properties().forEach((k, v) -> {
            if (k.startsWith(POLICY_PREFIX)) {
                policies.put(k, v);
            }
        });
        return policies;
    }

    /**
     * Files smaller than this threshold (128 MiB) are considered "small" by the diagnostics scan.
     * This matches the default Iceberg target file size.
     */
    private static final long SMALL_FILE_THRESHOLD_BYTES = 128 * 1024 * 1024L;

    // Use-case 5: small-file diagnostics via manifest scanning
    private Object diagnose(QueryPlan.Diagnose plan) {
        Table table = loadTable(plan.namespacedTable());
        long smallFileCount = 0;
        if (table.currentSnapshot() != null) {
            try (var tasks = table.newScan().planFiles()) {
                for (var fileScanTask : tasks) {
                    if (fileScanTask.file().fileSizeInBytes() < SMALL_FILE_THRESHOLD_BYTES) {
                        smallFileCount++;
                    }
                }
            } catch (java.io.IOException e) {
                throw new RuntimeException("Failed to close file scan tasks during diagnose", e);
            }
        }
        return Map.of(
                "smallFileThresholdBytes", SMALL_FILE_THRESHOLD_BYTES,
                "smallFileCount", smallFileCount
        );
    }

    // Use-case 6: EXPLAIN — scan plan introspection
    private Object explainSelect(QueryPlan.Select plan) {
        Table table = loadTable(plan.namespacedTable());
        Snapshot currentSnapshot = table.currentSnapshot();

        long totalManifestFiles = 0;
        long totalDataFiles = 0;
        long dataFilesAfterFilter = 0;
        long manifestsAfterPruning = 0;
        long estimatedBytes = 0;
        long smallFileCount = 0;
        long noStatsCount = 0;
        List<String> warnings = new ArrayList<>();

        if (currentSnapshot != null) {
            totalManifestFiles = currentSnapshot.dataManifests(table.io()).size();

            // Count total data files (unfiltered)
            try (CloseableIterable<FileScanTask> allTasks = table.newScan().planFiles()) {
                for (FileScanTask ignored : allTasks) totalDataFiles++;
            } catch (IOException e) {
                throw new RuntimeException("Failed to count total files during EXPLAIN", e);
            }

            // Apply user filter — Iceberg performs partition pruning here
            TableScan scan = table.newScan();
            if (plan.filter() != null) scan = scan.filter(plan.filter());
            if (!plan.projectedColumns().isEmpty()) scan = scan.select(plan.projectedColumns());

            try (CloseableIterable<FileScanTask> tasks = scan.planFiles()) {
                for (FileScanTask task : tasks) {
                    dataFilesAfterFilter++;
                    estimatedBytes += task.file().fileSizeInBytes();
                    if (task.file().fileSizeInBytes() < SMALL_FILE_THRESHOLD_BYTES) smallFileCount++;
                    if (task.file().valueCounts() == null || task.file().valueCounts().isEmpty()) noStatsCount++;
                }
            } catch (IOException e) {
                throw new RuntimeException("Failed to plan files during EXPLAIN", e);
            }

            // Approximate manifests after pruning by the same ratio as files
            manifestsAfterPruning = totalDataFiles > 0
                ? Math.max(1, (long) Math.ceil(totalManifestFiles * (double) dataFilesAfterFilter / totalDataFiles))
                : 0;

            if (smallFileCount > 0)
                warnings.add(smallFileCount + " of " + dataFilesAfterFilter + " files are below 128 MiB — consider compaction");
            if (noStatsCount > 0)
                warnings.add(noStatsCount + " data files have no column statistics");
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("table",                plan.namespacedTable());
        result.put("snapshotId",           currentSnapshot != null ? currentSnapshot.snapshotId() : -1L);
        result.put("snapshotTimestampMs",  currentSnapshot != null ? currentSnapshot.timestampMillis() : -1L);
        result.put("partitionSpec",        table.spec().toString());
        result.put("schemaColumnCount",    table.schema().columns().size());
        result.put("projectedColumnCount", plan.projectedColumns().isEmpty()
                                           ? table.schema().columns().size()
                                           : plan.projectedColumns().size());
        result.put("totalManifestFiles",   totalManifestFiles);
        result.put("manifestsAfterPruning", manifestsAfterPruning);
        result.put("totalDataFiles",       totalDataFiles);
        result.put("dataFilesAfterFilter", dataFilesAfterFilter);
        result.put("estimatedBytes",       estimatedBytes);
        result.put("pushdownFilter",       plan.filter() != null ? plan.filter().toString() : "none");
        result.put("warnings",             warnings);
        return result;
    }

    /**
     * Not supported: {@link QueryExecutor} handles metadata operations only.
     * Use {@link IcebergRestQueryExecutor} to execute SELECT plans.
     *
     * @throws IllegalArgumentException always
     */
    private Object executeSelect(QueryPlan.Select plan) {
        throw new IllegalArgumentException(
                "QueryExecutor does not support SELECT plans; use IcebergRestQueryExecutor");
    }

    private Table loadTable(String namespacedTable) {
        String[] parts = namespacedTable.split("\\.");
        if (parts.length < 2) {
            throw new IllegalArgumentException(
                    "Table name must be namespace-qualified (e.g. 'ns.table'), got: " + namespacedTable);
        }
        Namespace ns = Namespace.of(Arrays.copyOf(parts, parts.length - 1));
        return catalog.loadTable(TableIdentifier.of(ns, parts[parts.length - 1]));
    }
}
