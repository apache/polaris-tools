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

/**
 * CLI specific utilities and constants.
 */
public class CLIUtil {

    public static final String API_SERVICE_PROPERTIES_DESCRIPTION =
            "\nProperties:" +
            "\n\t- base-url: the base url of the Polaris instance (eg. http://localhost:8181)" +
            "\n\t- token: the bearer token to authenticate against the Polaris instance with." +
            "\n\t- oauth2-server-uri: the uri of the OAuth2 server to authenticate to. (eg. http://localhost:8181/api/catalog/v1/oauth/tokens)" +
            "\n\t- credential: the client credentials to use to authenticate against the Polaris instance (eg. <client_id>:client_secret>)" +
            "\n\t- scope: the scope to authenticate with for the service_admin (eg. PRINCIPAL_ROLE:ALL)";

    public static final String OMNIPOTENT_PRINCIPAL_PROPERTIES_DESCRIPTION =
            "\nOmnipotent Principal Properties:" +
            "\n\t- omnipotent-principal-name: the name of the omnipotent principal created using create-omnipotent-principal on the source Polaris" +
            "\n\t- omnipotent-principal-client-id: the client id of the omnipotent principal created using create-omnipotent-principal on the source Polaris" +
            "\n\t- omnipotent-principal-client-secret: the client secret of the omnipotent principal created using create-omnipotent-principal on the source Polaris" +
            "\n\t- omnipotent-principal-oauth2-server-uri: (default: /v1/oauth/tokens endpoint for provided Polaris base-url) "
                + "the OAuth2 server to use to authenticate the omnipotent-principal for Iceberg catalog access";

    private CLIUtil() {}

}
