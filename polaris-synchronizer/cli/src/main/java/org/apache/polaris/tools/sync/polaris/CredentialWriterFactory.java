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

import org.apache.polaris.tools.sync.polaris.access.CredentialWriter;

import java.util.HashMap;
import java.util.Map;

/**
 * Factory class to construct configurable {@link CredentialWriter} implementations.
 */
public class CredentialWriterFactory {

    /**
     * Property that will hold class name for custom {@link CredentialWriter} implementation.
     */
    public static final String CUSTOM_CLASS_NAME_PROPERTY = "custom-impl";

    private CredentialWriterFactory() {}

    /**
     * Recognized types of {@link CredentialWriter} implementations
     */
    public enum Type {
        CONSOLE,
        FILE,
        CUSTOM
    }

    /**
     * Construct a new {@link CredentialWriter} instance.
     * @param type the recognized type of the {@link CredentialWriter} to construct
     * @param properties properties to use when initializing the {@link CredentialWriter}
     * @return the constructed and initialized {@link CredentialWriter}
     */
    public static CredentialWriter createCredentialWriter(Type type, Map<String, String> properties) {
        try {
            properties = properties == null ? new HashMap<>() : properties;

            CredentialWriter writer = switch (type) {
                case CONSOLE -> new ConsoleCredentialWriter();
                case FILE -> new JsonFileCredentialWriter();
                case CUSTOM -> {
                    String customWriterClassname = properties.get(CUSTOM_CLASS_NAME_PROPERTY);

                    if (customWriterClassname == null) {
                        throw new IllegalArgumentException("Missing required property " + CUSTOM_CLASS_NAME_PROPERTY);
                    }

                    Object custom = Class.forName(customWriterClassname).getDeclaredConstructor().newInstance();

                    if (custom instanceof CredentialWriter customWriter) {
                        yield customWriter;
                    }

                    throw new InstantiationException("Custom CredentialWriter '" + customWriterClassname + "' does not implement CredentialWriter");
                }
            };

            writer.initialize(properties);
            return writer;
        } catch (Exception e) {
            throw new RuntimeException("Failed to construct CredentialWriter", e);
        }
    }

}
