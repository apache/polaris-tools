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

# Apache Polaris Tools Threat Model

## Purpose

This document defines security boundaries for tools maintained in the Apache
Polaris Tools repository. It is intended to guide maintainers, security
reviewers, and automated analysis tools when evaluating potential vulnerabilities
or security-relevant hardening work.

This document is guidance for analysis and triage. It does not make policy
decisions, accept or reject vulnerability reports, assign ASF severity, allocate
CVEs, or determine disclosure handling. Human project and ASF security review is
required for those decisions.

## Scope

This repository contains multiple tools with different audiences, deployment
models, interfaces, and protected assets. A finding must be evaluated against
the specific tool and configuration involved.

This threat model covers:

- Polaris Console UI under `console/`.
- Iceberg Catalog Migrator under `iceberg-catalog-migrator/`.
- Polaris Synchronizer under `polaris-synchronizer/`.
- Polaris MCP Server under `mcp-server/`.
- Polaris Benchmarks under `benchmarks/`.
- Polaris Apprunner Gradle and Maven plugins under `apprunner/`.
- Shared build, packaging, configuration, documentation, generated artifacts,
  and examples when they affect tool security.

This threat model does not cover:

- Vulnerabilities in Apache Polaris server itself, except where a tool exposes,
  amplifies, or depends on the server behavior.
- Compromise of the host, browser, CI system, Kubernetes cluster, object store,
  database, identity provider, external catalog, or network infrastructure.
- Downstream-only modifications, private packaging, local patches, or custom
  integrations unless they indicate a weakness in released tool code,
  documented guidance, examples, or reusable modules.
- Benchmark-only, test-only, or local-development behavior unless it is
  documented for non-test use, handles real protected assets, or is likely to be
  copied into production.

The tools in this repository are independent projects for threat-model purposes.
Do not assume that behavior, configuration, dependencies, deployment model,
release status, versioning, or security expectations in one tool apply to
another tool. A finding should name the affected tool or tools and explain why
each one is affected. Shared build logic, shared examples, shared documentation,
or shared dependencies may affect multiple tools, but that relationship must be
shown explicitly.

Some tools may be independently released, released on different schedules, or
not released as standalone artifacts. Before assessing reachability, severity,
or advisory scope, identify the affected tool's release status, published
artifact, package version, source revision, and documented deployment model.

## Component Families

| Component family | Representative entry points | Deployment model | Threat-model scope |
| --- | --- | --- | --- |
| Console UI | Browser application, API client, OIDC flow, local/browser storage, container and Helm assets | User-facing or operator-facing web UI | Browser, session, token, origin, rendering, API-call, CORS, and deployment-boundary security. |
| Iceberg Catalog Migrator | CLI commands, catalog configuration, source and target catalog APIs, logs | Operator migration tool | Source-to-target migration integrity, credentials, metadata handling, filesystem/config handling, and destructive operation safety. |
| Polaris Synchronizer | CLI commands, source and target Polaris APIs, generated credentials, logs | Operator migration, backup, or synchronization tool | Polaris entity migration, principal and role handling, credential output, source-to-target trust, and partial-failure behavior. |
| MCP Server | MCP tools over stdio or network transport, Polaris REST wrapper, environment/config files | Local agent integration or exposed MCP service | MCP client-to-server trust, tool invocation authorization, data exposure, prompt/tool input handling, and credential handling. |
| Benchmarks | Gatling simulations, benchmark configuration, generated datasets and reports | Developer, performance, or test tool | Safe handling of benchmark credentials, generated datasets, logs, reports, and accidental production use. |
| Apprunner | Gradle and Maven plugins, test JVM system properties, spawned Polaris process | Integration-test helper | Test process scope, interface, lifetime, cleanup, and safe handling of test credentials/configuration. |

## Actors And Roles

- Anonymous browser user: A user without a valid session or token accessing a
  browser-exposed tool.
- Authenticated tool user: A user or operator authenticated to the tool or to the
  Polaris server through the tool.
