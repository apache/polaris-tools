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
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Data structure that holds the state of all the planned modifications that should be made on the
 * target.
 *
 * @param <T> the entity type that the plan is for
 */
public class SynchronizationPlan<T> {

  private final Map<PlannedAction, List<T>> entitiesForAction;

  public SynchronizationPlan() {
    this.entitiesForAction = new HashMap<>();

    for (PlannedAction action : PlannedAction.values()) {
      this.entitiesForAction.put(action, new ArrayList<>());
    }
  }

  public List<T> entitiesForAction(PlannedAction action) {
    return entitiesForAction.get(action);
  }

  public List<T> entitiesToCreate() {
    return entitiesForAction(PlannedAction.CREATE);
  }

  public List<T> entitiesToOverwrite() {
    return entitiesForAction(PlannedAction.OVERWRITE);
  }

  public List<T> entitiesToRemove() {
    return entitiesForAction(PlannedAction.REMOVE);
  }

  public List<T> entitiesToSkip() {
    return entitiesForAction(PlannedAction.SKIP);
  }

  public List<T> entitiesNotModified() {
    return entitiesForAction(PlannedAction.SKIP_NOT_MODIFIED);
  }

  public List<T> entitiesToSkipAndSkipChildren() {
    return entitiesForAction(PlannedAction.SKIP_AND_SKIP_CHILDREN);
  }

  public List<T> entitiesToSyncChildren() {
    List<T> entities = new ArrayList<>();

    for (PlannedAction action : PlannedAction.values()) {
      if (action != PlannedAction.SKIP_AND_SKIP_CHILDREN && action != PlannedAction.REMOVE) {
        entities.addAll(entitiesForAction(action));
      }
    }

    return entities;
  }

  public void actOnEntity(PlannedAction action, T entity) {
    this.entitiesForAction.get(action).add(entity);
  }

  public void createEntity(T entity) {
    this.actOnEntity(PlannedAction.CREATE, entity);
  }

  public void overwriteEntity(T entity) {
    this.actOnEntity(PlannedAction.OVERWRITE, entity);
  }

  public void removeEntity(T entity) {
    this.actOnEntity(PlannedAction.REMOVE, entity);
  }

  public void skipEntity(T entity) {
    this.actOnEntity(PlannedAction.SKIP, entity);
  }

  public void skipEntityNotModified(T entity) {
    this.actOnEntity(PlannedAction.SKIP_NOT_MODIFIED, entity);
  }

  public void skipEntityAndSkipChildren(T entity) {
    this.actOnEntity(PlannedAction.SKIP_AND_SKIP_CHILDREN, entity);
  }
}
