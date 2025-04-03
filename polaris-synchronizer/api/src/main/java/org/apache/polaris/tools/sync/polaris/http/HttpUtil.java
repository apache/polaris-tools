/*
 * Copyright (C) 2025 Dremio
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package org.apache.polaris.tools.sync.polaris.http;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.stream.Collectors;

/** Encapsulates handy http utility methods. */
public class HttpUtil {

    /** Turn a {@link Map <String, String>} into an xxx-url-form-encoded compatible String form body */
    public static String constructFormEncodedString(Map<String, String> parameters) {
        return parameters.entrySet().stream()
                .map(
                        entry ->
                                URLEncoder.encode(entry.getKey(), StandardCharsets.UTF_8)
                                        + "="
                                        + URLEncoder.encode(entry.getValue(), StandardCharsets.UTF_8))
                .collect(Collectors.joining("&"));
    }
}
