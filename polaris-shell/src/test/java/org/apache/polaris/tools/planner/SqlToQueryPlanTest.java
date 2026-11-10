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

import org.apache.iceberg.expressions.Expression;
import org.junit.jupiter.api.Test;

class SqlToQueryPlanTest {

    private final SqlToQueryPlan translator = new SqlToQueryPlan();

    @Test
    void selectStarProducesSelectPlan() {
        QueryPlan plan = translator.translate("SELECT * FROM prod.events");

        assertThat(plan).isInstanceOf(QueryPlan.Select.class);
        QueryPlan.Select select = (QueryPlan.Select) plan;
        assertThat(select.namespacedTable()).isEqualTo("prod.events");
        assertThat(select.projectedColumns()).isEmpty();
        assertThat(select.filter()).isNull();
        assertThat(select.orderBy()).isEmpty();
        assertThat(select.limit()).isEmpty();
    }

    @Test
    void selectWithColumnsFilterAndLimit() {
        QueryPlan plan = translator.translate(
                "SELECT region, sales FROM prod.events WHERE sales > 1000 LIMIT 50");

        assertThat(plan).isInstanceOf(QueryPlan.Select.class);
        QueryPlan.Select select = (QueryPlan.Select) plan;
        assertThat(select.namespacedTable()).isEqualTo("prod.events");
        assertThat(select.projectedColumns()).containsExactly("region", "sales");
        assertThat(select.filter()).isNotNull();
        assertThat(select.filter().op()).isEqualTo(Expression.Operation.GT);
        assertThat(select.orderBy()).isEmpty();
        assertThat(select.limit()).hasValue(50L);
    }

    @Test
    void showTablesProducesShowTablesPlan() {
        QueryPlan plan = translator.translate("SHOW TABLES IN prod.logs");

        assertThat(plan).isInstanceOf(QueryPlan.ShowTables.class);
        assertThat(((QueryPlan.ShowTables) plan).namespace()).isEqualTo("prod.logs");
    }

    @Test
    void describeStatsProducesDescribeStatsPlan() {
        QueryPlan plan = translator.translate("DESCRIBE STATS prod.events");

        assertThat(plan).isInstanceOf(QueryPlan.DescribeStats.class);
        assertThat(((QueryPlan.DescribeStats) plan).namespacedTable()).isEqualTo("prod.events");
    }

    @Test
    void showLocationProducesShowLocationPlan() {
        QueryPlan plan = translator.translate("SHOW TABLE LOCATION prod.events");

        assertThat(plan).isInstanceOf(QueryPlan.ShowLocation.class);
        assertThat(((QueryPlan.ShowLocation) plan).namespacedTable()).isEqualTo("prod.events");
    }

    @Test
    void showPoliciesProducesShowPoliciesPlan() {
        QueryPlan plan = translator.translate("SHOW TABLE POLICIES prod.events");

        assertThat(plan).isInstanceOf(QueryPlan.ShowPolicies.class);
        assertThat(((QueryPlan.ShowPolicies) plan).namespacedTable()).isEqualTo("prod.events");
    }

    @Test
    void diagnoseTableProducesDiagnosePlan() {
        QueryPlan plan = translator.translate("DIAGNOSE TABLE prod.events");

        assertThat(plan).isInstanceOf(QueryPlan.Diagnose.class);
        assertThat(((QueryPlan.Diagnose) plan).namespacedTable()).isEqualTo("prod.events");
    }

    @Test
    void deeplyNestedNamespace() {
        QueryPlan plan = translator.translate("SHOW TABLES IN catalog.schema.db");

        assertThat(plan).isInstanceOf(QueryPlan.ShowTables.class);
        assertThat(((QueryPlan.ShowTables) plan).namespace()).isEqualTo("catalog.schema.db");
    }

