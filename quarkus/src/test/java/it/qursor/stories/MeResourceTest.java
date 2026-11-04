package it.qursor.stories;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;

import io.quarkus.test.junit.QuarkusTest;
import io.smallrye.jwt.build.Jwt;
import java.util.Set;
import org.junit.jupiter.api.Test;

@QuarkusTest
class MeResourceTest {

    private static String token(String issuer, String audience, long expiresInSeconds) {
        long now = System.currentTimeMillis() / 1000;
        return Jwt.issuer(issuer)
                .audience(audience)
                .subject("42")
                .upn("mario@example.com")
                .groups(Set.of("USER"))
                .issuedAt(now)
                .expiresAt(now + expiresInSeconds)
                .sign();
    }

    @Test
    void validTokenIdentifiesCaller() {
        given().auth().oauth2(token("qursor-fantacup", "stories", 300))
                .when().get("/me")
                .then().statusCode(200)
                .body("id", equalTo(42))
                .body("email", equalTo("mario@example.com"))
                .body("role", equalTo("USER"));
    }

    @Test
    void missingTokenIsRejected() {
        given().when().get("/me").then().statusCode(401);
    }

    @Test
    void wrongIssuerIsRejected() {
        given().auth().oauth2(token("someone-else", "stories", 300))
                .when().get("/me").then().statusCode(401);
    }

    @Test
    void wrongAudienceIsRejected() {
        given().auth().oauth2(token("qursor-fantacup", "other", 300))
                .when().get("/me").then().statusCode(401);
    }

    @Test
    void expiredTokenIsRejected() {
        given().auth().oauth2(token("qursor-fantacup", "stories", -120))
                .when().get("/me").then().statusCode(401);
    }
}
