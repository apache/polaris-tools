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
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.OptionalLong;
import org.apache.iceberg.DataFile;
import org.apache.iceberg.FileScanTask;
import org.apache.iceberg.ManifestFile;
import org.apache.iceberg.PartitionSpec;
import org.apache.iceberg.Schema;
import org.apache.iceberg.Snapshot;
import org.apache.iceberg.Table;
import org.apache.iceberg.TableScan;
import org.apache.iceberg.catalog.Catalog;
import org.apache.iceberg.catalog.Namespace;
import org.apache.iceberg.catalog.TableIdentifier;
import org.apache.iceberg.io.CloseableIterable;
import org.apache.iceberg.io.FileIO;
import org.apache.iceberg.types.Types;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class QueryExecutorTest {

    @Mock Catalog catalog;
    @Mock Table table;
    @Mock Snapshot snapshot;
    @Mock TableScan tableScan;

    QueryExecutor executor;

    static final Namespace NS = Namespace.of("prod");
    static final TableIdentifier TABLE_ID = TableIdentifier.of(NS, "events");
    static final String NAMESPACED_TABLE = "prod.events";

    @BeforeEach
    void setUp() {
        executor = new QueryExecutor(catalog);
        lenient().when(catalog.loadTable(TABLE_ID)).thenReturn(table);
    }

    @Test
    void selectPlanThrowsIllegalArgumentException() {
        QueryPlan.Select selectPlan = new QueryPlan.Select(
                NAMESPACED_TABLE, List.of(), null, List.of(), OptionalLong.empty());
        assertThatThrownBy(() -> executor.execute(selectPlan))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("SELECT");
    }

    @Test
    void showTablesReturnsNamespaceAndCount() {
        List<TableIdentifier> tables = List.of(TABLE_ID, TableIdentifier.of(NS, "logs"));
        when(catalog.listTables(NS)).thenReturn(tables);

        Object result = executor.execute(new QueryPlan.ShowTables("prod"));

        assertThat(result).isInstanceOf(Map.class);
        @SuppressWarnings("unchecked")
        Map<String, Object> map = (Map<String, Object>) result;
        assertThat(map).containsEntry("namespace", "prod");
        assertThat(map).containsEntry("tableCount", 2);
        assertThat(map.get("tables")).isEqualTo(tables);
    }

    @Test
    void describeStatsReturnsSnapshotInfo() {
        Schema schema = new Schema(
                Types.NestedField.required(1, "id", Types.IntegerType.get()));
        when(table.currentSnapshot()).thenReturn(snapshot);
        when(table.snapshots()).thenReturn(List.of(snapshot, snapshot));
        when(table.spec()).thenReturn(PartitionSpec.unpartitioned());
        when(table.schema()).thenReturn(schema);
        when(snapshot.snapshotId()).thenReturn(42L);

        Object result = executor.execute(new QueryPlan.DescribeStats(NAMESPACED_TABLE));

        assertThat(result).isInstanceOf(Map.class);
        @SuppressWarnings("unchecked")
        Map<String, Object> map = (Map<String, Object>) result;
        assertThat(map).containsEntry("snapshotCount", 2L);
        assertThat(map).containsEntry("currentSnapshotId", 42L);
    }

    @Test
    void describeStatsHandlesNoSnapshot() {
        when(table.currentSnapshot()).thenReturn(null);
        when(table.snapshots()).thenReturn(Collections.emptyList());
        when(table.spec()).thenReturn(PartitionSpec.unpartitioned());
        when(table.schema()).thenReturn(new Schema());

        Object result = executor.execute(new QueryPlan.DescribeStats(NAMESPACED_TABLE));

        @SuppressWarnings("unchecked")
        Map<String, Object> map = (Map<String, Object>) result;
        assertThat(map).containsEntry("snapshotCount", 0L);
        assertThat(map).containsEntry("currentSnapshotId", -1L);
    }

    @Test
    void showLocationReturnsTableLocation() {
        when(table.location()).thenReturn("s3://my-bucket/warehouse/prod/events");

        Object result = executor.execute(new QueryPlan.ShowLocation(NAMESPACED_TABLE));

        @SuppressWarnings("unchecked")
        Map<String, Object> map = (Map<String, Object>) result;
        assertThat(map).containsEntry("location", "s3://my-bucket/warehouse/prod/events");
    }

    @Test
    void showPoliciesReturnsPolicyPropertiesOnly() {
        Map<String, String> props = Map.of(
                "write.format.default", "parquet",
                "polaris.policy.retention", "30d");
        when(table.properties()).thenReturn(props);

        Object result = executor.execute(new QueryPlan.ShowPolicies(NAMESPACED_TABLE));

        @SuppressWarnings("unchecked")
        Map<String, String> policies = (Map<String, String>) result;
        assertThat(policies).containsOnlyKeys("polaris.policy.retention");
        assertThat(policies).doesNotContainKey("write.format.default");
    }

    @Test
    void diagnoseReturnsSmallFileCount() {
        DataFile smallFile = mock(DataFile.class);
        DataFile largeFile = mock(DataFile.class);
        FileScanTask smallTask = mock(FileScanTask.class);
        FileScanTask largeTask = mock(FileScanTask.class);

        long threshold = 128 * 1024 * 1024L;
        when(table.currentSnapshot()).thenReturn(snapshot);
        when(table.newScan()).thenReturn(tableScan);
        when(tableScan.planFiles()).thenReturn(CloseableIterable.withNoopClose(
                List.of(smallTask, largeTask)));
        when(smallTask.file()).thenReturn(smallFile);
        when(largeTask.file()).thenReturn(largeFile);
        when(smallFile.fileSizeInBytes()).thenReturn(1024L);
        when(largeFile.fileSizeInBytes()).thenReturn(threshold + 1);

        Object result = executor.execute(new QueryPlan.Diagnose(NAMESPACED_TABLE));

        @SuppressWarnings("unchecked")
        Map<String, Object> map = (Map<String, Object>) result;
        assertThat(map).containsEntry("smallFileThresholdBytes", threshold);
        assertThat(map).containsEntry("smallFileCount", 1L);
    }

    @Test
    void diagnoseWithNoSnapshotReturnsZeroCount() {
        when(table.currentSnapshot()).thenReturn(null);

        Object result = executor.execute(new QueryPlan.Diagnose(NAMESPACED_TABLE));

        @SuppressWarnings("unchecked")
        Map<String, Object> map = (Map<String, Object>) result;
        assertThat(map).containsEntry("smallFileCount", 0L);
    }

    @Test
    void explainReturnsDataFileStatsWithWarnings() {
        long threshold = 128 * 1024 * 1024L;
        long smallFileSize = 1024L;
        long largeFileSize = threshold + 1;

        DataFile smallFile = mock(DataFile.class);
        DataFile largeFile = mock(DataFile.class);
        FileScanTask smallTask = mock(FileScanTask.class);
        FileScanTask largeTask = mock(FileScanTask.class);
        ManifestFile manifest1 = mock(ManifestFile.class);
        ManifestFile manifest2 = mock(ManifestFile.class);
        FileIO fileIO = mock(FileIO.class);
        Schema schema = new Schema(
                Types.NestedField.required(1, "id", Types.IntegerType.get()));

        when(table.currentSnapshot()).thenReturn(snapshot);
        when(snapshot.snapshotId()).thenReturn(99L);
        when(snapshot.timestampMillis()).thenReturn(1000L);
        when(snapshot.dataManifests(fileIO)).thenReturn(List.of(manifest1, manifest2));
        when(table.io()).thenReturn(fileIO);
        when(table.newScan()).thenReturn(tableScan);
        when(tableScan.planFiles()).thenReturn(CloseableIterable.withNoopClose(
                List.of(smallTask, largeTask)));
        when(smallTask.file()).thenReturn(smallFile);
        when(largeTask.file()).thenReturn(largeFile);
        when(smallFile.fileSizeInBytes()).thenReturn(smallFileSize);
        when(largeFile.fileSizeInBytes()).thenReturn(largeFileSize);
        when(smallFile.valueCounts()).thenReturn(Map.of(1, 10L));
        when(largeFile.valueCounts()).thenReturn(Map.of(1, 100L));
        when(table.spec()).thenReturn(PartitionSpec.unpartitioned());
        when(table.schema()).thenReturn(schema);

        QueryPlan.Select select = new QueryPlan.Select(
                NAMESPACED_TABLE, List.of(), null, List.of(), OptionalLong.empty());
        QueryPlan plan = new QueryPlan.Explain(select);

        Object result = executor.execute(plan);

        assertThat(result).isInstanceOf(Map.class);
        @SuppressWarnings("unchecked")
        Map<String, Object> map = (Map<String, Object>) result;
        assertThat(map).containsEntry("dataFilesAfterFilter", 2L);
        assertThat(map).containsEntry("totalDataFiles", 2L);
        assertThat(map).containsEntry("snapshotId", 99L);
        @SuppressWarnings("unchecked")
        List<String> warnings = (List<String>) map.get("warnings");
        assertThat(warnings).isNotEmpty();
        assertThat(warnings.get(0)).contains("128 MiB");
    }
}
