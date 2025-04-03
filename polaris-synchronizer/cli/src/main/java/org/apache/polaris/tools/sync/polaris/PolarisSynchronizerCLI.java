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

import picocli.CommandLine;

@CommandLine.Command(
    name = "polaris-synchronizer",
    mixinStandardHelpOptions = true,
    subcommands = {SyncPolarisCommand.class, CreateOmnipotentPrincipalCommand.class})
public class PolarisSynchronizerCLI {

  public PolarisSynchronizerCLI() {}

  public static void main(String... args) {
    CommandLine commandLine =
        new CommandLine(new PolarisSynchronizerCLI())
            .setExecutionExceptionHandler(
                (ex, cmd, parseResult) -> {
                  cmd.getErr().println(cmd.getColorScheme().richStackTraceString(ex));
                  return 1;
                });
    commandLine.setUsageHelpWidth(150);
    int exitCode = commandLine.execute(args);
    System.exit(exitCode);
  }
}
