package com.iceguard.executor;

import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * Runs Iceberg maintenance through a Spark job, launched as an external {@code spark-sql}
 * subprocess. The Spark master is supplied per request (e.g. {@code local[*]} for local mode,
 * or a cluster URL), so the same code path serves both local and remote clusters.
 *
 * <p>This keeps the heavy Spark/Scala runtime out of the Quarkus JVM (which already ships
 * {@code iceberg-core}); Spark resolves its own runtime via {@code --packages} at submit time.
 *
 * <p>Reserved option keys (prefixed with {@code __}) carry infrastructure config; every other
 * option is forwarded as an Iceberg {@code rewrite_data_files} option.
 */
@ApplicationScoped
@SparkEngine
public class SparkMaintenanceExecutor implements MaintenanceExecutor {

    private static final Logger LOG = Logger.getLogger(SparkMaintenanceExecutor.class);

    public static final String OPT_MASTER = "__master";
    public static final String OPT_CATALOG_URI = "__catalog_uri";
    public static final String OPT_CATALOG_WAREHOUSE = "__catalog_warehouse";
    public static final String OPT_S3_ENDPOINT = "__s3_endpoint";
    public static final String OPT_S3_ACCESS_KEY = "__s3_access_key";
    public static final String OPT_S3_SECRET_KEY = "__s3_secret_key";
    public static final String OPT_S3_PATH_STYLE = "__s3_path_style";
    public static final String OPT_S3_REGION = "__s3_region";
    /** Prefix for extra raw Spark --conf entries, e.g. "__conf.spark.executor.memory". */
    public static final String OPT_CONF_PREFIX = "__conf.";

    @ConfigProperty(name = "iceguard.spark.sql-path", defaultValue = "spark-sql")
    String sparkSqlPath;

    // Empty => assume the jars are already on Spark's classpath (e.g. baked into the image),
    // so no --packages download is attempted at runtime. Optional so an empty override is valid.
    @ConfigProperty(name = "iceguard.spark.iceberg-runtime",
            defaultValue = "org.apache.iceberg:iceberg-spark-runtime-3.5_2.12:1.7.1")
    java.util.Optional<String> icebergRuntime;

    @ConfigProperty(name = "iceguard.spark.aws-bundle",
            defaultValue = "org.apache.iceberg:iceberg-aws-bundle:1.7.1")
    java.util.Optional<String> awsBundle;

    @ConfigProperty(name = "iceguard.spark.extra-packages")
    java.util.Optional<String> extraPackages;

    @ConfigProperty(name = "iceguard.spark.catalog-name", defaultValue = "ice")
    String catalogName;

    @ConfigProperty(name = "iceguard.spark.timeout-seconds", defaultValue = "1800")
    int timeoutSeconds;

    @Override
    public String name() {
        return "spark-sql";
    }

    @Override
    public MaintenanceResult expireSnapshots(ExecutorContext ctx, Long olderThanMs, Integer retainLast) {
        return MaintenanceResult.unsupported("expireSnapshots is not yet supported by the Spark executor");
    }

    @Override
    public MaintenanceResult rollbackToSnapshot(ExecutorContext ctx, long snapshotId) {
        return MaintenanceResult.unsupported("rollback is not yet supported by the Spark executor");
    }

    @Override
    public MaintenanceResult rewriteDataFiles(ExecutorContext ctx, Map<String, String> options) {
        String master = options.getOrDefault(OPT_MASTER, "local[*]");
        String catalogUri = options.get(OPT_CATALOG_URI);
        if (catalogUri == null || catalogUri.isBlank()) {
            return MaintenanceResult.failure("Spark rewrite requires the catalog URI");
        }

        // Iceberg CALL options = every non-reserved key
        Map<String, String> rewriteOptions = new LinkedHashMap<>();
        for (var e : options.entrySet()) {
            if (!e.getKey().startsWith("__")) {
                rewriteOptions.put(e.getKey(), e.getValue());
            }
        }

        String call = buildRewriteCall(ctx.namespace(), ctx.tableName(), rewriteOptions);
        List<String> command = buildCommand(master, catalogUri, options, call);

        LOG.infof("Launching Spark rewrite on master=%s for %s.%s", master, ctx.namespace(), ctx.tableName());

        try {
            ProcessBuilder pb = new ProcessBuilder(command);
            pb.redirectErrorStream(true);
            Process process = pb.start();

            Deque<String> tail = new ArrayDeque<>();
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    tail.addLast(line);
                    if (tail.size() > 40) tail.removeFirst();
                }
            }

            boolean finished = process.waitFor(timeoutSeconds, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                return MaintenanceResult.failure("Spark rewrite timed out after " + timeoutSeconds + "s");
            }

            int exit = process.exitValue();
            String output = String.join("\n", tail);

            Map<String, Object> details = new LinkedHashMap<>();
            details.put("engine", "spark-sql");
            details.put("master", master);
            details.put("table", ctx.namespace() + "." + ctx.tableName());
            details.put("call", call);
            details.put("exitCode", exit);
            details.put("output", output);

