"""Unit tests for ``polaris_mcp.tools.namespace``."""

from __future__ import annotations

from unittest import mock

from polaris_mcp.base import ToolExecutionResult
from polaris_mcp.tools.namespace import PolarisNamespaceTool


def _build_tool(mock_rest: mock.Mock) -> tuple[PolarisNamespaceTool, mock.Mock]:
    delegate = mock.Mock()
    delegate.call.return_value = ToolExecutionResult(text="done", is_error=False)
    mock_rest.return_value = delegate
    tool = PolarisNamespaceTool(
        "https://polaris/", mock.sentinel.http, mock.sentinel.auth
    )
    return tool, delegate


@mock.patch("polaris_mcp.tools.namespace.PolarisRestTool")
def test_get_operation_encodes_namespace_with_unit_separator(
    mock_rest: mock.Mock,
) -> None:
    tool, delegate = _build_tool(mock_rest)

    tool.call(
        {
            "operation": "get",
            "catalog": "prod",
            "namespace": [" analytics", "daily "],
        }
    )

    delegate.call.assert_called_once()
    payload = delegate.call.call_args.args[0]
    assert payload["method"] == "GET"
    assert payload["path"] == "prod/namespaces/analytics%1Fdaily"


@mock.patch("polaris_mcp.tools.namespace.PolarisRestTool")
def test_create_operation_infers_namespace_array_from_string(
    mock_rest: mock.Mock,
) -> None:
    tool, delegate = _build_tool(mock_rest)
    body = {"properties": {"owner": "analytics"}}

    tool.call(
        {
            "operation": "create",
            "catalog": "prod",
            "namespace": "analytics.daily",
            "body": body,
        }
    )

    delegate.call.assert_called_once()
    payload = delegate.call.call_args.args[0]
    assert payload["method"] == "POST"
    assert payload["path"] == "prod/namespaces"
    assert payload["body"]["namespace"] == ["analytics", "daily"]
    assert payload["body"] is not body
    assert payload["body"]["properties"] is not body["properties"]
    body["properties"]["owner"] = "changed"
    assert payload["body"]["properties"]["owner"] == "analytics"
