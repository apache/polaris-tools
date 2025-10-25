<!--
  - Licensed to the Apache Software Foundation (ASF) under one
  - or more contributor license agreements.  See the NOTICE file
  - distributed with this work for additional information
  - regarding copyright ownership.  The ASF licenses this file
  - to you under the Apache License, Version 2.0 (the
  - "License"); you may not use this file except in compliance
  - with the License.  You may obtain a copy of the License at
  -
  -   http://www.apache.org/licenses/LICENSE-2.0
  -
  - Unless required by applicable law or agreed to in writing,
  - software distributed under the License is distributed on an
  - "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
  - KIND, either express or implied.  See the License for the
  - specific language governing permissions and limitations
  - under the License.
  -->

# Apache Polaris Console

The Apache Polaris Console is a web console allowing you to manage a Polaris server.
It allows you to manage Polaris catalogs, principals, catalog roles, ...

You can also browse the catalog entities (namespaces, tables, ...).

## Prerequisite

The Polaris Console is using `yarn` or `npm` to be built.

You have to install `yarn` or `npm` using your OS package manager (e.g. `brew install yarn`).

## Configuring the Polaris Console to connect to a Polaris server

By default, the Polaris Console connects to a local Polaris server on the port 8181 (`http://localhost:8181`).

If the Polaris server is not located on `localhost:8181`, you have to update the Console `proxy` configuration in the `package.json`:

```
"proxy": "http://localhost:8181"
```

## Downloading the Polaris Console dependencies

The Polaris Console uses React (https://react.dev/) and Ant Design (https://ant.design/) frameworks, with transitive dependencies.

To download the Polaris Console dependencies, you can just do:

```
yarn
```

## Starting the Polaris Console

```
yarn start
```

## Building static Polaris Console

```
yarn build
```

## Polaris Console Docker image and Helm Charts

TODO
