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
package org.apache.polaris.tools.sync.polaris.planning;

import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.apache.iceberg.catalog.Namespace;
import org.apache.iceberg.catalog.TableIdentifier;
import org.apache.polaris.core.admin.model.Catalog;
import org.apache.polaris.core.admin.model.CatalogRole;
import org.apache.polaris.core.admin.model.GrantResource;
import org.apache.polaris.core.admin.model.Principal;
import org.apache.polaris.core.admin.model.PrincipalRole;
import org.apache.polaris.tools.sync.polaris.planning.plan.SynchronizationPlan;

/**
 * Planner that implements the base level strategy that can be applied to synchronize the source and target.
 * Can be configured at different levels of modification.
 */
public class BaseStrategyPlanner implements SynchronizationPlanner {

  /**
   * The strategy to employ when using {@link BaseStrategyPlanner}.
   */
  public enum Strategy {

    /**
     * Only create entities that exist on source but don't already exist on the target
     */
    CREATE_ONLY,

    /**
     * Create entities that do not exist on the target, and overwrite existing ones with same name/identifier
     */
    CREATE_AND_OVERWRITE,

    /**
     * Create entities that exist on the source and not target, update entities that exist on both, remove entities
     * from the target that do not exist on the source.
     */
    REPLICATE

  }

  private final Strategy strategy;

  public BaseStrategyPlanner(Strategy strategy) {
    this.strategy = strategy;
  }

  /**
   * Sort entities from the source into create, overwrite, remove, and skip categories
   * on the basis of which identifiers exist on the source and target Polaris.
   * Identifiers that are both on the source and target instance will be marked
   * for overwrite if overwriting is enabled. Entities that are only on the source instance
   * will be marked for creation. Entities that are only on the target instance will be marked for deletion
   * only if the {@link Strategy#REPLICATE} strategy is used.
   * @param entitiesOnSource the entities from the source
   * @param entitiesOnTarget the entities from the target
   * @param requiresOverwrites true if "overwriting" the entity is necessary. Most grant record entities do not need overwriting.
   * @param entityIdentifierSupplier consumes an entity and returns an identifying representation of that entity
   * @return a {@link SynchronizationPlan} with the entities sorted based on the source parity strategy
   * @param <T> the type of the entity
   */
  private <T> SynchronizationPlan<T> sortOnIdentifier(
          Collection<T> entitiesOnSource,
          Collection<T> entitiesOnTarget,
          boolean requiresOverwrites,
          Function<T, Object> entityIdentifierSupplier
  ) {
    Set<Object> sourceEntityIdentifiers = entitiesOnSource.stream().map(entityIdentifierSupplier).collect(Collectors.toSet());
    Set<Object> targetEntityIdentifiers = entitiesOnTarget.stream().map(entityIdentifierSupplier).collect(Collectors.toSet());

    SynchronizationPlan<T> plan = new SynchronizationPlan<>();

    for (T entityOnSource : entitiesOnSource) {
      Object sourceEntityId = entityIdentifierSupplier.apply(entityOnSource);

      if (targetEntityIdentifiers.contains(sourceEntityId)) {
        // If an entity with this identifier exists on both the source and the target

        if (strategy == Strategy.CREATE_ONLY) {
          // if the same entity identifier is on the source and target,
          // but we only permit creates, skip it
          plan.skipEntity(entityOnSource);
        } else {
          // if the same entity identifier is on the source and the target,
          // overwrite the one on the target with the one on the source

          if (requiresOverwrites) {
            // If the entity requires a drop-and-recreate to perform an overwrite.
            // some grant records can be "created" indefinitely even if they already exists, for example,
            // catalog roles can be assigned the same principal role many times
            plan.overwriteEntity(entityOnSource);
          } else {
            // if the entity is not a type that requires "overwriting" in the sense of
            // dropping and recreating, then just create it again
            plan.createEntity(entityOnSource);
          }
        }
      } else {
        // if the entity identifier only exists on the source, that means
        // we need to create it for the first time on the target
        plan.createEntity(entityOnSource);
      }
    }

    for (T entityOnTarget : entitiesOnTarget) {
      Object targetEntityId = entityIdentifierSupplier.apply(entityOnTarget);
      if (!sourceEntityIdentifiers.contains(targetEntityId)) {
        // if the entity exists on the target but doesn't exist on the source,
        // clean it up from the target

        // this is especially important for access control entities, as, for example,
        // we could have a scenario where a grant was revoked from a catalog role,
        // or a catalog role was revoked from a principal role, in which case the target
        // should reflect this change when the tool is run multiple times, because we don't
        // want to take chances with over-extending privileges

        if (strategy == Strategy.REPLICATE) {
          plan.removeEntity(entityOnTarget);
        } else {
          // skip children here because if we want to remove the entity
          // and then that means it does not exist on the source, so there are no child
          // entities to sync
          plan.skipEntityAndSkipChildren(entityOnTarget);
        }
      }
    }

    return plan;
  }

