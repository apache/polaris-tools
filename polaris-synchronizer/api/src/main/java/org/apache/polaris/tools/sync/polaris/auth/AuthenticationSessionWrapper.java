package org.apache.polaris.tools.sync.polaris.auth;

import org.apache.iceberg.rest.HTTPClient;
import org.apache.iceberg.rest.RESTClient;
import org.apache.iceberg.rest.auth.AuthConfig;
import org.apache.iceberg.rest.auth.OAuth2Properties;
import org.apache.iceberg.rest.auth.OAuth2Util;
import org.apache.iceberg.util.ThreadPools;

import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Wraps {@link OAuth2Util.AuthSession} to provide supported authentication flows.
 */
public class AuthenticationSessionWrapper {

    /**
     * Order of token exchange preference copied over from {@link org.apache.iceberg.rest.RESTSessionCatalog}.
     */
    private static final Set<String> TOKEN_PREFERENCE_ORDER =
            Set.of(
                    OAuth2Properties.ID_TOKEN_TYPE,
                    OAuth2Properties.ACCESS_TOKEN_TYPE,
                    OAuth2Properties.JWT_TOKEN_TYPE,
                    OAuth2Properties.SAML2_TOKEN_TYPE,
                    OAuth2Properties.SAML1_TOKEN_TYPE);

    private final OAuth2Util.AuthSession authSession;

    public AuthenticationSessionWrapper(Map<String, String> properties) {
        this.authSession = this.newAuthSession(properties);
    }

    /**
     * Initializes a new authentication session. Biases in order of client_credentials,
     * token exchange, regular access token.
     * @param properties properties to initialize the session with
     * @return an authentication session, with token refresh if applicable
     */
    private OAuth2Util.AuthSession newAuthSession(Map<String, String> properties) {

        RESTClient restClient = HTTPClient.builder(Map.of())
                .uri(properties.get(OAuth2Properties.OAUTH2_SERVER_URI))
                .build();

        OAuth2Util.AuthSession parent = new OAuth2Util.AuthSession(
                Map.of(),
                AuthConfig.builder()
                        .credential(properties.get(OAuth2Properties.CREDENTIAL))
                        .scope(properties.get(OAuth2Properties.SCOPE))
                        .oauth2ServerUri(properties.get(OAuth2Properties.OAUTH2_SERVER_URI))
                        .token(properties.get(OAuth2Properties.TOKEN))
                        // actor token type is always access token, Polaris needs an actor token for token exchange
                        .tokenType(OAuth2Properties.ACCESS_TOKEN_TYPE)
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

        // NOTE: We have to bias for token exchange before regular bearer token flow so we can pass the "token" property
        // as an actor token to the token exchange request, otherwise we will always branch into the bearer token
        // flow first even if a token exchange is being configured

        // This is for token exchange flow, Polaris only supports an access_token exchanged for an access_token for now
        for (String tokenType : TOKEN_PREFERENCE_ORDER) {
            if (properties.containsKey(tokenType)) {
                return OAuth2Util.AuthSession.fromTokenExchange(
                        restClient,
                        ThreadPools.newScheduledPool(UUID.randomUUID() + "-token-exchange", 1),
                        properties.get(tokenType),
                        tokenType,
                        parent
                );
            }
        }

        // This is for regular bearer token flow
        if (properties.containsKey(OAuth2Properties.TOKEN)) {
            return OAuth2Util.AuthSession.fromAccessToken(
                    restClient,
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

}