            if (exit == 0) {
                return MaintenanceResult.success(
                        "Spark rewrite_data_files completed on " + master, details);
            }
            return new MaintenanceResult(false,
                    "Spark rewrite failed (exit " + exit + "). " + lastNonBlank(tail), details);
        } catch (java.io.IOException e) {
            return MaintenanceResult.failure(
                    "Could not launch '" + sparkSqlPath + "'. Is Spark installed and on PATH " +
                    "(or set iceguard.spark.sql-path)? Cause: " + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return MaintenanceResult.failure("Spark rewrite was interrupted");
        }
    }

    private List<String> buildCommand(String master, String catalogUri,
                                      Map<String, String> options, String call) {
        List<String> packages = new ArrayList<>();
        icebergRuntime.filter(s -> !s.isBlank()).ifPresent(packages::add);
        awsBundle.filter(s -> !s.isBlank()).ifPresent(packages::add);
        extraPackages.filter(s -> !s.isBlank()).ifPresent(packages::add);

        List<String> cmd = new ArrayList<>();
        cmd.add(sparkSqlPath);
        cmd.add("--master");
        cmd.add(master);
        if (!packages.isEmpty()) {
            cmd.add("--packages");
            cmd.add(String.join(",", packages));
        }
        addConf(cmd, "spark.sql.extensions",
                "org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions");
        addConf(cmd, "spark.sql.catalog." + catalogName, "org.apache.iceberg.spark.SparkCatalog");
        addConf(cmd, "spark.sql.catalog." + catalogName + ".type", "rest");
        addConf(cmd, "spark.sql.catalog." + catalogName + ".uri", catalogUri);

        String warehouse = options.get(OPT_CATALOG_WAREHOUSE);
        if (notBlank(warehouse)) {
            addConf(cmd, "spark.sql.catalog." + catalogName + ".warehouse", warehouse);
        }

        // S3 / MinIO — optional overrides; otherwise the REST catalog vends credentials.
        String endpoint = options.get(OPT_S3_ENDPOINT);
        if (notBlank(endpoint)) {
            addConf(cmd, "spark.sql.catalog." + catalogName + ".io-impl",
                    "org.apache.iceberg.aws.s3.S3FileIO");
            addConf(cmd, "spark.sql.catalog." + catalogName + ".s3.endpoint", endpoint);
        }
        putConfIfPresent(cmd, options, OPT_S3_ACCESS_KEY,
                "spark.sql.catalog." + catalogName + ".s3.access-key-id");
        putConfIfPresent(cmd, options, OPT_S3_SECRET_KEY,
                "spark.sql.catalog." + catalogName + ".s3.secret-access-key");
        putConfIfPresent(cmd, options, OPT_S3_PATH_STYLE,
                "spark.sql.catalog." + catalogName + ".s3.path-style-access");
        putConfIfPresent(cmd, options, OPT_S3_REGION,
                "spark.sql.catalog." + catalogName + ".client.region");

        // Extra raw Spark confs from the cluster definition.
        for (var e : options.entrySet()) {
            if (e.getKey().startsWith(OPT_CONF_PREFIX)) {
                addConf(cmd, e.getKey().substring(OPT_CONF_PREFIX.length()), e.getValue());
            }
        }

        cmd.add("-e");
        cmd.add(call);
        return cmd;
    }

    private String buildRewriteCall(String namespace, String table, Map<String, String> rewriteOptions) {
        String target = catalogName + ".`" + namespace + "`.`" + table + "`";
        StringBuilder sb = new StringBuilder("CALL ")
                .append(catalogName)
                .append(".system.rewrite_data_files(table => '")
                .append(namespace.replace("'", "''")).append(".").append(table.replace("'", "''"))
                .append("'");
        if (!rewriteOptions.isEmpty()) {
            sb.append(", options => map(");
            boolean first = true;
            for (var e : rewriteOptions.entrySet()) {
                if (!first) sb.append(", ");
                first = false;
                sb.append("'").append(e.getKey().replace("'", "''")).append("'")
                  .append(", ")
                  .append("'").append(e.getValue().replace("'", "''")).append("'");
            }
            sb.append(")");
        }
        sb.append(")");
        // `target` kept for readability/debugging; CALL uses the string identifier form.
        LOG.debugf("rewrite target=%s", target);
        return sb.toString();
    }

    private void addConf(List<String> cmd, String key, String value) {
        cmd.add("--conf");
        cmd.add(key + "=" + value);
    }

    private void putConfIfPresent(List<String> cmd, Map<String, String> options, String optKey, String confKey) {
        String v = options.get(optKey);
        if (notBlank(v)) {
            addConf(cmd, confKey, v);
        }
    }

    private boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    private String lastNonBlank(Deque<String> tail) {
        var it = tail.descendingIterator();
        while (it.hasNext()) {
            String s = it.next();
            if (s != null && !s.isBlank()) return s;
        }
        return "";
    }
}
