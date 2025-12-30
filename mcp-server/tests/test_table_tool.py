#
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
#

"""Unit tests for ``polaris_mcp.tools.table``."""

from __future__ import annotations

import pytest
from unittest import mock
from typing import Any

from polaris_mcp.base import ToolExecutionResult
from polaris_mcp.tools.table import PolarisTableTool


def _build_tool() -> tuple[PolarisTableTool, mock.Mock]:
    rest_client = mock.Mock()
    rest_client.call.return_value = ToolExecutionResult(
        text="ok", is_error=False, metadata={"k": "v"}
    )
    tool = PolarisTableTool(rest_client=rest_client)
    return tool, rest_client


def test_list_operation_uses_get_and_copies_query_and_headers() -> None:
    tool, delegate = _build_tool()
    arguments = {
        "operation": "LS",
        "catalog": "prod west",
        "namespace": ["  analytics", "daily "],
        "query": {"page-size": "200"},
        "headers": {"Prefer": "return=representation"},
    }

    result = tool.call(arguments)

    assert result is delegate.call.return_value
    delegate.call.assert_called_once()
    payload = delegate.call.call_args.args[0]
    assert payload["method"] == "GET"
    assert payload["path"] == "prod%20west/namespaces/analytics%1Fdaily/tables"
    assert payload["query"] == {"page-size": "200"}
    assert payload["query"] is not arguments["query"]
    assert payload["headers"] == {"Prefer": "return=representation"}
    assert payload["headers"] is not arguments["headers"]


def test_get_operation_accepts_alias_and_encodes_table() -> None:
    tool, delegate = _build_tool()
    arguments = {
        "operation": "fetch",
        "catalog": "prod",
        "namespace": [" core ", "sales"],
        "table": "Daily Metrics",
    }

    tool.call(arguments)

    delegate.call.assert_called_once()
    payload = delegate.call.call_args.args[0]
    assert payload["method"] == "GET"
    assert payload["path"] == "prod/namespaces/core%1Fsales/tables/Daily%20Metrics"
    assert "body" not in payload


def test_get_operation_requires_table_argument() -> None:
    tool, _ = _build_tool()

    with pytest.raises(ValueError, match="Table name is required"):
        tool.call({"operation": "get", "catalog": "prod", "namespace": "analytics"})


def test_create_operation_deep_copies_request_body() -> None:
    tool, delegate = _build_tool()
    body: dict[str, Any] = {"table": "t1", "properties": {"schema-id": 1}}
    tool.call(
        {
            "operation": "create",
            "catalog": "prod",
            "namespace": "analytics",
            "body": body,
        }
    )

    delegate.call.assert_called_once()
    payload = delegate.call.call_args.args[0]
    assert payload["method"] == "POST"
    assert payload["path"] == "prod/namespaces/analytics/tables"
    assert payload["body"] == {"table": "t1", "properties": {"schema-id": 1}}
    assert payload["body"] is not body
    assert payload["body"]["properties"] is not body["properties"]

    body["properties"]["schema-id"] = 99
    assert payload["body"]["properties"]["schema-id"] == 1


def test_create_operation_requires_body() -> None:
    tool, _ = _build_tool()

    with pytest.raises(ValueError, match="Create operations require"):
        tool.call({"operation": "create", "catalog": "prod", "namespace": "analytics"})


def test_commit_operation_requires_table_and_body() -> None:
    tool, _ = _build_tool()

    with pytest.raises(ValueError, match="Table name is required"):
        tool.call(
            {
                "operation": "commit",
                "catalog": "prod",
                "namespace": "analytics",
                "body": {"changes": []},
            }
        )

    with pytest.raises(ValueError, match="Commit operations require"):
        tool.call(
            {
                "operation": "commit",
                "catalog": "prod",
                "namespace": "analytics",
                "table": "t1",
            }
        )


def test_commit_operation_post_request_with_body_copy() -> None:
    tool, delegate = _build_tool()
    body = {"changes": [{"type": "append", "snapshot-id": 5}]}

    tool.call(
        {
            "operation": "update",
            "catalog": "prod",
            "namespace": "analytics",
            "table": "metrics",
            "body": body,
        }
    )

    delegate.call.assert_called_once()
    payload = delegate.call.call_args.args[0]
    assert payload["method"] == "POST"
    assert payload["path"] == "prod/namespaces/analytics/tables/metrics"
    assert payload["body"] == {"changes": [{"type": "append", "snapshot-id": 5}]}
    assert payload["body"] is not body
    assert payload["body"]["changes"] is not body["changes"]

    body["changes"][0]["snapshot-id"] = 42
    assert payload["body"]["changes"][0]["snapshot-id"] == 5


def test_delete_operation_uses_alias_and_encodes_table() -> None:
    tool, delegate = _build_tool()

    tool.call(
        {
            "operation": "drop",
            "catalog": "prod",
            "namespace": "analytics",
            "table": "fact daily",
        }
    )

    delegate.call.assert_called_once()
    payload = delegate.call.call_args.args[0]
    assert payload["method"] == "DELETE"
    assert payload["path"] == "prod/namespaces/analytics/tables/fact%20daily"


def test_namespace_validation_rejects_blank_values() -> None:
    tool, _ = _build_tool()

    with pytest.raises(ValueError, match="Namespace must be provided"):
        tool.call({"operation": "list", "catalog": "prod", "namespace": None})

    with pytest.raises(ValueError, match="Namespace array must contain"):
        tool.call({"operation": "list", "catalog": "prod", "namespace": []})

    with pytest.raises(ValueError, match="Namespace array elements"):
        tool.call({"operation": "list", "catalog": "prod", "namespace": ["ok", " "]})
