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

import org.apache.polaris.tools.sync.polaris.catalog.NoOpETagManager;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

import java.util.Map;

public class ETagManagerFactoryTest {

    @Test
    public void constructCsvManagerSuccessfully() {
        // Pass correct properties for default file etag manager
        ETagManagerFactory.createETagManager(
                ETagManagerFactory.Type.FILE, Map.of(CsvETagManager.CSV_FILE_PROPERTY, "test.csv"));
    }

    @Test
    public void failToConstructCsvManager() {
        // omit properties for default file etag manager
        Assertions.assertThrows(Exception.class, () ->
                ETagManagerFactory.createETagManager(ETagManagerFactory.Type.FILE, Map.of()));
    }

    @Test
    public void constructCustomETagManagerSuccessfully() {
        // correctly construct custom manager by passing classname
        ETagManagerFactory.createETagManager(
                ETagManagerFactory.Type.CUSTOM,
                Map.of(ETagManagerFactory.CUSTOM_CLASS_NAME_PROPERTY, NoOpETagManager.class.getName()) // use a recognized one for now
        );
    }

    @Test
    public void failToConstructCustomETagManager() {
        // fail to construct custom etag manager by omitting custom classname from config
        Assertions.assertThrows(Exception.class, () ->
            ETagManagerFactory.createETagManager(ETagManagerFactory.Type.CUSTOM, Map.of()));
    }

}
