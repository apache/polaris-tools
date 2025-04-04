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

# Polaris Benchmarks

Benchmarks for the Polaris service using Gatling.

## Available Benchmarks

- `org.apache.polaris.benchmarks.simulations.CreateTreeDataset`: Creates a test dataset with a specific structure.  It is a write-only workload designed to populate the system for subsequent benchmarks.
- `org.apache.polaris.benchmarks.simulations.ReadTreeDataset`: Performs read-only operations to fetch namespaces, tables, and views.  Some attributes of the objects are also fetched.  This benchmark is intended to be used against a Polaris instance with a pre-existing tree dataset.  It has no side effects on the dataset and can be executed multiple times without any issues.
- `org.apache.polaris.benchmarks.simulations.ReadUpdateTreeDataset`: Performs read and update operations against a Polaris instance populated with a test dataset.  It is a read/write workload that can be used to test the system's ability to handle concurrent read and update operations.  It is not destructive and does not prevent subsequent executions of `ReadTreeDataset` or `ReadUpdateTreeDataset`.

## Parameters

All parameters are configured through the [benchmark-defaults.conf](src/gatling/resources/benchmark-defaults.conf) file located in `src/gatling/resources/`. The configuration uses the [Typesafe Config](https://github.com/lightbend/config) format. The reference configuration file contains default values as well as documentation for each parameter.

### Dataset Structure Parameters

These parameters must be consistent across all benchmarks and are configured under `dataset.tree`:

```hocon
dataset.tree {
  num-catalogs = 1                               # Number of catalogs to create
  namespace-width = 2                            # Width of the namespace tree
  namespace-depth = 4                            # Depth of the namespace tree
  tables-per-namespace = 5                       # Tables per namespace
  views-per-namespace = 3                        # Views per namespace
  columns-per-table = 10                         # Columns per table
  columns-per-view = 10                          # Columns per view
  default-base-location = "file:///tmp/polaris"  # Base location for datasets
  namespace-properties = 10                      # Number of properties to add to each namespace
  table-properties = 10                          # Number of properties to add to each table
  view-properties = 10                           # Number of properties to add to each view
  max-tables = -1                                # Cap on total tables (-1 for no cap). Must be less than N^(D-1) * tables-per-namespace
  max-views = -1                                 # Cap on total views (-1 for no cap). Must be less than N^(D-1) * views-per-namespace
}
```

### Connection Parameters

Connection settings are configured under `http` and `auth`:

```hocon
http {
  base-url = "http://localhost:8181"  # Service URL
}

auth {
  client-id = null      # Required: OAuth2 client ID
  client-secret = null  # Required: OAuth2 client secret
}
```

### Workload Parameters

Workload settings are configured under `workload`:

```hocon
workload {
  read-update-tree-dataset {
    read-write-ratio = 0.8  # Ratio of reads (0.0-1.0)
  }
}
```

## Running the Benchmarks

The benchmark uses [typesafe-config](https://github.com/lightbend/config) for configuration management. Default settings are in `src/gatling/resources/benchmark-defaults.conf`. This file should not be modified directly.

To customize the benchmark settings, create your own `application.conf` file and specify it using the `-Dconfig.file` parameter. Your settings will override the default values.

Example `application.conf`:
```hocon
auth {
  client-id = "your-client-id"
  client-secret = "your-client-secret"
}

http {
  base-url = "http://your-polaris-instance:8181"
}

workload {
  read-update-tree-dataset {
    read-write-ratio = 0.8  # Ratio of reads (0.0-1.0)
  }
}
```

Run benchmarks with your configuration:

```bash
# Dataset creation
./gradlew gatlingRun --simulation org.apache.polaris.benchmarks.simulations.CreateTreeDataset \
  -Dconfig.file=./application.conf

# Read/Update operations
./gradlew gatlingRun --simulation org.apache.polaris.benchmarks.simulations.ReadUpdateTreeDataset \
  -Dconfig.file=./application.conf

# Read-only operations
./gradlew gatlingRun --simulation org.apache.polaris.benchmarks.simulations.ReadTreeDataset \
  -Dconfig.file=./application.conf


```

A message will show the location of the Gatling report:
```
Reports generated in: ./benchmarks/build/reports/gatling/<simulation-name>/index.html
```

### Example Polaris server startup

For repeated testing and benchmarking purposes it's convenient to have fixed client-ID + client-secret combinations. **The following example is ONLY for testing and benchmarking against an airgapped Polaris instance**

```bash
# Start Polaris with the fixed client-ID/secret admin/admin
# DO NEVER EVER USE THE FOLLOWING FOR ANY NON-AIRGAPPED POLARIS INSTANCE !!
./gradlew :polaris-quarkus-server:quarkusBuild &&  java \
  -Dpolaris.bootstrap.credentials=POLARIS,admin,admin \
  -Djava.security.manager=allow \
  -jar quarkus/server/build/quarkus-app/quarkus-run.jar
```

With the above you can run the benchmarks using a configuration file with `client-id = "admin"` and `client-secret = "admin"` - meant only for convenience in a fully airgapped system.

# Test Dataset

The benchmarks use synthetic procedural datasets that are generated deterministically at runtime. This means that given the same input parameters, the exact same dataset structure will always be generated. This approach allows generating large volumes of test data without having to store it, while ensuring reproducible benchmark results across different runs.

The diagrams below describe the data sets that are used in benchmarks. Note that the benchmark dataset may not cover all Polaris features.

## Generation rules

The dataset has a tree shape. At the root of the tree is a Polaris realm that must exist before the dataset is created.

An arbitrary number of catalogs can be created under the realm. However, only the first catalog (`C_0`) is used for the rest of the dataset.

The namespaces part of the dataset is a complete `N`-ary tree. That is, it starts with a root namespace (`NS_0`) and then, each namespace contains exactly `0` or `N` children namespaces. The width as well as the depth of the namespaces tree are configurable. The total number of namespaces can easily be calculated with the following formulae, where `N` is the tree width and `D` is the total tree depth, including the root:

$$\text{Total number of namespaces} =
\begin{cases}
    \frac{N^{D} - 1}{N - 1} & \mbox{if } N \gt 1 \\
    D & \mbox{if } N = 1
\end{cases}$$

The tables are created under the leaves of the tree. That is, they are put under the namespaces with no child namespace. The number of tables that is created under each leaf namespace is configurable. The total number of tables can easily be calculated with the following formulae, where `N` is the tree width, `D` is the total tree depth, and `T` is the number of tables per leaf namespace:

Total number of tables = *N*<sup>*D* − 1</sup> \* *T*

The views are created alongside the tables. The number of views that is created under each leaf namespace is also configurable. The total number of views can easily be calculated with the following formulae, where `N` is the tree width, `D` is the total tree depth, `V` is the number of views per leaf namespace:

Total number of tables = *N*<sup>*D* − 1</sup> \* *V*

## Binary tree example

The diagram below shows an example of a test dataset with the following properties:

-   Number of catalogs: `3`
-   Namespace tree width (`N`): `2` (a binary tree)
-   Namespace tree depth (`D`): `3`
-   Tables per namespace (`T`): `5`
-   Views per namespace (`V`): `3`

![Binary tree dataset example with width 2, depth 3, and 5 tables per namespace](docs/dataset-shape-2-3-5.svg)

Using the formula from the previous section, we can calculate the total number of namespaces and the total number of tables as follows:

$$\text{Total number of namespaces} = \frac{2^{3} - 1}{2 - 1} = 7$$

Total number of tables = 2<sup>3 − 1</sup> \* 5 = 20

## 10-ary tree example

The diagram below shows an example of a test dataset with the following properties:

-   Number of catalogs: `1`
-   Namespace tree width (`N`): `10`
-   Namespace tree depth (`D`): `2`
-   Tables per namespace (`T`): `3`
-   Views per namespace (`V`): `3`

![10-ary tree dataset example with width 10, depth 2, and 3 tables per namespace](docs/dataset-shape-10-2-3.svg)

Using the formula from the previous section, we can calculate the total number of namespaces and the total number of tables as follows:

$$\text{Total number of namespaces} = \frac{10^{2} - 1}{10 - 1} = 11$$

Total number of tables = 10<sup>2 − 1</sup> \* 3 = 30

## 1-ary tree example

The diagram below shows an example of a test dataset with the following properties:

-   Number of catalogs: `1`
-   Namespace tree width (`N`): `1`
-   Namespace tree depth (`D`): `1000`
-   Tables per namespace (`T`): `7`
-   Views per namespace (`V`): `4`

![1-ary tree dataset example with width 1, depth 1000, and 7 tables per namespace](docs/dataset-shape-1-1000-7.svg)

Using the formula from the previous section, we can calculate the total number of namespaces and the total number of tables as follows:

Total number of namespaces = 1000

Total number of tables = 1<sup>1000 − 1</sup> \* 7 = 7

## Size

The data set size can be adjusted as well. Each namespace is associated with an arbitrary number of dummy properties. Similarly, each table is associated with an arbitrary number of dummy columns and properties.

The diagram below shows sample catalog, namespace and table definition given the following properties:

-   Default base location: `file:///tmp/polaris`
-   Number of namespace properties: `100`
-   Number of columns per table: `999`
-   Number of table properties: `59`

![Dataset size example showing catalog, namespace, and table definitions](docs/dataset-size.png)