- Tool operator: A person or automation that configures, runs, deploys, or
  upgrades a tool.
- Migration operator: A user running migrator or synchronizer commands with
  credentials for source and target systems.
- MCP client or agent: A client that can invoke MCP tools and supply structured
  tool input.
- Benchmark user: A developer or operator running benchmark workloads against a
  Polaris deployment.
- Build or test runner: A local, CI, Gradle, Maven, npm, uv, or container build
  environment executing tool code.
- External system: Polaris server, Iceberg REST catalog, object store, identity
  provider, policy service, source catalog, target catalog, browser, filesystem,
  container platform, or network endpoint.

## Protected Assets

The tools may handle the following security-sensitive assets:

- Polaris access tokens, bearer tokens, client IDs, client secrets, OIDC tokens,
  refresh tokens, and generated principal credentials.
- Catalog, namespace, table, view, role, principal, policy, grant, and migration
  metadata.
- Source and target catalog configuration, endpoints, TLS settings, realm
  settings, CORS settings, and identity-provider settings.
- Storage locations, table locations, metadata locations, and other
  URI-bearing metadata.
- Browser session state, local storage, cookies, redirect URIs, origin data, and
  rendered user-controlled content.
- MCP tool inputs, tool outputs, prompts, model-visible data, logs, and
  transport configuration.
- Local profiles, `.env` files, config files, generated artifacts, benchmark
  reports, migration logs, backup outputs, and build artifacts.
- Source catalog data, target catalog data, migration state, synchronization
  state, and failure reports.

## Trust Boundaries

The tools introduce trust boundaries that differ by component:

- Browser to Console UI.
- Console UI to Polaris server API.
- OIDC identity provider to Console UI and Polaris server.
- CLI local process to source and target catalog APIs.
- Local configuration, environment variables, `.env` files, and profiles to tool
  runtime.
- Migration or synchronization source catalog to target catalog.
- Tool process to filesystem, logs, generated artifacts, and command output.
- MCP client or agent to MCP server.
- MCP server to Polaris server API.
- Benchmark or apprunner process to local or remote Polaris deployment.
- Build, CI, container, Helm, package, or test environment to released artifacts.

Tool inputs are untrusted unless they come from a trusted local operator or a
validated upstream trust relationship. A local operator may be trusted for the
machine they control, but the tool must still avoid accidental disclosure,
unsafe defaults, and surprising cross-boundary behavior when handling protected
assets.

## Security Invariants

The following properties must hold when a tool handles protected assets:

- Tokens, client secrets, generated credentials, and other secrets must not be
  logged, rendered, stored, cached, or emitted to generated artifacts unless the
  behavior is explicit, necessary, and documented for the operator.
- Browser-facing code must protect tokens, sessions, redirects, origins, and
  rendered user-controlled content according to the deployment model.
- Tool configuration must not silently redirect credentials, tokens, catalog
  metadata, storage requests, or migration traffic to an unintended endpoint.
- Migration and synchronization tools must keep source and target systems
  distinct and must not confuse credentials, endpoints, realms, catalog scopes,
  or destructive operations.
- Tools that create, reset, rotate, or display credentials must make the output
  and operational responsibility clear and must not expose those values to
  unauthorized users.
- MCP tools must not expose data or actions to an MCP client beyond what the
  configured Polaris credentials and intended tool surface allow.
- Benchmarks and test helpers must not be treated as production-safe defaults
  unless that use is explicitly documented and protected.
- Generated logs, reports, profiles, test output, and build artifacts must be
  treated as potentially sensitive when they include credentials, tokens,
  endpoints, catalog metadata, storage locations, or migration state.
- Dependency, browser, Python, Java, Node, container, and build-tool findings
  must be evaluated for reachability through the affected tool and deployment
  model.

## Tool-Specific Boundaries

### Console UI

The Console UI is a browser-based tool that calls the Polaris server API. Review
findings against browser and web-application boundaries, including:

