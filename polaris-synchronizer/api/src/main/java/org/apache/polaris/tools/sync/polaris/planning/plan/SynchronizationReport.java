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

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Accumulates the outcome of every individual entity sync attempt performed during a run, so that
 * a single consolidated summary can be printed at the end instead of relying on interleaved logs.
 */
public class SynchronizationReport {

  private record Failure(EntityType type, String identifier, String message) {}

  private final Map<EntityType, Map<SyncOutcome, Integer>> counts;

  private final List<Failure> failures;

  public SynchronizationReport() {
    this.counts = new EnumMap<>(EntityType.class);
    for (EntityType type : EntityType.values()) {
      Map<SyncOutcome, Integer> outcomeCounts = new EnumMap<>(SyncOutcome.class);
      for (SyncOutcome outcome : SyncOutcome.values()) {
        outcomeCounts.put(outcome, 0);
      }
      this.counts.put(type, outcomeCounts);
    }
    this.failures = new ArrayList<>();
  }

  /**
   * Records that an entity was successfully synced.
   *
   * @param type the category of entity that was synced
   * @param outcome the outcome of the sync; must not be {@link SyncOutcome#FAILED} - use {@link
   *     #recordFailure(EntityType, String, Exception)} for failures
   */
  public void recordSuccess(EntityType type, SyncOutcome outcome) {
    if (outcome == SyncOutcome.FAILED) {
      throw new IllegalArgumentException("Use recordFailure() to record a failed sync.");
    }
    Map<SyncOutcome, Integer> outcomeCounts = counts.get(type);
    outcomeCounts.put(outcome, outcomeCounts.get(outcome) + 1);
  }

  /**
   * Records that an entity failed to sync.
   *
   * @param type the category of entity that failed to sync
   * @param identifier a human-readable identifier for the entity, e.g. its name
   * @param cause the exception that caused the failure
   */
  public void recordFailure(EntityType type, String identifier, Exception cause) {
    Map<SyncOutcome, Integer> outcomeCounts = counts.get(type);
    outcomeCounts.put(SyncOutcome.FAILED, outcomeCounts.get(SyncOutcome.FAILED) + 1);
    failures.add(new Failure(type, identifier, cause.getMessage()));
  }

  /** Returns true if any entity failed to sync. */
  public boolean hasFailures() {
    return !failures.isEmpty();
  }

  private static String displayName(EntityType type) {
    return switch (type) {
      case PRINCIPAL -> "Principal";
      case PRINCIPAL_ROLE -> "PrincipalRole";
      case PRINCIPAL_ROLE_ASSIGNMENT -> "PrincipalRoleAssignment";
      case CATALOG -> "Catalog";
      case CATALOG_ROLE -> "CatalogRole";
      case CATALOG_ROLE_ASSIGNMENT -> "CatalogRoleAssignment";
      case GRANT -> "Grant";
      case NAMESPACE -> "Namespace";
      case TABLE -> "Table";
    };
  }

  /** Renders the accumulated counts and failures as a human-readable text block. */
  public String render() {
    StringBuilder sb = new StringBuilder();
    sb.append("=== Synchronization Report ===\n");

    for (EntityType type : EntityType.values()) {
      Map<SyncOutcome, Integer> outcomeCounts = counts.get(type);
      int total =
          outcomeCounts.get(SyncOutcome.CREATED)
              + outcomeCounts.get(SyncOutcome.OVERWRITTEN)
              + outcomeCounts.get(SyncOutcome.REMOVED)
              + outcomeCounts.get(SyncOutcome.SKIPPED)
              + outcomeCounts.get(SyncOutcome.FAILED);

      if (total == 0) {
        continue;
      }

      sb.append(
          String.format(
              "%-24s%d created, %d overwritten, %d removed, %d skipped, %d failed%n",
              displayName(type) + ":",
              outcomeCounts.get(SyncOutcome.CREATED),
              outcomeCounts.get(SyncOutcome.OVERWRITTEN),
              outcomeCounts.get(SyncOutcome.REMOVED),
              outcomeCounts.get(SyncOutcome.SKIPPED),
              outcomeCounts.get(SyncOutcome.FAILED)));
    }

    if (hasFailures()) {
      sb.append("\nFailures:\n");
      for (Failure failure : failures) {
        sb.append(
            String.format(
                "  - %s '%s': %s%n",
                displayName(failure.type()), failure.identifier(), failure.message()));
      }
    }

    sb.append("===============================");

    return sb.toString();
  }
}
