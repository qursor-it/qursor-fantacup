package it.qursor.stories;

import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import org.eclipse.microprofile.jwt.JsonWebToken;

/** Chi sta chiamando: utile per provare l'auth e come esempio per le altre risorse. */
@Path("/me")
@Authenticated
public class MeResource {

    @Inject
    JsonWebToken jwt;

    public record Me(long id, String email, String role) {}

    @GET
    public Me me() {
        String role = jwt.getGroups().stream().findFirst().orElse(null);
        return new Me(Long.parseLong(jwt.getSubject()), jwt.getName(), role);
    }
}
