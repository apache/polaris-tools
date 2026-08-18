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

import org.apache.iceberg.expressions.Expression;

import java.util.List;
import java.util.OptionalLong;

/**
 * Sealed interface representing the output of SQL-to-plan translation.
 * Each permitted record type corresponds to one supported statement:
 * SELECT queries, SHOW TABLES, DESCRIBE STATS, SHOW LOCATION, SHOW POLICIES, DIAGNOSE, and EXPLAIN.
 */
public sealed interface QueryPlan
        permits QueryPlan.Select,
                QueryPlan.ShowTables,
                QueryPlan.DescribeStats,
                QueryPlan.ShowLocation,
                QueryPlan.ShowPolicies,
                QueryPlan.Diagnose,
                QueryPlan.Explain {

    record OrderByItem(String column, boolean ascending) {}

    record Select(
            String namespacedTable,
            List<String> projectedColumns,
            Expression filter,
            List<OrderByItem> orderBy,
            OptionalLong limit
    ) implements QueryPlan {}

    record ShowTables(String namespace) implements QueryPlan {}

    record DescribeStats(String namespacedTable) implements QueryPlan {}

    record ShowLocation(String namespacedTable) implements QueryPlan {}

    record ShowPolicies(String namespacedTable) implements QueryPlan {}

    record Diagnose(String namespacedTable) implements QueryPlan {}

    record Explain(Select innerSelect) implements QueryPlan {}
}
