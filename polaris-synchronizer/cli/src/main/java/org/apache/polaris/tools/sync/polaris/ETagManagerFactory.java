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

import org.apache.polaris.tools.sync.polaris.catalog.ETagManager;
import org.apache.polaris.tools.sync.polaris.catalog.NoOpETagManager;

import java.util.HashMap;
import java.util.Map;

/**
 * Factory class to construct configurable {@link ETagManager} implementations.
 */
public class ETagManagerFactory {

    /**
     * Property that will hold class name for custom {@link ETagManager} implementation.
     */
    public static final String CUSTOM_CLASS_NAME_PROPERTY = "custom-impl";

    private ETagManagerFactory() {}

    /**
     * Recognized types of {@link ETagManager} implementations
     */
    public enum Type {
        NONE,
        FILE,
        CUSTOM
    }

    /**
     * Construct a new {@link ETagManager} instance.
     * @param type the recognized type of the {@link ETagManager} to construct
     * @param properties properties to use when initializing the {@link ETagManager}
     * @return the constructed and initialized {@link ETagManager}
     */
    public static ETagManager createETagManager(Type type, Map<String, String> properties) {
        try {
            properties = properties == null ? new HashMap<>() : properties;

            ETagManager manager = switch (type) {
                case NONE -> new NoOpETagManager();
                case FILE -> new CsvETagManager();
                case CUSTOM -> {
                    String customManagerClassname = properties.get(CUSTOM_CLASS_NAME_PROPERTY);

                    if (customManagerClassname == null) {
                        throw new IllegalArgumentException("Missing required property " + CUSTOM_CLASS_NAME_PROPERTY);
                    }

                    Object custom = Class.forName(customManagerClassname).getDeclaredConstructor().newInstance();

                    if (custom instanceof ETagManager customManager) {
                        yield customManager;
                    }

                    throw new InstantiationException("Custom ETagManager '" + customManagerClassname + "' does not implement ETagManager");
                }
            };

            manager.initialize(properties);
            return manager;
        } catch (Exception e) {
            throw new RuntimeException("Failed to construct ETagManager", e);
        }
    }

}
