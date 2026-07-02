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

# Helm Chart for Apache Polaris Console

The Apache Polaris Console is a web UI for [Apache Polaris](https://polaris.apache.org/).

## Requirements

- Kubernetes 1.29+ cluster
- Helm 3.x or 4.x
- A reachable Apache Polaris API endpoint

## Features

* Web-based administration UI for Apache Polaris, an open-source catalog platform
* Centralized catalog, namespace, and table management through an intuitive interface
* Centralized security and governance with principals, roles, and fine-grained privileges
* OIDC login via the Authorization Code + PKCE flow (no client secret required)
* Kubernetes-native deployment with support for horizontal scaling, Ingress, and Gateway API
* Production-ready security defaults (non-root user, dropped capabilities, seccomp `RuntimeDefault`)
* Open source and vendor neutral, governed by the Apache Polaris PMC under the Apache Software Foundation

## Documentation

Full documentation for Helm Chart lives [on the website](https://github.com/apache/polaris-tools/tree/main/console/).

## Contributing

See the [Apache Polaris contributing guidelines](https://polaris.apache.org/community/contributing-guidelines/).
