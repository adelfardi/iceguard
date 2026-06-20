package com.iceguard.service;

import com.iceguard.dto.response.DataSampleResponse;
import com.iceguard.exception.CatalogOperationException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.apache.iceberg.AppendFiles;
import org.apache.iceberg.DataFile;
import org.apache.iceberg.PartitionSpec;
import org.apache.iceberg.Schema;
import org.apache.iceberg.Table;
import org.apache.iceberg.data.GenericRecord;
import org.apache.iceberg.data.IcebergGenerics;
import org.apache.iceberg.data.InternalRecordWrapper;
import org.apache.iceberg.data.Record;
import org.apache.iceberg.data.parquet.GenericParquetWriter;
import org.apache.iceberg.io.CloseableIterable;
import org.apache.iceberg.io.DataWriter;
import org.apache.iceberg.io.OutputFile;
import org.apache.iceberg.parquet.Parquet;
import org.apache.iceberg.types.Type;
import org.apache.iceberg.types.Types;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Reading sample rows and appending data to Iceberg tables. */
@ApplicationScoped
public class TableDataService {

    @Inject
    IcebergTableAccess access;

    public DataSampleResponse sampleData(Long catalogId, String namespace, String tableName, int limit) {
        Table table = access.loadTable(catalogId, namespace, tableName);
        try {
            Schema schema = table.schema();
            List<String> columns = schema.columns().stream()
                    .map(Types.NestedField::name)
                    .toList();

            List<Map<String, Object>> rows = new ArrayList<>();
            int count = 0;
            boolean hasMore = false;

            try (CloseableIterable<Record> records = IcebergGenerics.read(table).build()) {
                for (Record record : records) {
                    if (count >= limit) {
                        hasMore = true;
                        break;
                    }
                    Map<String, Object> row = new LinkedHashMap<>();
                    for (Types.NestedField field : schema.columns()) {
                        Object value = record.getField(field.name());
                        row.put(field.name(), value != null ? value.toString() : null);
                    }
                    rows.add(row);
                    count++;
                }
            }

            return new DataSampleResponse(columns, rows, rows.size(), hasMore);
        } catch (IOException e) {
            throw new CatalogOperationException("Failed to read sample data: " + e.getMessage(), e);
        } catch (Exception e) {
            throw new CatalogOperationException("Failed to sample data from " + namespace + "." + tableName, e);
        }
    }

    public int insertData(Long catalogId, String namespace, String tableName, List<Map<String, Object>> rows) {
        Table table = access.loadTable(catalogId, namespace, tableName);
        try {
            Schema schema = table.schema();
            PartitionSpec spec = table.spec();

            // Build records once.
            List<GenericRecord> records = new ArrayList<>(rows.size());
            for (Map<String, Object> row : rows) {
                GenericRecord record = GenericRecord.create(schema);
                for (Types.NestedField field : schema.columns()) {
                    Object value = row.get(field.name());
                    if (value != null) {
                        record.setField(field.name(), convertValue(value, field.type()));
                    }
                }
                records.add(record);
            }

            // One append commit => a single snapshot, regardless of how many files are written.
            AppendFiles append = table.newAppend();

            if (spec.isUnpartitioned()) {
                append.appendFile(writeDataFile(table, schema, spec, null, records));
            } else {
                // Group rows by their partition value; write one file per partition.
                Map<org.apache.iceberg.PartitionKey, List<GenericRecord>> groups = new LinkedHashMap<>();
                org.apache.iceberg.PartitionKey key = new org.apache.iceberg.PartitionKey(spec, schema);
                // Partition transforms operate on Iceberg's internal value representation
                // (e.g. timestamptz -> Long micros), but GenericRecord holds Java objects
                // (OffsetDateTime). Wrap each record so transforms see the internal form.
                InternalRecordWrapper wrapper = new InternalRecordWrapper(schema.asStruct());
                for (GenericRecord record : records) {
                    key.partition(wrapper.wrap(record));
                    groups.computeIfAbsent(key.copy(), k -> new ArrayList<>()).add(record);
                }
                for (var entry : groups.entrySet()) {
                    append.appendFile(writeDataFile(table, schema, spec, entry.getKey(), entry.getValue()));
                }
            }

            append.commit();
            return rows.size();
        } catch (Exception e) {
            throw new CatalogOperationException("Failed to insert data: " + e.getMessage(), e);
        }
    }

    private DataFile writeDataFile(Table table, Schema schema, PartitionSpec spec,
                                   org.apache.iceberg.PartitionKey partitionKey,
                                   List<GenericRecord> records) throws IOException {
        String prefix = partitionKey != null ? spec.partitionToPath(partitionKey) + "/" : "";
        String filepath = table.location() + "/data/" + prefix + UUID.randomUUID() + ".parquet";
        OutputFile outputFile = table.io().newOutputFile(filepath);

        DataWriter<Record> writer = Parquet.writeData(outputFile)
                .schema(schema)
                .createWriterFunc(GenericParquetWriter::buildWriter)
                .overwrite()
                .withSpec(spec)
                .withPartition(partitionKey)
                .build();
        try {
            for (GenericRecord record : records) {
                writer.write(record);
            }
        } finally {
            writer.close();
        }
        return writer.toDataFile();
    }

    private Object convertValue(Object value, Type type) {
        if (value == null) return null;
        String str = value.toString();
        return switch (type.typeId()) {
            case STRING -> str;
            case LONG -> value instanceof Number n ? n.longValue() : Long.parseLong(str);
            case INTEGER -> value instanceof Number n ? n.intValue() : Integer.parseInt(str);
            case DOUBLE -> value instanceof Number n ? n.doubleValue() : Double.parseDouble(str);
            case FLOAT -> value instanceof Number n ? n.floatValue() : Float.parseFloat(str);
            case BOOLEAN -> value instanceof Boolean b ? b : Boolean.parseBoolean(str);
            // Iceberg's generic record model holds a DATE as a LocalDate (it converts to the
            // epoch-day int at write time); handing it a raw int throws ClassCastException.
            case DATE -> LocalDate.parse(str);
            case TIMESTAMP -> {
                if (value instanceof OffsetDateTime odt) {
                    yield odt;
                }
                yield OffsetDateTime.parse(str);
            }
            case DECIMAL -> new BigDecimal(str);
            default -> str;
        };
    }
}