    @Test
    void invalidSqlThrowsIllegalArgumentException() {
        assertThatThrownBy(() -> translator.translate("NOT VALID SQL !!!"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void syntaxErrorThrowsIllegalArgumentException() {
        assertThatThrownBy(() -> translator.translate("SELECT FROM"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void emptyStringThrows() {
        assertThatThrownBy(() -> translator.translate(""))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void selectWithAndPredicate() {
        QueryPlan plan = translator.translate(
                "SELECT id FROM ns.tbl WHERE id > 0 AND id < 100");

        assertThat(plan).isInstanceOf(QueryPlan.Select.class);
        QueryPlan.Select select = (QueryPlan.Select) plan;
        assertThat(select.filter()).isNotNull();
        assertThat(select.filter().op()).isEqualTo(Expression.Operation.AND);
    }

    @Test
    void selectWithOrPredicate() {
        QueryPlan.Select select = (QueryPlan.Select) translator.translate(
                "SELECT id FROM ns.tbl WHERE id < 0 OR id > 100");
        assertThat(select.filter().op()).isEqualTo(Expression.Operation.OR);
    }

    @Test
    void selectWithNotPredicate() {
        QueryPlan.Select select = (QueryPlan.Select) translator.translate(
                "SELECT id FROM ns.tbl WHERE NOT id = 5");
        assertThat(select.filter().op()).isEqualTo(Expression.Operation.NOT);
    }

    @Test
    void selectWithInPredicate() {
        QueryPlan.Select select = (QueryPlan.Select) translator.translate(
                "SELECT id FROM ns.tbl WHERE region IN ('us-east-1', 'eu-west-1')");
        assertThat(select.filter().op()).isEqualTo(Expression.Operation.IN);
    }

    @Test
    void selectWithNotInPredicate() {
        QueryPlan.Select select = (QueryPlan.Select) translator.translate(
                "SELECT id FROM ns.tbl WHERE region NOT IN ('us-east-1')");
        assertThat(select.filter().op()).isEqualTo(Expression.Operation.NOT_IN);
    }

    @Test
    void selectWithIsNullPredicate() {
        QueryPlan.Select select = (QueryPlan.Select) translator.translate(
                "SELECT id FROM ns.tbl WHERE region IS NULL");
        assertThat(select.filter().op()).isEqualTo(Expression.Operation.IS_NULL);
    }

    @Test
    void selectWithIsNotNullPredicate() {
        QueryPlan.Select select = (QueryPlan.Select) translator.translate(
                "SELECT id FROM ns.tbl WHERE region IS NOT NULL");
        assertThat(select.filter().op()).isEqualTo(Expression.Operation.NOT_NULL);
    }

    @Test
    void selectWithAllComparisonOperators() {
        assertThat(filterOp("SELECT id FROM ns.t WHERE id < 10")).isEqualTo(Expression.Operation.LT);
        assertThat(filterOp("SELECT id FROM ns.t WHERE id <= 10")).isEqualTo(Expression.Operation.LT_EQ);
        assertThat(filterOp("SELECT id FROM ns.t WHERE id >= 10")).isEqualTo(Expression.Operation.GT_EQ);
        assertThat(filterOp("SELECT id FROM ns.t WHERE id != 10")).isEqualTo(Expression.Operation.NOT_EQ);
        assertThat(filterOp("SELECT id FROM ns.t WHERE id = 10")).isEqualTo(Expression.Operation.EQ);
    }

    @Test
    void selectWithNestedParentheses() {
        QueryPlan.Select select = (QueryPlan.Select) translator.translate(
                "SELECT id FROM ns.tbl WHERE (id > 0 AND id < 10) OR id = 99");
        assertThat(select.filter()).isNotNull();
        assertThat(select.filter().op()).isEqualTo(Expression.Operation.OR);
    }

    @Test
    void selectWithStringLiteralFilter() {
        QueryPlan.Select select = (QueryPlan.Select) translator.translate(
                "SELECT id FROM ns.tbl WHERE region = 'us-east-1'");
        assertThat(select.filter().op()).isEqualTo(Expression.Operation.EQ);
    }

    @Test
    void selectWithFloatLiteralFilter() {
        QueryPlan.Select select = (QueryPlan.Select) translator.translate(
                "SELECT id FROM ns.tbl WHERE score >= 0.5");
        assertThat(select.filter().op()).isEqualTo(Expression.Operation.GT_EQ);
    }

    @Test
    void selectWithBooleanLiteralFilter() {
        QueryPlan.Select select = (QueryPlan.Select) translator.translate(
                "SELECT id FROM ns.tbl WHERE active = true");
        assertThat(select.filter().op()).isEqualTo(Expression.Operation.EQ);
    }

    // ── LIMIT edge cases ──────────────────────────────────────────────────────

    @Test
    void limitZeroIsValid() {
        QueryPlan.Select select = (QueryPlan.Select) translator.translate(
                "SELECT * FROM ns.t LIMIT 0");
        assertThat(select.limit()).hasValue(0L);
    }

    @Test
    void selectWithLimitButNoFilter() {
        QueryPlan.Select select = (QueryPlan.Select) translator.translate(
                "SELECT id FROM ns.t LIMIT 5");
        assertThat(select.filter()).isNull();
        assertThat(select.limit()).hasValue(5L);
    }

    // ── EXPLAIN ──────────────────────────────────────────────────────────────

    @Test
    void explainSelectProducesExplainPlan() {
        QueryPlan plan = translator.translate("EXPLAIN SELECT * FROM ns.t");

        assertThat(plan).isInstanceOf(QueryPlan.Explain.class);
        QueryPlan.Explain explain = (QueryPlan.Explain) plan;
        assertThat(explain.innerSelect().namespacedTable()).isEqualTo("ns.t");
    }

    // ── ORDER BY ─────────────────────────────────────────────────────────────

    @Test
    void selectWithOrderByAsc() {
        QueryPlan.Select select = (QueryPlan.Select) translator.translate(
                "SELECT * FROM ns.t ORDER BY col");

        assertThat(select.orderBy()).hasSize(1);
        assertThat(select.orderBy().get(0).column()).isEqualTo("col");
        assertThat(select.orderBy().get(0).ascending()).isTrue();
    }

    @Test
    void selectWithOrderByDesc() {
        QueryPlan.Select select = (QueryPlan.Select) translator.translate(
                "SELECT * FROM ns.t ORDER BY col DESC");

        assertThat(select.orderBy()).hasSize(1);
        assertThat(select.orderBy().get(0).column()).isEqualTo("col");
        assertThat(select.orderBy().get(0).ascending()).isFalse();
    }

    @Test
    void selectWithMultiColumnOrderBy() {
        QueryPlan.Select select = (QueryPlan.Select) translator.translate(
                "SELECT * FROM ns.t ORDER BY a ASC, b DESC");

        assertThat(select.orderBy()).hasSize(2);
        assertThat(select.orderBy().get(0).column()).isEqualTo("a");
        assertThat(select.orderBy().get(0).ascending()).isTrue();
        assertThat(select.orderBy().get(1).column()).isEqualTo("b");
        assertThat(select.orderBy().get(1).ascending()).isFalse();
    }

    // ── Backtick identifiers ──────────────────────────────────────────────────

    @Test
    void backtickTableRef() {
        QueryPlan plan = translator.translate("SELECT * FROM `my-ns`.`my-table`");

        assertThat(plan).isInstanceOf(QueryPlan.Select.class);
        QueryPlan.Select select = (QueryPlan.Select) plan;
        assertThat(select.namespacedTable()).isEqualTo("my-ns.my-table");
    }

    @Test
    void backtickColumnInWhere() {
        QueryPlan.Select select = (QueryPlan.Select) translator.translate(
                "SELECT * FROM ns.tbl WHERE `event-type` = 'click'");

        assertThat(select.filter()).isNotNull();
        assertThat(select.filter().op()).isEqualTo(Expression.Operation.EQ);
    }

    // ── Helper ───────────────────────────────────────────────────────────────

    private Expression.Operation filterOp(String sql) {
        return ((QueryPlan.Select) translator.translate(sql)).filter().op();
    }
}