- OIDC authorization-code and PKCE flow configuration.
- Token handling in memory, browser storage, logs, and API clients.
- Redirect URI, issuer, realm, scope, CORS, origin, and API endpoint handling.
- Cross-site scripting, output encoding, route handling, dependency exposure,
  and rendering of catalog or metadata values.
- Container, Helm, and environment configuration that can affect browser
  security or Polaris API access.

A Console finding may be a Polaris Tools security issue when it exposes tokens,
credentials, catalog metadata, privileged API access, user sessions, or unsafe
browser behavior in documented or reachable deployments.

### Iceberg Catalog Migrator

The Iceberg Catalog Migrator moves or registers Iceberg tables across catalogs.
Review findings against source-to-target catalog boundaries, including:

- Source and target catalog credentials, endpoints, TLS settings, and
  configuration parsing.
- Destructive or integrity-sensitive operations such as migration, registration,
  deletion from the source catalog, partial failure, retries, and idempotency.
- Table metadata, storage locations, namespace selection, logs, local files, and
  generated reports.
- Behavior when the same table remains reachable from more than one catalog.
- Concurrent commits or in-progress source catalog changes during migration.

A migrator finding may be a security issue when it lets an unauthorized actor
read, mutate, corrupt, misroute, or disclose catalog metadata, credentials, or
storage locations across the source-to-target boundary.

### Polaris Synchronizer

The Polaris Synchronizer migrates or synchronizes Polaris-specific entities and
Iceberg entities between Polaris instances. Review findings against both source
and target Polaris boundaries, including:

- Source and target credentials, realms, endpoints, scopes, and generated
  principal credentials.
- Principal, principal-role, catalog-role, grant, catalog, namespace, and table
  migration.
- Credential reset or output behavior, especially when syncing principals.
- Partial failures, retry behavior, idempotency, backup-style usage, and
  repeated synchronization.
- Logs, stdout, local configuration, and generated artifacts that may contain
  credentials or migration state.

A synchronizer finding may be a security issue when it grants broader access
than intended, exposes generated credentials, confuses source and target
authority, or corrupts authorization-relevant metadata.

### MCP Server

The MCP Server wraps Polaris REST APIs for MCP-compatible clients. Review
findings against MCP client-to-server and MCP server-to-Polaris boundaries,
including:

- Which MCP clients or agents can invoke tools.
- Which Polaris credentials, tokens, scopes, realms, and base URLs are used by
  the server.
- Tool input validation, operation allowlists, path construction, output
  filtering, prompt/tool injection risks, and model-visible data.
- Transport mode, local stdio usage, network exposure, environment variables,
  `.env` files, and client configuration.
- Logs, exceptions, structured tool output, and error messages.

An MCP finding may be a security issue when a client can invoke unintended
Polaris operations, obtain data beyond the configured credentials and intended
tool surface, redirect credentials, or cause sensitive data to be exposed to an
unauthorized client or model context.

### Benchmarks

Benchmarks are performance and test tools. Review findings according to their
documented development, performance, or test usage, including:

- Benchmark credentials, tokens, endpoints, generated datasets, storage
  locations, reports, and logs.
- Whether a benchmark connects to a local test deployment or a non-test Polaris
  deployment.
- Whether generated config, reports, or example settings are likely to be copied
  into production.
- Workloads that create, update, or commit metadata at high volume.

A benchmark finding is usually not a production Polaris vulnerability by itself.
It may still be security-relevant when benchmark code handles real credentials,
connects to non-test deployments, exposes services, emits sensitive artifacts,
or documents unsafe production-like usage.

### Apprunner

Apprunner is a Gradle and Maven integration-test helper that starts Polaris
processes for tests. Review findings according to local and CI test boundaries,
including:

- Whether the started Polaris process is limited to the intended test scope,
  interface, lifetime, and test configuration.
- Test JVM system properties and generated URLs.
- Test credentials, config files, logs, and build artifacts.
- Behavior when used outside tests or copied into downstream projects.

Starting a Polaris process and opening HTTP or management ports for the scoped
test task is intended Apprunner behavior and is not a vulnerability by itself. A
finding should show unintended exposure, leakage, persistence after the test,
cross-test interference, unsafe copied configuration, or another boundary
crossing.

