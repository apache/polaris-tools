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

import org.apache.iceberg.BaseTable;
import org.apache.iceberg.TableOperations;
import org.apache.iceberg.metrics.MetricsReporter;

/**
 * Wrapper around {@link BaseTable} that contains the latest ETag for the table.
 */
public class BaseTableWithETag extends BaseTable {

    private final String eTag;

    public BaseTableWithETag(TableOperations ops, String name, String eTag) {
        super(ops, name);
        this.eTag = eTag;
    }

    public BaseTableWithETag(TableOperations ops, String name, MetricsReporter reporter, String eTag) {
        super(ops, name, reporter);
        this.eTag = eTag;
    }

    public String eTag() {
        return eTag;
    }

}
