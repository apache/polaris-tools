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

import org.antlr.v4.runtime.BaseErrorListener;
import org.antlr.v4.runtime.CharStreams;
import org.antlr.v4.runtime.CommonTokenStream;
import org.antlr.v4.runtime.RecognitionException;
import org.antlr.v4.runtime.Recognizer;
import org.apache.iceberg.expressions.Expression;
import org.apache.polaris.tools.grammar.IcebergSQLLexer;
import org.apache.polaris.tools.grammar.IcebergSQLParser;

import java.util.ArrayList;
import java.util.List;
import java.util.OptionalLong;
import java.util.stream.Collectors;

/**
 * Translates a SQL string into a {@link QueryPlan} by parsing it with the IcebergSQL ANTLR grammar
 * and dispatching each statement type to the corresponding plan record.
 */
public class SqlToQueryPlan {

    private static final BaseErrorListener THROWING_ERROR_LISTENER = new BaseErrorListener() {
        @Override
        public void syntaxError(Recognizer<?, ?> recognizer, Object offendingSymbol,
                int line, int charPositionInLine, String msg, RecognitionException e) {
            throw new IllegalArgumentException(
                    "SQL syntax error at line " + line + ":" + charPositionInLine + " – " + msg);
        }
    };

    public QueryPlan translate(String sql) {
        var lexer = new IcebergSQLLexer(CharStreams.fromString(sql));
        lexer.removeErrorListeners();
        lexer.addErrorListener(THROWING_ERROR_LISTENER);
        var tokens = new CommonTokenStream(lexer);
        var parser = new IcebergSQLParser(tokens);
        parser.removeErrorListeners();
        parser.addErrorListener(THROWING_ERROR_LISTENER);

        IcebergSQLParser.QueryContext queryCtx = parser.query();

        return switch (queryCtx) {
            case IcebergSQLParser.SelectStmtContext ctx ->
                    translateSelect(ctx.selectQuery());
            case IcebergSQLParser.ShowTablesStmtContext ctx ->
                    new QueryPlan.ShowTables(
                        identifiersToString(ctx.showTablesQuery().namespaceRef().identifier()));
            case IcebergSQLParser.DescribeStatsStmtContext ctx ->
                    new QueryPlan.DescribeStats(
                        identifiersToString(ctx.describeStatsQuery().tableRef().identifier()));
            case IcebergSQLParser.ShowLocationStmtContext ctx ->
                    new QueryPlan.ShowLocation(
                        identifiersToString(ctx.showLocationQuery().tableRef().identifier()));
            case IcebergSQLParser.ShowPoliciesStmtContext ctx ->
                    new QueryPlan.ShowPolicies(
                        identifiersToString(ctx.showPoliciesQuery().tableRef().identifier()));
            case IcebergSQLParser.DiagnoseStmtContext ctx ->
                    new QueryPlan.Diagnose(
                        identifiersToString(ctx.diagnoseQuery().tableRef().identifier()));
            case IcebergSQLParser.ExplainStmtContext ctx ->
                    new QueryPlan.Explain(translateSelect(ctx.explainQuery().selectQuery()));
            default -> throw new IllegalArgumentException("Unrecognized statement: " + sql);
        };
    }

    private QueryPlan.Select translateSelect(IcebergSQLParser.SelectQueryContext ctx) {
        String table = identifiersToString(ctx.tableRef().identifier());

        List<String> columns = new ArrayList<>();
        if (ctx.columnList() instanceof IcebergSQLParser.NamedColumnsContext columnListCtx) {
            columns = columnListCtx.column().stream()
                    .map(col -> (IcebergSQLParser.SimpleColumnContext) col)
                    .map(col -> identifiersToString(col.identifier()))
                    .collect(Collectors.toCollection(ArrayList::new));
        }

        Expression filter = null;
        if (ctx.predicate() != null) {
            filter = new IcebergExpressionVisitor().visit(ctx.predicate());
        }

        List<QueryPlan.OrderByItem> orderBy = new ArrayList<>();
        if (ctx.orderByList() != null) {
            for (var item : ctx.orderByList().orderByItem()) {
                boolean asc = item.DESC() == null;
                orderBy.add(new QueryPlan.OrderByItem(
                    SqlUtil.unquote(item.identifier().getText()), asc));
            }
        }

        OptionalLong limit = OptionalLong.empty();
        if (ctx.INTEGER_LITERAL() != null) {
            limit = OptionalLong.of(Long.parseLong(ctx.INTEGER_LITERAL().getText()));
        }

        return new QueryPlan.Select(table, columns, filter, orderBy, limit);
    }

    private static String identifiersToString(List<IcebergSQLParser.IdentifierContext> identifiers) {
        return identifiers.stream()
                .map(id -> SqlUtil.unquote(id.getText()))
                .collect(Collectors.joining("."));
    }
}
