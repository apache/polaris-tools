"""Unit tests for ``polaris_mcp.tools.catalog``."""

from __future__ import annotations

import pytest
from unittest import mock

from polaris_mcp.base import ToolExecutionResult
from polaris_mcp.tools.catalog import PolarisCatalogTool


def _build_tool() -> tuple[PolarisCatalogTool, mock.Mock]:
    rest_client = mock.Mock()
    rest_client.call.return_value = ToolExecutionResult(text="ok", is_error=False)
    tool = PolarisCatalogTool(rest_client=rest_client)
    return tool, rest_client


def test_list_operation_uses_management_path() -> None:
    tool, rest_client = _build_tool()

    tool.call({"operation": "list"})

    rest_client.call.assert_called_once()
    payload = rest_client.call.call_args.args[0]
    assert payload["method"] == "GET"
    assert payload["path"] == "catalogs"


def test_get_operation_requires_catalog_and_encodes() -> None:
    tool, rest_client = _build_tool()

    tool.call({"operation": "get", "catalog": "my catalog"})

    payload = rest_client.call.call_args.args[0]
    assert payload["method"] == "GET"
    assert payload["path"] == "catalogs/my%20catalog"


def test_create_operation_requires_body_and_copies_it() -> None:
    tool, rest_client = _build_tool()
    body = {"name": "c1", "properties": {"a": "b"}}

    tool.call({"operation": "create", "body": body})

    payload = rest_client.call.call_args.args[0]
    assert payload["method"] == "POST"
    assert payload["path"] == "catalogs"
    assert payload["body"] == body
    assert payload["body"] is not body
    assert payload["body"]["properties"] is not body["properties"]


def test_create_operation_requires_body_present() -> None:
    tool, _ = _build_tool()
    with pytest.raises(ValueError, match="Create operations require"):
        tool.call({"operation": "create"})
