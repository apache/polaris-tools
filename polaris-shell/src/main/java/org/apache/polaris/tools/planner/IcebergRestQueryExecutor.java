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

import org.apache.iceberg.Schema;
import org.apache.iceberg.Table;
import org.apache.iceberg.catalog.Namespace;
import org.apache.iceberg.catalog.TableIdentifier;
import org.apache.iceberg.data.IcebergGenerics;
import org.apache.iceberg.data.Record;
import org.apache.iceberg.io.CloseableIterable;
import org.apache.iceberg.io.CloseableIterator;
import org.apache.iceberg.rest.RESTCatalog;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Executes SELECT {@link QueryPlan.Select} plans against an Iceberg REST catalog (e.g. Polaris).
 * Connects via the Iceberg {@link RESTCatalog}, applies column projection and predicate pushdown,
 * and returns rows as a {@link CloseableIterable} of {@link Record}.
 * Callers must close the returned iterable and this executor when done.
 */
public class IcebergRestQueryExecutor implements AutoCloseable {

    private final RESTCatalog catalog;

    /**
     * @param uri       Polaris REST catalog URI, e.g. {@code http://localhost:8181/api/catalog}
     * @param warehouse Polaris warehouse / catalog name
     * @param token     OAuth2 bearer token; use {@code credential} property instead for
     *                  automatic client-credentials exchange
     */
    public IcebergRestQueryExecutor(String uri, String warehouse, String token) {
        this(uri, warehouse, token, Map.of());
    }

    /**
     * Constructor that accepts additional catalog properties, for example FileIO configuration
     * needed to reach S3-compatible storage (MinIO, S3Mock, etc.) in integration tests.
     *
     * @param uri             Polaris REST catalog URI
     * @param warehouse       Polaris warehouse / catalog name
     * @param token           OAuth2 bearer token
     * @param extraProperties additional properties merged into the catalog configuration
     */
    public IcebergRestQueryExecutor(
            String uri, String warehouse, String token, Map<String, String> extraProperties) {
        Map<String, String> properties = new HashMap<>(extraProperties);
        properties.put("uri", uri);
        properties.put("warehouse", warehouse);
        properties.put("token", token);
        this.catalog = new RESTCatalog();
        this.catalog.initialize("polaris", properties);
    }

    /**
     * Executes the SELECT plan and returns all matching records.
     * Column projection and predicate pushdown are applied at the scan level.
     * The caller is responsible for closing the returned iterable.
     */
    public CloseableIterable<Record> execute(QueryPlan.Select plan) {
        Table table = loadTable(plan.namespacedTable());
        IcebergGenerics.ScanBuilder scanBuilder = IcebergGenerics.read(table);

        if (!plan.projectedColumns().isEmpty()) {
            Schema projected = table.schema().select(plan.projectedColumns());
            scanBuilder = scanBuilder.project(projected);
        }

        if (plan.filter() != null) {
            scanBuilder = scanBuilder.where(plan.filter());
        }

        return scanBuilder.build();
    }

    /**
     * Executes the SELECT plan and returns at most {@code limit} records.
     * If the plan has no LIMIT clause, all matching records are returned.
     * The caller is responsible for closing the returned iterable.
     */
    public CloseableIterable<Record> executeWithLimit(QueryPlan.Select plan) {
        CloseableIterable<Record> all = execute(plan);
        try {
            if (plan.limit().isEmpty()) {
                return all;
            }
            long limit = plan.limit().getAsLong();
            return new CloseableIterable<>() {
            @Override
            public CloseableIterator<Record> iterator() {
                CloseableIterator<Record> delegate = all.iterator();
                return new CloseableIterator<>() {
                    private long count = 0;

                    @Override
                    public boolean hasNext() {
                        return count < limit && delegate.hasNext();
                    }

                    @Override
                    public Record next() {
                        count++;
                        return delegate.next();
                    }

                    @Override
                    public void close() throws IOException {
                        delegate.close();
                    }
                };
            }

            @Override
            public void close() throws IOException {
                all.close();
            }
        };
        } catch (Exception e) {
            try {
                all.close();
            } catch (IOException closeEx) {
                e.addSuppressed(closeEx);
            }
            throw e;
        }
    }

    /**
     * Executes the SELECT plan, applies ORDER BY sorting in-memory, and returns at most
     * {@code limit} records. If the plan has no ORDER BY clause, rows are returned in
     * scan order. If the plan has no LIMIT clause, all matching records are returned.
     */
    public List<Record> executeOrdered(QueryPlan.Select plan) throws IOException {
        List<Record> rows = new ArrayList<>();
        try (CloseableIterable<Record> all = execute(plan)) {
            for (Record r : all) rows.add(r);
        }
        if (!plan.orderBy().isEmpty()) {
            rows.sort(buildComparator(plan.orderBy()));
        }
        if (plan.limit().isPresent()) {
            return rows.subList(0, (int) Math.min(rows.size(), plan.limit().getAsLong()));
        }
        return rows;
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private Comparator<Record> buildComparator(List<QueryPlan.OrderByItem> orderBy) {
        Comparator<Record> comp = null;
        for (QueryPlan.OrderByItem item : orderBy) {
            Comparator<Record> c = Comparator.comparing(
                r -> (Comparable) r.getField(item.column()),
                Comparator.nullsLast(Comparator.naturalOrder()));
            if (!item.ascending()) c = c.reversed();
            comp = comp == null ? c : comp.thenComparing(c);
        }
        return comp;
    }

    /** Exposes the underlying catalog for inspection or metadata operations. */
    public RESTCatalog getCatalog() {
        return catalog;
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

    @Override
    public void close() throws Exception {
        catalog.close();
    }
}
