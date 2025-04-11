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

public class SourcePolarisOptions extends BasePolarisOptions {

  @Override
  public String getServiceName() {
    return "source";
  }

  @CommandLine.Option(
      names = "--source-" + BASE_URL,
      required = true,
      description = "The base url of the Polaris instance. Example: http://localhost:8181/polaris.")
  @Override
  public void setBaseUrl(String baseUrl) {
    this.baseUrl = baseUrl;
  }

  @CommandLine.Option(
      names = "--source-" + OAUTH2_SERVER_URI,
      description = {
        "(Note: required if access-token not provided) the oauth2-server-uri to authenticate against to "
            + "obtain an access token for the Polaris instance."
      })
  @Override
  public void setOauth2ServerUri(String oauth2ServerUri) {
    this.oauth2ServerUri = oauth2ServerUri;
  }

  @CommandLine.Option(
      names = "--source-" + CLIENT_ID,
      description = {
        "(Note: required if access-token not provided) The client id for the principal the tool will assume"
            + " to carry out the copy. This principal must have SERVICE_MANAGE_ACCESS level privileges."
      })
  @Override
  public void setClientId(String clientId) {
    this.clientId = clientId;
  }

  @CommandLine.Option(
      names = "--source-" + CLIENT_SECRET,
      description = {
        "(Note: required if access-token not provided) The client secret for the principal the tool will assume"
            + " to carry out the copy. This principal must have SERVICE_MANAGE_ACCESS level privileges."
      })
  @Override
  public void setClientSecret(String clientSecret) {
    this.clientSecret = clientSecret;
  }

  @CommandLine.Option(
      names = "--source-" + SCOPE,
      description = {
        "(Note: required if access-token not provided) The scope that the principal the tool will assume"
            + " to carry out the copy. This principal must have SERVICE_MANAGE_ACCESS level privileges."
      })
  @Override
  public void setScope(String scope) {
    this.scope = scope;
  }

  @CommandLine.Option(
      names = "--source-" + ACCESS_TOKEN,
      description = "The access token to authenticate to the Polaris instance")
  @Override
  public void setAccessToken(String accessToken) {
    this.accessToken = accessToken;
  }
}
