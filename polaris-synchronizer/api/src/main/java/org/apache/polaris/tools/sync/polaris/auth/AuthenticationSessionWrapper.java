package org.apache.polaris.tools.sync.polaris.auth;

import org.apache.iceberg.rest.HTTPClient;
import org.apache.iceberg.rest.RESTClient;
import org.apache.iceberg.rest.auth.AuthConfig;
import org.apache.iceberg.rest.auth.OAuth2Properties;
import org.apache.iceberg.rest.auth.OAuth2Util;
import org.apache.iceberg.util.ThreadPools;

import java.util.Map;
import java.util.UUID;

/**
 * Wraps {@link OAuth2Util.AuthSession} to provide authentication flow.
 */
public class AuthenticationSessionWrapper {

    private final OAuth2Util.AuthSession authSession;

    public AuthenticationSessionWrapper(Map<String, String> properties) {
        this.authSession = this.newAuthSession(properties);
    }

    /**
     * Initializes a new authentication session.
     * @param properties properties to initialize the session with
     * @return an authentication session. If using client_credentials flow, the session will refresh itself
     */
    private OAuth2Util.AuthSession newAuthSession(Map<String, String> properties) {
        if (properties.containsKey(OAuth2Properties.TOKEN)) {
            return new OAuth2Util.AuthSession(
                    Map.of(),
                    AuthConfig.builder()
                            .token(properties.get(OAuth2Properties.TOKEN))
                            .build()
            );
        }

        RESTClient restClient = HTTPClient.builder(Map.of())
                .uri(properties.get(OAuth2Properties.OAUTH2_SERVER_URI))
                .build();

        OAuth2Util.AuthSession parent = new OAuth2Util.AuthSession(
                Map.of(),
                AuthConfig.builder()
                        .credential(properties.get(OAuth2Properties.CREDENTIAL))
                        .scope(properties.get(OAuth2Properties.SCOPE))
                        .oauth2ServerUri(properties.get(OAuth2Properties.OAUTH2_SERVER_URI))
                        .optionalOAuthParams(OAuth2Util.buildOptionalParam(properties))
                        .build()
        );

        // This is for client_credentials flow
        if (properties.containsKey(OAuth2Properties.CREDENTIAL)) {
            return OAuth2Util.AuthSession.fromCredential(
                    restClient,
                    ThreadPools.newScheduledPool(UUID.randomUUID() + "-token-refresh", 1),
                    properties.get(OAuth2Properties.CREDENTIAL),
                    parent
            );
        }

        if (properties.containsKey(OAuth2Properties.ACCESS_TOKEN_TYPE)) {
            return OAuth2Util.AuthSession.fromTokenExchange(
                    restClient,
                    ThreadPools.newScheduledPool(UUID.randomUUID() + "-token-exchange", 1),
                    properties.get(OAuth2Properties.ACCESS_TOKEN_TYPE),
                    OAuth2Properties.ACCESS_TOKEN_TYPE,
                    parent
            );
        }

        throw new IllegalArgumentException("Unable to construct authenticated session with the provided properties.");
    }

    public Map<String, String> getSessionHeaders() {
        return this.authSession.headers();
    }

}
