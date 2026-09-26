package com.iceguard.executor;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** Pure unit tests for Spark SQL literal quoting — no Quarkus / Spark needed. */
class SparkMaintenanceExecutorTest {

    @Test
    void quotesPlainValues() {
        assertEquals("'analytics.events'", SparkMaintenanceExecutor.sqlLiteral("analytics.events"));
    }

    @Test
    void escapesQuotesWithBackslashNotDoubling() {
        // 'a''b' would be read by Spark as two adjacent literals -> "ab".
        assertEquals("'it\\'s'", SparkMaintenanceExecutor.sqlLiteral("it's"));
    }

    @Test
    void escapesBackslashesBeforeQuotes() {
        // A trailing backslash must not escape the closing quote.
        assertEquals("'a\\\\'", SparkMaintenanceExecutor.sqlLiteral("a\\"));
        assertEquals("'x\\\\\\'y'", SparkMaintenanceExecutor.sqlLiteral("x\\'y"));
    }

    @Test
    void keepsAWhereClauseIntactForIceberg() {
        // Built by the UI: double-quoted inner literal with escaped quote and backslash.
        String where = "country = \"O\\\"Neil\\\\\" AND day >= \"2026-06-01\"";
        assertEquals("'country = \"O\\\\\"Neil\\\\\\\\\" AND day >= \"2026-06-01\"'",
                SparkMaintenanceExecutor.sqlLiteral(where));
    }
}
