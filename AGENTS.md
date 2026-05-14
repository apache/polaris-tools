<!--
  Licensed to the Apache Software Foundation (ASF) under one
  or more contributor license agreements.  See the NOTICE file
  distributed with this work for additional information
  regarding copyright ownership.  The ASF licenses this file
  to you under the Apache License, Version 2.0 (the
  "License"); you may not use this file except in compliance
  with the License.  You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing,
  software distributed under the License is distributed on an
  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
  KIND, either express or implied.  See the License for the
  specific language governing permissions and limitations
  under the License.
-->

# Apache Polaris Tools - Agent Guidelines

Rules for AI coding agents contributing to Apache Polaris. Human contributors may
also find these useful, but the primary audience is automated agents (Claude Code,
Codex, Cursor, Copilot, and others).

A human author is responsible for every change an agent produces. See
[CONTRIBUTING.md](CONTRIBUTING.md#guidelines-for-ai-assisted-contributions) for the
full AI-assisted contribution policy.

## Understand The Tool First

This repository contains multiple tools with different users, deployment models,
and security boundaries. Before changing or reviewing a tool, read the tool's
`README.md`, relevant source, tests, build files, and
[`SECURITY-THREAT-MODEL.md`](SECURITY-THREAT-MODEL.md).

Do not apply Polaris server assumptions blindly to tools. A browser UI, MCP
server, migration CLI, synchronizer, benchmark, and test apprunner have different
entry points, protected assets, and trust boundaries.

## Scope Discipline

Keep changes scoped to the requested tool or shared module. Do not reformat or
refactor unrelated subprojects. If a finding or fix spans multiple tools, state
which tool boundaries are affected and why.

## Build And Verification

Use the verification command for the subproject you changed. Prefer the
subproject's own `README.md`, `Makefile`, Gradle wrapper, npm scripts, `uv`
commands, or other local build instructions.

The root `Makefile` exposes convenience targets for some subprojects:

```bash
make help
```

Use those targets only when they cover the subproject you touched and delegate
to the same local checks.

Examples of possible checks:

```bash
make console-lint
make console-build
make mcp-test
make mcp-lint
./benchmarks/gradlew -p benchmarks check
./iceberg-catalog-migrator/gradlew -p iceberg-catalog-migrator check
./polaris-synchronizer/gradlew -p polaris-synchronizer check
./apprunner/gradlew -p apprunner check
```

If you cannot run a relevant check, say which check was skipped and why.

## Security Issues

Before reporting or fixing security issues, read
[`SECURITY-THREAT-MODEL.md`](SECURITY-THREAT-MODEL.md). Use it to determine
whether a finding crosses a tool security boundary, which actor can exploit it,
what protected asset is affected, and whether the issue is a tool vulnerability,
a deployment responsibility, a dependency issue, documentation hardening, or a
false positive.

Use `SECURITY.md` and the public
[Polaris security reporting page](https://polaris.apache.org/community/security-report/)
for reporting process, disclosure handling, and where suspected vulnerabilities
should be sent. The public security reporting page also lists previously
published advisories and CVEs; treat those as public historical examples of issue
classes, not as substitutes for the threat model's boundaries and invariants.

For dependency-related findings, check whether the vulnerable behavior is
present in the affected tool, reachable through documented or realistic tool
usage, affects a tool security boundary or protected asset, and whether the
upstream project's security policy or disclosure process applies.

For package, artifact, configuration, or downstream-integration findings,
identify the exact source revision, package, artifact, build mode, runtime
configuration, deployment model, and documented usage before assessing
reachability, supported status, severity, or whether the issue belongs to
Polaris Tools or downstream integration code.

For findings involving a specific tool, identify the affected subproject,
intended audience, deployment model, exposed interface, protected assets, and
trust boundaries before assessing impact. Browser UIs, CLIs, migration tools,
synchronizers, MCP servers, benchmarks, and test helpers have different security
models.

For findings involving credentials, tokens, local profiles, `.env` files,
browser storage, command output, logs, reports, generated artifacts, source and
target catalogs, MCP tool input, externally configured endpoints, or copied
examples, classify the protected asset and trust boundary using
`SECURITY-THREAT-MODEL.md` before deciding whether the behavior is a tool
vulnerability, deployment responsibility, upstream issue, documentation
hardening, or false positive.

For findings involving Polaris server behavior, distinguish between a
vulnerability in the Polaris server and a vulnerability in how a tool exposes,
amplifies, configures, or depends on that server behavior. A tool finding is not
automatically a Polaris server vulnerability.

Report security-relevant documentation issues separately from vulnerabilities
when unclear docs, examples, defaults, generated references, or missing warnings
could reasonably lead users to unsafe deployment, credential handling, browser
security, migration, synchronization, MCP exposure, benchmark usage, or
operational choices.

Use ASF security guidance for process and classification; do not infer advisory
or CVE status from `SECURITY-THREAT-MODEL.md` alone.

When reporting potential findings, label ASF severity, proof status, and
CVE/advisory status as non-authoritative triage estimates.

Do not treat a test, mock, fixture, sample config, or local-development default
as proof of a vulnerability unless it demonstrates a real boundary crossing by
the stated actor without already-authorized access, privileged fixtures, mocked
trust decisions, or protected information.

Avoid over-reporting findings that are only security-adjacent and lack a
realistic path to impact or realistic user misunderstanding.

Do not include private vulnerability details, exploit payloads, reporter names,
private mailing-list content, secrets, or non-public infrastructure details in
code, comments, tests, documentation, commit messages, or PR descriptions.
