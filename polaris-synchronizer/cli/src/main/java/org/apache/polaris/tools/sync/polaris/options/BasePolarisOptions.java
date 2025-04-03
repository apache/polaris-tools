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

import java.io.IOException;
import org.apache.polaris.tools.sync.polaris.PolarisService;
import org.apache.polaris.tools.sync.polaris.PolarisServiceFactory;

public abstract class BasePolarisOptions {

  protected static final String BASE_URL = "base-url";

  protected static final String CLIENT_ID = "client-id";

  protected static final String CLIENT_SECRET = "client-secret";

  protected static final String SCOPE = "scope";

  protected static final String OAUTH2_SERVER_URI = "oauth2-server-uri";

  protected static final String ACCESS_TOKEN = "access-token";

  protected String baseUrl;

  protected String oauth2ServerUri;

  protected String clientId;

  protected String clientSecret;

  protected String scope;

  protected String accessToken;

  public abstract String getServiceName();

  public abstract void setBaseUrl(String baseUrl);

  public abstract void setOauth2ServerUri(String oauth2ServerUri);

  public abstract void setClientId(String clientId);

  public abstract void setClientSecret(String clientSecret);

  public abstract void setScope(String scope);

  public abstract void setAccessToken(String accessToken);

  public PolarisService buildService() throws IOException {
    if (accessToken != null) {
      return PolarisServiceFactory.newPolarisService(baseUrl, accessToken);
    }
    return PolarisServiceFactory.newPolarisService(
        baseUrl, oauth2ServerUri, clientId, clientSecret, scope);
  }
}
