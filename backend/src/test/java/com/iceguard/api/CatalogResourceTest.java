package com.iceguard.api;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
class CatalogResourceTest {

    @Test
    void listCatalogs_empty() {
        given()
                .when().get("/api/catalogs")
                .then()
                .statusCode(200)
                .body("$", hasSize(0));
    }

    @Test
    void createAndGetCatalog() {
        String body = """
                {
                    "name": "test-catalog",
                    "uri": "http://localhost:8181",
                    "authType": "NONE"
                }
                """;

        Long id = given()
                .contentType(ContentType.JSON)
                .body(body)
                .when().post("/api/catalogs")
                .then()
                .statusCode(201)
                .body("name", is("test-catalog"))
                .body("uri", is("http://localhost:8181"))
                .extract().jsonPath().getLong("id");

        given()
                .when().get("/api/catalogs/" + id)
                .then()
                .statusCode(200)
                .body("name", is("test-catalog"));

        given()
                .when().delete("/api/catalogs/" + id)
                .then()
                .statusCode(204);
    }

    @Test
    void createCatalog_missingName_returns400() {
        String body = """
                {
                    "name": "",
                    "uri": "http://localhost:8181"
                }
                """;

        given()
                .contentType(ContentType.JSON)
                .body(body)
                .when().post("/api/catalogs")
                .then()
                .statusCode(400);
    }

    @Test
    void getCatalog_notFound() {
        given()
                .when().get("/api/catalogs/99999")
                .then()
                .statusCode(404);
    }
}
