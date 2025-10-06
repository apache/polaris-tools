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
package org.apache.polaris.iceberg.catalog.migrator.cli;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Collections;
import java.util.Map;
import org.apache.iceberg.hive.HiveMetastoreExtension;
import org.apache.polaris.iceberg.catalog.migrator.api.CatalogMigrationUtil;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.extension.RegisterExtension;

@Disabled("Because of https://github.com/apache/polaris/issues/2756")
public class ITHiveToPolarisCLIMigrationTest extends AbstractCLIMigrationTest {

  @RegisterExtension
  public static final HiveMetastoreExtension HIVE_METASTORE_EXTENSION =
      HiveMetastoreExtension.builder().build();

  private static PolarisContainer polarisContainer;

  @BeforeAll
  protected static void setup() throws Exception {
    polarisContainer = new PolarisContainer(sourceCatalogWarehouse);
    polarisContainer.start();
    assertThat(polarisContainer.httpGet("/api/management/v1/catalogs"))
        .contains(PolarisContainer.CATALOG_NAME);

    initializeSourceCatalog(
        CatalogMigrationUtil.CatalogType.HIVE,
        Collections.singletonMap(
            "uri", HIVE_METASTORE_EXTENSION.hiveConf().get("hive.metastore.uris")));

    initializeTargetCatalog(
        CatalogMigrationUtil.CatalogType.REST,
        Map.of(
            "uri",
            polarisContainer.getIcebergApiEndpoint(),
            "warehouse",
            PolarisContainer.CATALOG_NAME,
            "token",
            polarisContainer.getAccessToken(
                polarisContainer.getClientId(), polarisContainer.getClientSecret())));
  }

  @AfterAll
  protected static void tearDown() throws Exception {
    dropNamespaces();
    if (polarisContainer != null) {
      polarisContainer.stop();
    }
  }
}
