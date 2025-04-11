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
package org.apache.polaris.tools.sync.polaris.options;

import picocli.CommandLine;

public class TargetOmnipotentPrincipal extends BaseOmnipotentPrincipalOptions {

  @CommandLine.Option(
      names = "--target-" + PRINCIPAL_NAME,
      required = true,
      description = "The principal name of the source omnipotent principal.")
  @Override
  public void setPrincipalName(String principalName) {
    this.principalName = principalName;
  }

  @CommandLine.Option(
      names = "--target-" + CLIENT_ID,
      required = true,
      description = "The client id of the source omnipotent principal.")
  @Override
  public void setClientId(String clientId) {
    this.clientId = clientId;
  }

  @CommandLine.Option(
      names = "--target-" + CLIENT_SECRET,
      required = true,
      description = "The client secret of the source omnipotent principal.")
  @Override
  public void setClientSecret(String clientSecret) {
    this.clientSecret = clientSecret;
  }
}
