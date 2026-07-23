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
package org.apache.polaris.tools.sync.polaris.access;

import java.util.Map;
import org.apache.polaris.core.admin.model.PrincipalWithCredentials;

/**
 * Generic interface to output newly generated/rotated principal credentials. This allows the
 * destination of the credentials to be completely independent from the tool.
 */
public interface CredentialWriter extends AutoCloseable {

  /**
   * Used to initialize the instance for use. Should be called prior to calling any methods.
   *
   * @param properties properties to configure instance with
   */
  void initialize(Map<String, String> properties);

  /**
   * Outputs the given principal's credentials.
   *
   * @param principalWithCredentials the principal and its associated credentials
   */
  void writeCredentials(PrincipalWithCredentials principalWithCredentials);
}