  @Override
  public SynchronizationPlan<Principal> planPrincipalSync(
          List<Principal> principalsOnSource, List<Principal> principalsOnTarget) {
    return sortOnIdentifier(principalsOnSource, principalsOnTarget, /* requiresOverwrites */ true, Principal::getName);
  }

  @Override
  public SynchronizationPlan<PrincipalRole> planAssignPrincipalsToPrincipalRolesSync(
          String principalName,
          List<PrincipalRole> assignedPrincipalRolesOnSource,
          List<PrincipalRole> assignedPrincipalRolesOnTarget
  ) {
    return sortOnIdentifier(
            assignedPrincipalRolesOnSource,
            assignedPrincipalRolesOnTarget,
            /* requiresOverwrites */ false, // do not need to overwrite an assignment of a principal role to a principal
            PrincipalRole::getName
    );
  }

  @Override
  public SynchronizationPlan<PrincipalRole> planPrincipalRoleSync(
      List<PrincipalRole> principalRolesOnSource, List<PrincipalRole> principalRolesOnTarget) {

    return sortOnIdentifier(
            principalRolesOnSource,
            principalRolesOnTarget,
            /* requiresOverwrites */ true,
            PrincipalRole::getName
    );
  }

  @Override
  public SynchronizationPlan<Catalog> planCatalogSync(
      List<Catalog> catalogsOnSource, List<Catalog> catalogsOnTarget) {
    return sortOnIdentifier(catalogsOnSource, catalogsOnTarget,  /* requiresOverwrites */ true, Catalog::getName);
  }

  @Override
  public SynchronizationPlan<CatalogRole> planCatalogRoleSync(
      String catalogName,
      List<CatalogRole> catalogRolesOnSource,
      List<CatalogRole> catalogRolesOnTarget) {
    return sortOnIdentifier(
            catalogRolesOnSource, catalogRolesOnTarget, /* requiresOverwrites */ true, CatalogRole::getName);
  }

  @Override
  public SynchronizationPlan<GrantResource> planGrantSync(
      String catalogName,
      String catalogRoleName,
      List<GrantResource> grantsOnSource,
      List<GrantResource> grantsOnTarget) {
    return sortOnIdentifier(
            grantsOnSource,
            grantsOnTarget,
            /* requiresOverwrites */ false,
            grant -> grant // grants can just be compared by the entire generated object
    );
  }

  @Override
  public SynchronizationPlan<PrincipalRole> planAssignPrincipalRolesToCatalogRolesSync(
      String catalogName,
      String catalogRoleName,
      List<PrincipalRole> assignedPrincipalRolesOnSource,
      List<PrincipalRole> assignedPrincipalRolesOnTarget) {
    return sortOnIdentifier(
            assignedPrincipalRolesOnSource,
            assignedPrincipalRolesOnTarget,
            /* requiresOverwrites */ false,
            PrincipalRole::getName
    );
  }

  @Override
  public SynchronizationPlan<Namespace> planNamespaceSync(
      String catalogName,
      Namespace namespace,
      List<Namespace> namespacesOnSource,
      List<Namespace> namespacesOnTarget) {
    return sortOnIdentifier(namespacesOnSource, namespacesOnTarget, /* requiresOverwrites */ true, ns -> ns);
  }

  @Override
  public SynchronizationPlan<TableIdentifier> planTableSync(
      String catalogName,
      Namespace namespace,
      Set<TableIdentifier> tablesOnSource,
      Set<TableIdentifier> tablesOnTarget) {
    return sortOnIdentifier(
            tablesOnSource, tablesOnTarget, /* requiresOverwrites */ true, tableId -> tableId);
  }
}
