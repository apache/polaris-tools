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

import org.apache.iceberg.expressions.Expression;
import org.apache.iceberg.expressions.UnboundPredicate;
import org.junit.jupiter.api.Test;

/**
 * Focused unit tests for {@link IcebergExpressionVisitor} literal parsing and predicate building,
 * exercised through the full parse pipeline via {@link SqlToQueryPlan}.
 */
class IcebergExpressionVisitorTest {

    private final SqlToQueryPlan translator = new SqlToQueryPlan();

    /** Parse a WHERE predicate string and return the resulting Iceberg Expression. */
    private Expression parse(String predicate) {
        QueryPlan.Select plan = (QueryPlan.Select) translator.translate(
                "SELECT * FROM ns.t WHERE " + predicate);
        return plan.filter();
    }

    /** Cast the expression to UnboundPredicate for literal value access. */
    @SuppressWarnings("unchecked")
    private <T> UnboundPredicate<T> unbound(String predicate) {
        return (UnboundPredicate<T>) parse(predicate);
    }

    // ── String literal ────────────────────────────────────────────────────────

    @Test
    void stringLiteralStripsQuotes() {
        UnboundPredicate<String> pred = unbound("region = 'us-east-1'");
        assertThat(pred.literal().value()).isEqualTo("us-east-1");
    }

    @Test
    void escapedSingleQuoteInStringLiteral() {
        // SQL '' inside a string literal represents a single quote character
        UnboundPredicate<String> pred = unbound("name = 'it''s'");
        assertThat(pred.literal().value()).isEqualTo("it's");
    }

    // ── Numeric literals ──────────────────────────────────────────────────────

    @Test
    void intLiteralParsedAsLong() {
        UnboundPredicate<Long> pred = unbound("id > 42");
        assertThat(pred.literal().value()).isEqualTo(42L);
    }

    @Test
    void floatLiteralParsedAsDouble() {
        UnboundPredicate<Double> pred = unbound("score >= 3.14");
        assertThat(pred.literal().value()).isEqualTo(3.14);
    }

    // ── Boolean literals ──────────────────────────────────────────────────────

    @Test
    void trueLiteralParsedAsBoolean() {
        UnboundPredicate<Boolean> pred = unbound("active = true");
        assertThat(pred.literal().value()).isEqualTo(Boolean.TRUE);
    }

    @Test
    void falseLiteralParsedAsBoolean() {
        UnboundPredicate<Boolean> pred = unbound("active = false");
        assertThat(pred.literal().value()).isEqualTo(Boolean.FALSE);
    }

    // ── IN predicate ──────────────────────────────────────────────────────────

    @Test
    void inPredicateWithMultipleValues() {
        Expression e = parse("id IN (1, 2, 3)");
        assertThat(e.op()).isEqualTo(Expression.Operation.IN);
    }

    @Test
    void notInPredicateOperation() {
        Expression e = parse("id NOT IN (1, 2)");
        assertThat(e.op()).isEqualTo(Expression.Operation.NOT_IN);
    }

    // ── NULL checks ───────────────────────────────────────────────────────────

    @Test
    void isNullPredicateOperation() {
        Expression e = parse("region IS NULL");
        assertThat(e.op()).isEqualTo(Expression.Operation.IS_NULL);
    }

    @Test
    void isNotNullPredicateOperation() {
        Expression e = parse("region IS NOT NULL");
        assertThat(e.op()).isEqualTo(Expression.Operation.NOT_NULL);
    }
}