An apprunner finding is usually test-tool or build-tool scoped. It may still be
security-relevant when it exposes protected test deployments, leaks credentials,
or encourages unsafe copied configuration.

## Non-Issues And Deployment Responsibilities

The following are not normally treated as Polaris Tools vulnerabilities by
themselves:

- A local operator choosing weak credentials, unsafe endpoints, or broad network
  exposure despite documentation.
- A compromised workstation, browser, CI system, container platform, host,
  source catalog, target catalog, Polaris server, identity provider, or object
  store.
- Information visible to a user or tool that is explicitly authorized to access
  it.
- Behavior reachable only through test-only code, benchmark-only code, local
  development defaults, or example configuration that is not used in documented
  non-test paths.
- A dependency advisory that is not present in a released or documented tool,
  not reachable through the tool, or not used for a security decision.

Operators and downstream integrators are responsible for:

- Protecting local configuration, `.env` files, profiles, logs, reports,
  generated credentials, backups, and migration artifacts.
- Configuring TLS, CORS, OIDC, Polaris API endpoints, source and target catalog
  endpoints, object-store access, and network exposure safely.
- Separating source and target credentials, realms, catalogs, and storage
  locations for migration and synchronization tools.
- Treating benchmark, test, and sample configuration as non-production unless
  explicitly reviewed and protected for production-like use.

The following patterns often require careful triage because they can be
vulnerabilities, documentation hardening items, deployment responsibilities, or
false positives depending on the actor, tool, configuration, and reachable path:

- Treating local profiles, browser storage, command output, logs, generated
  reports, benchmark output, or migration artifacts as secret stores.
- Assuming a developer-only, benchmark-only, or test-only tool has the same
  security properties as a production service or operator tool.
- Treating a mocked MCP client, local test fixture, direct internal object
  construction, or already-authorized credential as proof of a vulnerability.
- Reporting a dependency advisory without showing that the vulnerable behavior
  is present, reachable, and crosses a tool trust boundary.
- Applying Polaris server threat-model assumptions without first classifying the
  tool's audience, deployment model, interface, protected assets, and trust
  boundaries.

## Security Issues

The following should generally be treated as potential security vulnerabilities
when reachable through a documented or realistic tool deployment:

- Exposure of tokens, client secrets, generated credentials, OIDC artifacts, or
  sensitive configuration.
- Unauthorized access to or mutation of Polaris, Iceberg catalog, source
  catalog, target catalog, role, principal, grant, table, namespace, or migration
  metadata.
- Confusion between source and target systems, realms, catalogs, credentials, or
  destructive operations.
- Browser security issues in Console that expose sessions, tokens, privileged
  API access, or protected metadata.
- MCP tool invocation issues that expose unintended data or actions to a client
  or model context.
- Unsafe handling of externally configured endpoints that can redirect
  credentials, tokens, metadata, migration traffic, or API requests outside the
  intended trust relationship.
- Logging, printing, storing, or generating artifacts containing secrets or
  sensitive migration state without clear operator intent.
- Injection, path traversal, command execution, unsafe deserialization, unsafe
  template/rendering behavior, or server-side request forgery reachable through
  untrusted tool input.

## Guidance For Automated Analysis

When evaluating a potential finding:

1. Identify the exact tool, source revision, artifact, package, and
   configuration.
2. Identify the intended audience and deployment model for that tool.
3. Identify the exposed interface and actor required to exploit the issue.
4. Identify the protected asset and trust boundary crossed.
5. Identify whether the behavior is reachable in documented usage, released
   packages, container or Helm assets, local development, tests, benchmarks, or
   downstream-only integration code.
6. Do not combine assumptions from different tools or deployment models unless
   the combination is supported and reachable.
7. Do not treat a test, mock, fixture, local-only default, or already-authorized
   credential as proof unless it demonstrates a real boundary crossing by the
   stated actor.
8. For Console findings, classify browser storage, token handling, OIDC/CORS
   configuration, origin, rendering, and API-call boundaries.
