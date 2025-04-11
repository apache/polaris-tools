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
package org.apache.polaris.tools.sync.polaris.catalog;

import java.util.NoSuchElementException;
import org.apache.iceberg.TableMetadata;
import org.apache.iceberg.TableOperations;
import org.apache.iceberg.io.FileIO;
import org.apache.iceberg.io.LocationProvider;

/**
 * Wrapper table operations class that just allows fetching a provided table metadata. Used to build
 * a {@link org.apache.iceberg.BaseTable} without having to expose a full-fledged operations class.
 */
public class MetadataWrapperTableOperations implements TableOperations {

  private final TableMetadata tableMetadata;

  public MetadataWrapperTableOperations(TableMetadata tableMetadata) {
    this.tableMetadata = tableMetadata;
  }

  @Override
  public TableMetadata current() {
    return this.tableMetadata;
  }

  @Override
  public TableMetadata refresh() {
    return this.tableMetadata;
  }

  @Override
  public void commit(TableMetadata tableMetadata, TableMetadata tableMetadata1) {
    throw new UnsupportedOperationException("Cannot perform commit.");
  }

  @Override
  public FileIO io() {
    throw new NoSuchElementException("Does not possess file io.");
  }

  @Override
  public String metadataFileLocation(String s) {
    return this.tableMetadata.metadataFileLocation();
  }

  @Override
  public LocationProvider locationProvider() {
    throw new NoSuchElementException("Does not possess location provider.");
  }
}
