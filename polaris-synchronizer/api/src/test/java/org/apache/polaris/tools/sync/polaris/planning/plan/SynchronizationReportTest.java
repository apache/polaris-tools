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
package org.apache.polaris.tools.sync.polaris.planning.plan;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

public class SynchronizationReportTest {

  @Test
  public void recordSuccessIncrementsOnlyTargetedCell() {
    SynchronizationReport report = new SynchronizationReport();

    report.recordSuccess(EntityType.PRINCIPAL, SyncOutcome.CREATED);

    String rendered = report.render();

    Assertions.assertTrue(rendered.contains("Principal:"));
    Assertions.assertTrue(rendered.contains("1 created, 0 overwritten, 0 removed, 0 skipped, 0 failed"));
    Assertions.assertFalse(rendered.contains("Catalog:"));
  }

  @Test
  public void recordFailureIncrementsFailedCountAndCapturesIdentifierAndMessage() {
    SynchronizationReport report = new SynchronizationReport();

    report.recordFailure(EntityType.TABLE, "db.orders", new RuntimeException("connection refused"));

    String rendered = report.render();

    Assertions.assertTrue(rendered.contains("Table:"));
    Assertions.assertTrue(rendered.contains("0 created, 0 overwritten, 0 removed, 0 skipped, 1 failed"));
    Assertions.assertTrue(rendered.contains("Table 'db.orders': connection refused"));
  }

  @Test
  public void hasFailuresIsFalseForAnAllSuccessReport() {
    SynchronizationReport report = new SynchronizationReport();

    report.recordSuccess(EntityType.CATALOG, SyncOutcome.CREATED);
    report.recordSuccess(EntityType.NAMESPACE, SyncOutcome.REMOVED);

    Assertions.assertFalse(report.hasFailures());
  }

  @Test
  public void hasFailuresIsTrueOnceAnyFailureIsRecorded() {
    SynchronizationReport report = new SynchronizationReport();

    report.recordSuccess(EntityType.CATALOG, SyncOutcome.CREATED);
    report.recordFailure(EntityType.GRANT, "TABLE", new RuntimeException("boom"));

    Assertions.assertTrue(report.hasFailures());
  }

  @Test
  public void renderOmitsAllZeroEntityTypesAndFailuresSectionWhenEmpty() {
    SynchronizationReport report = new SynchronizationReport();

    report.recordSuccess(EntityType.PRINCIPAL_ROLE, SyncOutcome.CREATED);

    String rendered = report.render();

    Assertions.assertTrue(rendered.contains("PrincipalRole:"));
    Assertions.assertFalse(rendered.contains("Grant:"));
    Assertions.assertFalse(rendered.contains("Namespace:"));
    Assertions.assertFalse(rendered.contains("Failures:"));
  }

  @Test
  public void renderIncludesEachFailureWhenMultipleFailuresExist() {
    SynchronizationReport report = new SynchronizationReport();

    report.recordFailure(EntityType.PRINCIPAL, "alice", new RuntimeException("timeout"));
    report.recordFailure(EntityType.TABLE, "db.returns", new RuntimeException("not found"));

    String rendered = report.render();

    Assertions.assertTrue(rendered.contains("Failures:"));
    Assertions.assertTrue(rendered.contains("Principal 'alice': timeout"));
    Assertions.assertTrue(rendered.contains("Table 'db.returns': not found"));
  }

  @Test
  public void recordSuccessWithSkippedIncrementsSkippedCountAndDoesNotCountAsFailure() {
    SynchronizationReport report = new SynchronizationReport();

    report.recordSuccess(EntityType.NAMESPACE, SyncOutcome.SKIPPED);

    String rendered = report.render();

    Assertions.assertTrue(rendered.contains("Namespace:"));
    Assertions.assertTrue(rendered.contains("0 created, 0 overwritten, 0 removed, 1 skipped, 0 failed"));
    Assertions.assertFalse(report.hasFailures());
  }
}
