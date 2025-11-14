"""Unit tests for ``polaris_mcp.tools.table``."""

from __future__ import annotations

import pytest
from unittest import mock

from polaris_mcp.base import ToolExecutionResult
from polaris_mcp.tools.table import PolarisTableTool


def _build_tool(mock_rest: mock.Mock) -> tuple[PolarisTableTool, mock.Mock]:
    delegate = mock.Mock()
    delegate.call.return_value = ToolExecutionResult(
        text="ok", is_error=False, metadata={"k": "v"}
    )
    mock_rest.return_value = delegate
    tool = PolarisTableTool("https://polaris/", mock.sentinel.http, mock.sentinel.auth)
    return tool, delegate


@mock.patch("polaris_mcp.tools.table.PolarisRestTool")
def test_list_operation_uses_get_and_copies_query_and_headers(
    mock_rest: mock.Mock,
) -> None:
    tool, delegate = _build_tool(mock_rest)
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


@mock.patch("polaris_mcp.tools.table.PolarisRestTool")
def test_get_operation_accepts_alias_and_encodes_table(mock_rest: mock.Mock) -> None:
    tool, delegate = _build_tool(mock_rest)
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


@mock.patch("polaris_mcp.tools.table.PolarisRestTool")
def test_get_operation_requires_table_argument(mock_rest: mock.Mock) -> None:
    tool, _ = _build_tool(mock_rest)

    with pytest.raises(ValueError, match="Table name is required"):
        tool.call({"operation": "get", "catalog": "prod", "namespace": "analytics"})


@mock.patch("polaris_mcp.tools.table.PolarisRestTool")
def test_create_operation_deep_copies_request_body(mock_rest: mock.Mock) -> None:
    tool, delegate = _build_tool(mock_rest)
    body = {"table": "t1", "properties": {"schema-id": 1}}
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


@mock.patch("polaris_mcp.tools.table.PolarisRestTool")
def test_create_operation_requires_body(mock_rest: mock.Mock) -> None:
    tool, _ = _build_tool(mock_rest)

    with pytest.raises(ValueError, match="Create operations require"):
        tool.call({"operation": "create", "catalog": "prod", "namespace": "analytics"})


@mock.patch("polaris_mcp.tools.table.PolarisRestTool")
def test_commit_operation_requires_table_and_body(mock_rest: mock.Mock) -> None:
    tool, _ = _build_tool(mock_rest)

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


@mock.patch("polaris_mcp.tools.table.PolarisRestTool")
def test_commit_operation_post_request_with_body_copy(mock_rest: mock.Mock) -> None:
    tool, delegate = _build_tool(mock_rest)
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


@mock.patch("polaris_mcp.tools.table.PolarisRestTool")
def test_delete_operation_uses_alias_and_encodes_table(mock_rest: mock.Mock) -> None:
    tool, delegate = _build_tool(mock_rest)

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


@mock.patch("polaris_mcp.tools.table.PolarisRestTool")
def test_namespace_validation_rejects_blank_values(mock_rest: mock.Mock) -> None:
    tool, _ = _build_tool(mock_rest)

    with pytest.raises(ValueError, match="Namespace must be provided"):
        tool.call({"operation": "list", "catalog": "prod", "namespace": None})

    with pytest.raises(ValueError, match="Namespace array must contain"):
        tool.call({"operation": "list", "catalog": "prod", "namespace": []})

    with pytest.raises(ValueError, match="Namespace array elements"):
        tool.call({"operation": "list", "catalog": "prod", "namespace": ["ok", " "]})
