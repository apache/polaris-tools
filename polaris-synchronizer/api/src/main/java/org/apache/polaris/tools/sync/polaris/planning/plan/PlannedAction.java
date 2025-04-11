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

public enum PlannedAction {

  /** For entities that are being freshly created on target. */
  CREATE,

  /** For entities that have to be dropped and recreated on target. */
  OVERWRITE,

  /** For entities that need to be dropped from the target. */
  REMOVE,

  /**
   * For entities that should be skipped. Note that their child entities will still be synced. For
   * example, we may skip a catalog role but its grants and assignments to principal roles will
   * still be synced.
   */
  SKIP,

  /**
   * For entities that should be skipped due to no modification detected. Note that their child
   * entities will still be synced. For example, we may skip a catalog role but its grants and
   * assignments to principal roles will still be synced.
   */
  SKIP_NOT_MODIFIED,

  /**
   * For entities that should be skipped along with also skipping their child entities. Used in
   * cases where we don't want to mess with an entire entity tree. For example we may not want to
   * edit the catalog roles assigned to the service_admin.
   */
  SKIP_AND_SKIP_CHILDREN
}
