package com.iceguard.model;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Global Spark session tuning (singleton row). Applied as {@code --conf} entries to every Spark
 * maintenance run; a Spark cluster's own properties override these.
 */
@Entity
@Table(name = "spark_settings")
public class SparkSettings extends PanacheEntity {

    /** {@code spark.driver.memory}, e.g. "1g". */
    @Column(name = "driver_memory", length = 64)
    public String driverMemory;

    /** {@code spark.executor.memory}, e.g. "2g". */
    @Column(name = "executor_memory", length = 64)
    public String executorMemory;

    /** {@code spark.executor.cores}. */
    @Column(name = "executor_cores")
    public Integer executorCores;

    /** {@code spark.executor.instances}. */
    @Column(name = "executor_instances")
    public Integer executorInstances;

    /** Free-form extra Spark confs as JSON, applied as {@code --conf key=value}. */
    @Column(name = "extra_conf", columnDefinition = "text")
    public String extraConf = "{}";

    @Column(name = "updated_at")
    public Instant updatedAt;
}
