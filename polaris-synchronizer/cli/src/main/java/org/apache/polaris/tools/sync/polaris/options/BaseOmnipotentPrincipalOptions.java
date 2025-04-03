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

import org.apache.polaris.core.admin.model.Principal;
import org.apache.polaris.core.admin.model.PrincipalWithCredentials;
import org.apache.polaris.core.admin.model.PrincipalWithCredentialsCredentials;

public abstract class BaseOmnipotentPrincipalOptions {

  protected static final String PRINCIPAL_NAME = "omni-principal-name";

  protected static final String CLIENT_ID = "omni-client-id";

  protected static final String CLIENT_SECRET = "omni-client-secret";

  protected String principalName;

  protected String clientId;

  protected String clientSecret;

  public abstract void setPrincipalName(String principalName);

  public abstract void setClientId(String clientId);

  public abstract void setClientSecret(String clientSecret);

  public PrincipalWithCredentials buildPrincipalWithCredentials() {
    return new PrincipalWithCredentials()
        .principal(new Principal().name(principalName))
        .credentials(
            new PrincipalWithCredentialsCredentials()
                .clientId(clientId)
                .clientSecret(clientSecret));
  }
}
