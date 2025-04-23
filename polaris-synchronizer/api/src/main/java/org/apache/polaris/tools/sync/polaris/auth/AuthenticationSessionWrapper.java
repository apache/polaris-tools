package org.apache.polaris.tools.sync.polaris.auth;

import org.apache.iceberg.rest.HTTPClient;
import org.apache.iceberg.rest.RESTClient;
import org.apache.iceberg.rest.auth.AuthConfig;
import org.apache.iceberg.rest.auth.OAuth2Properties;
import org.apache.iceberg.rest.auth.OAuth2Util;
import org.apache.iceberg.util.ThreadPools;

import java.io.Closeable;
import java.io.IOException;
import java.util.Map;
import java.util.UUID;

/**
 * Wraps {@link OAuth2Util.AuthSession} to provide supported authentication flows.
 */
public class AuthenticationSessionWrapper implements Closeable {

    private final RESTClient restClient;

    private final OAuth2Util.AuthSession authSession;

    public AuthenticationSessionWrapper(Map<String, String> properties) {
        this.restClient = HTTPClient.builder(Map.of())
                .uri(properties.get(OAuth2Properties.OAUTH2_SERVER_URI))
                .build();
        this.authSession = this.newAuthSession(this.restClient, properties);
    }

    /**
     * Initializes a new authentication session. Supports client_credentials and bearer token flow.
     * @param properties properties to initialize the session with
     * @return an authentication session, with token refresh if applicable
     */
    private OAuth2Util.AuthSession newAuthSession(RESTClient restClient, Map<String, String> properties) {
        OAuth2Util.AuthSession parent = new OAuth2Util.AuthSession(
                Map.of(),
                AuthConfig.builder()
                        .scope(properties.get(OAuth2Properties.SCOPE))
                        .oauth2ServerUri(properties.get(OAuth2Properties.OAUTH2_SERVER_URI))
                        .optionalOAuthParams(OAuth2Util.buildOptionalParam(properties))
                        .build()
        );

        // This is for client_credentials flow
        if (properties.containsKey(OAuth2Properties.CREDENTIAL)) {
            return OAuth2Util.AuthSession.fromCredential(
                    restClient,
                    // threads created here will be daemon threads, so termination of main program
                    // will terminate the token refresh thread automatically
                    ThreadPools.newScheduledPool(UUID.randomUUID() + "-token-refresh", 1),
                    properties.get(OAuth2Properties.CREDENTIAL),
                    parent
            );
        }

        // This is for regular bearer token flow
        if (properties.containsKey(OAuth2Properties.TOKEN)) {
            return OAuth2Util.AuthSession.fromAccessToken(
                    restClient,
                    // threads created here will be daemon threads, so termination of main program
                    // will terminate the token refresh thread automatically
                    ThreadPools.newScheduledPool(UUID.randomUUID() + "-access-token-refresh", 1),
                    properties.get(OAuth2Properties.TOKEN),
                    null, /* defaultExpiresAtMillis */
                    parent
            );
        }

        throw new IllegalArgumentException("Unable to construct authenticated session with the provided properties.");
    }

    /**
     * Get refreshed authentication headers for session.
     */
    public Map<String, String> getSessionHeaders() {
        return this.authSession.headers();
    }

    @Override
    public void close() throws IOException {
        if (this.restClient != null) {
            this.restClient.close();
        }
    }

}
