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

# Helm Chart for the Apache Polaris Console

The Apache Polaris Console is a web UI for [Apache Polaris](https://polaris.apache.org/),
an open-source catalog for Apache Iceberg.

## Requirements

- Kubernetes 1.29+ cluster
- Helm 3.x or 4.x
- A reachable Apache Polaris API endpoint

## Features

- Production-ready security defaults (non-root user, dropped capabilities, seccomp `RuntimeDefault`)
- Runtime configuration via a ConfigMap injected with `envFrom` — config changes trigger
  pod restarts via `checksum/config`
- OIDC login via the Authorization Code + PKCE flow (no client secret required)
- Horizontal Pod Autoscaler and PodDisruptionBudget support
- Multiple ingress strategies: standard `Ingress`, Gateway API `HTTPRoute`, and an
  optional managed `Gateway`
- Full scheduling controls: `nodeSelector`, `tolerations`, `affinity`,
  `topologySpreadConstraints`, `priorityClassName`
- Multi-port `Service` with `sessionAffinity`, traffic policies, and `trafficDistribution`
- Extension points: `extraEnv`, `envFrom`, `extraVolumes`, `extraVolumeMounts`,
  `extraInitContainers`, container lifecycle hooks

## Configuration

See [`values.yaml`](./values.yaml) for the full list of configurable values, including
inline documentation. The chart enforces a JSON Schema (see `values.schema.json`) so
invalid values fail fast at install time.

## Documentation

Full documentation for Helm Chart lives [on the website](https://github.com/apache/polaris-tools/tree/main/console/).

## Contributing

See the [Apache Polaris contributing guidelines](https://polaris.apache.org/community/contributing-guidelines/).
