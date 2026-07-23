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
package org.apache.polaris.tools.sync.polaris;

import java.util.Map;
import org.apache.polaris.core.admin.model.PrincipalWithCredentials;
import org.apache.polaris.tools.sync.polaris.access.CredentialWriter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Implementation that logs principal credentials to the console. */
public class ConsoleCredentialWriter implements CredentialWriter {

  private final Logger consoleLog = LoggerFactory.getLogger("console-log");

  @Override
  public void initialize(Map<String, String> properties) {}

  @Override
  public void writeCredentials(PrincipalWithCredentials principalWithCredentials) {
    consoleLog.info(
        "\n======================================================\n"
            + "Principal Credentials:\n"
            + "\tname = {}\n"
            + "\tclientId = {}\n"
            + "\tclientSecret = {}\n"
            + "======================================================",
        principalWithCredentials.getPrincipal().getName(),
        principalWithCredentials.getCredentials().getClientId(),
        principalWithCredentials.getCredentials().getClientSecret());
  }

  @Override
  public void close() {}
}
