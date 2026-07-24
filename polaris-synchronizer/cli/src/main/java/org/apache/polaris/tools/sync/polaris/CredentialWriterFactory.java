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
import java.util.ServiceLoader;

/**
 * Factory class to construct configurable, pre-configured {@link CredentialWriter} instances.
 */
public class CredentialWriterFactory {

    /**
     * Property that identifies which {@link ServiceLoader}-discovered {@link CredentialWriter}
     * implementation to use for the {@link Type#CUSTOM} type, matched against
     * {@link CredentialWriter#getClass()}'s fully-qualified classname.
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
     * Construct a new, pre-configured {@link CredentialWriter} instance.
     * @param type the recognized type of the {@link CredentialWriter} to construct
     * @param properties properties to use when constructing the {@link CredentialWriter}
     * @return the constructed and ready-to-use {@link CredentialWriter}
     */
    public static CredentialWriter createCredentialWriter(Type type, Map<String, String> properties) {
        try {
            properties = properties == null ? new HashMap<>() : properties;

            return switch (type) {
                case CONSOLE -> new ConsoleCredentialWriter();
                case FILE -> new JsonFileCredentialWriter(properties);
                case CUSTOM -> loadCustomCredentialWriter(properties);
            };
        } catch (Exception e) {
            throw new RuntimeException("Failed to construct CredentialWriter", e);
        }
    }

    /**
     * Discovers a {@link CredentialWriter} implementation on the classpath via {@link ServiceLoader},
     * matching the classname supplied via {@link #CUSTOM_CLASS_NAME_PROPERTY}. Custom implementations
     * must be registered as a service provider (i.e. declared in a
     * {@code META-INF/services/org.apache.polaris.tools.sync.polaris.access.CredentialWriter} file)
     * for {@link ServiceLoader} to discover them.
     */
    private static CredentialWriter loadCustomCredentialWriter(Map<String, String> properties) {
        String customWriterClassname = properties.get(CUSTOM_CLASS_NAME_PROPERTY);

        if (customWriterClassname == null) {
            throw new IllegalArgumentException("Missing required property " + CUSTOM_CLASS_NAME_PROPERTY);
        }

        return ServiceLoader.load(CredentialWriter.class).stream()
                .filter(provider -> provider.type().getName().equals(customWriterClassname))
                .findFirst()
                .map(ServiceLoader.Provider::get)
                .orElseThrow(() -> new IllegalArgumentException(
                        "No CredentialWriter service provider found for classname '" + customWriterClassname
                                + "'. Ensure it is registered as a service provider under META-INF/services/"
                                + CredentialWriter.class.getName()));
    }

}