9. For migrator and synchronizer findings, classify source and target systems,
   credentials, realms, catalog scopes, destructive operations, partial failures,
   and generated outputs.
10. For MCP findings, classify the MCP client, transport, tool operation,
    Polaris credentials, model-visible data, and server exposure.
11. For benchmark and apprunner findings, distinguish developer/test usage from
    production-like usage and identify whether real credentials or non-test
    deployments are involved.
12. For dependency findings, show that the vulnerable behavior is present,
    reachable through the affected tool, and affects a protected asset or trust
    boundary.

Recommended triage dispositions:

- `VALID`: The finding violates a tool security invariant through an in-scope
  actor, protected asset, trust boundary, and coherent reachable configuration.
- `VALID-HARDENING`: No clear vulnerability is established, but the behavior
  creates realistic security risk, misuse risk, or defense-in-depth value worth
  addressing.
- `DOCUMENTATION-HARDENING`: The primary issue is unclear, incomplete, or
  misleading documentation, examples, defaults, generated references, or upgrade
  guidance that could realistically cause unsafe use.
- `DEPENDENCY-TRACKING`: The issue is in an upstream dependency and needs
  tracking, mitigation, upgrade, coordination, or reachability analysis for tool
  impact.
- `OUT-OF-MODEL`: The finding depends on an actor, asset, configuration,
  component, or deployment responsibility outside the tool's security
  guarantees.
- `DOWNSTREAM-ONLY`: The behavior is in downstream integration code, private
  packaging, local patches, custom deployment logic, or third-party glue rather
  than Polaris Tools code, official artifacts, documented configuration, or
  reusable modules.
- `FALSE-POSITIVE`: The report does not show a reachable path to security impact
  or depends on impossible state, privileged fixtures, mocked trust decisions,
  already-authorized access, or mixed assumptions from unrelated tools.
- `MODEL-GAP`: The finding cannot be cleanly classified using this threat model;
  update the model or ask for project clarification before making a final triage
  decision.

Recommended finding output:

```md
## Finding

## Impact

## Affected Tool, Version, Artifact, And Configuration

## Affected Interface And Trust Boundary

## Preconditions

## Evidence

## Proof Status

## Severity Estimate

## CVE/Advisory Candidate

## Recommended Handling

## Public-Safety Note
```

Evidence must show that the actor in the stated preconditions can reach the
claimed impact through a supported or realistically reachable path. A unit test,
integration test, mocked client, fixture, or reproduction is not sufficient proof
if it relies on already-authorized access, privileged fixtures, direct internal
object construction, mocked trust decisions, protected information the actor
would not have, disabled security controls, or impossible deployment state.

Do not include private vulnerability details, exploit payloads, reporter names,
private mailing-list content, secrets, or non-public infrastructure details in
findings, documentation, tests, comments, commit messages, or PR descriptions.

## Maintenance

Review this threat model when Polaris Tools adds or substantially changes:

- A tool, package, exposed interface, transport, deployment model, or release
  artifact.
- Console authentication, browser storage, API-call, container, Helm, or CORS
  behavior.
- Migration or synchronization behavior involving credentials, principals,
  grants, source and target catalogs, destructive operations, or generated
  outputs.
- MCP server transport, tool operation, authorization, prompt/tool input
  handling, or model-visible output.
- Benchmark or apprunner behavior involving real credentials, non-test
  deployments, exposed services, generated artifacts, or copied examples.
- Documentation that changes security-relevant defaults, examples, deployment
  guidance, upgrade guidance, or operational responsibilities.

## References

- [Project security policy](SECURITY.md): how to report suspected
  vulnerabilities.
- [Apache Polaris](https://github.com/apache/polaris): Polaris server and core
  project repository.
- [Polaris security reporting page](https://polaris.apache.org/community/security-report/):
  public reporting instructions and previously published security advisories and
  CVEs.
- [ASF Security Team](https://www.apache.org/security/): ASF-wide security
  reporting and vulnerability handling overview.
