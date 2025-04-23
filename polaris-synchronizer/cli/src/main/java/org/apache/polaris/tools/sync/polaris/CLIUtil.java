package org.apache.polaris.tools.sync.polaris;

import java.io.Closeable;
import java.io.IOException;

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
            "\n\t- scope: the scope to authenticate with for the service_admin (eg. PRINCIPAL_ROLE:ALL)" +
            "\n\t- <token_type>=<token>: for token exchange authentication, the token type (eg. urn:ietf:params:oauth:token-type:access_token) with a provided token";

    public static final String OMNIPOTENT_PRINCIPAL_PROPERTIES_DESCRIPTION =
            "\nOmnipotent Principal Properties:" +
            "\n\t- omnipotent-principal-name: the name of the omnipotent principal created using create-omnipotent-principal on the source Polaris" +
            "\n\t- omnipotent-principal-client-id: the client id of the omnipotent principal created using create-omnipotent-principal on the source Polaris" +
            "\n\t- omnipotent-principal-client-secret: the client secret of the omnipotent principal created using create-omnipotent-principal on the source Polaris" +
            "\n\t- omnipotent-principal-oauth2-server-uri: (default: /v1/oauth/tokens endpoint for provided Polaris base-url) "
                + "the OAuth2 server to use to authenticate the omnipotent-principal for Iceberg catalog access";

    private CLIUtil() {}

    /**
     * While all resources should ideally be explicitly closed prior to program termination,
     * passing a closeable entity to this method adds a runtime shutdown hook to close the
     * provided resource on program termination, even if the entity was not explicitly
     * properly closed prior. This is useful in the event that some hard failure occurs before
     * the program reaches the call to {@link Closeable#close()}.
     * @param closeable the resource to close
     */
    public static void closeResourceOnTermination(final Closeable closeable) {
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            try {
                closeable.close();
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }));
    }

}
