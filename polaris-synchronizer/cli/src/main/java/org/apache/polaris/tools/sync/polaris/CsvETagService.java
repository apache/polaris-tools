/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
package org.apache.polaris.tools.sync.polaris;

import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;
import org.apache.iceberg.catalog.TableIdentifier;
import org.apache.polaris.tools.sync.polaris.catalog.ETagService;

import java.io.BufferedWriter;
import java.io.Closeable;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.util.HashMap;
import java.util.Map;

import static java.nio.charset.StandardCharsets.UTF_8;

/** Implementation that stores/loads ETags to/from a CSV file. */
public class CsvETagService implements ETagService, Closeable {

  private static final String CATALOG_HEADER = "Catalog";

  private static final String TABLE_ID_HEADER = "TableIdentifier";

  private static final String ETAG_HEADER = "ETag";

  private static final String[] HEADERS = {CATALOG_HEADER, TABLE_ID_HEADER, ETAG_HEADER};

  private final File file;

  private final Map<String, Map<TableIdentifier, String>> tablesByCatalogName;

  public CsvETagService(File file) throws IOException {
    this.tablesByCatalogName = new HashMap<>();
    this.file = file;

    if (file.exists()) {
      CSVFormat readerCSVFormat =
          CSVFormat.DEFAULT.builder().setHeader(HEADERS).setSkipHeaderRecord(true).get();

      CSVParser parser =
          CSVParser.parse(Files.newBufferedReader(file.toPath(), UTF_8), readerCSVFormat);

      for (CSVRecord record : parser.getRecords()) {
        this.tablesByCatalogName.putIfAbsent(record.get(CATALOG_HEADER), new HashMap<>());

        TableIdentifier tableId = TableIdentifier.parse(record.get(TABLE_ID_HEADER));

        this.tablesByCatalogName
            .get(record.get(CATALOG_HEADER))
            .put(tableId, record.get(ETAG_HEADER));
      }

      parser.close();
    }
  }

  @Override
  public String getETag(String catalogName, TableIdentifier tableIdentifier) {
    if (tablesByCatalogName.get(catalogName) != null) {
      return tablesByCatalogName
          .get(catalogName)
          .get(tableIdentifier); // will return null anyway if table id not available
    }
    return null;
  }

  @Override
  public void storeETag(String catalogName, TableIdentifier tableIdentifier, String etag) {
    this.tablesByCatalogName.putIfAbsent(catalogName, new HashMap<>());
    this.tablesByCatalogName.get(catalogName).put(tableIdentifier, etag);
  }

  @Override
  public void close() throws IOException {
    BufferedWriter writer = Files.newBufferedWriter(file.toPath(), UTF_8);

    writer.write(""); // clear file

    CSVFormat csvFormat = CSVFormat.DEFAULT.builder().setHeader(HEADERS).get();

    CSVPrinter printer = new CSVPrinter(writer, csvFormat);

    // write etags to file
    tablesByCatalogName.forEach(
        (catalogName, etagsByTable) -> {
          etagsByTable.forEach(
              (tableIdentifier, etag) -> {
                try {
                  printer.printRecord(catalogName, tableIdentifier.toString(), etag);
                } catch (IOException e) {
                  throw new RuntimeException(e);
                }
              });
        });

    printer.flush();
    printer.close();
  }
}
