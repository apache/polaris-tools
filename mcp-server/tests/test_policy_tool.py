"""Unit tests for ``polaris_mcp.tools.policy``."""

from __future__ import annotations

import pytest
from unittest import mock

from polaris_mcp.base import ToolExecutionResult
from polaris_mcp.tools.policy import PolarisPolicyTool


def _build_tool() -> tuple[PolarisPolicyTool, mock.Mock]:
    rest_client = mock.Mock()
    rest_client.call.return_value = ToolExecutionResult(text="ok", is_error=False)
    tool = PolarisPolicyTool(rest_client=rest_client)
    return tool, rest_client


def test_list_operation_requires_namespace_and_builds_path() -> None:
    tool, rest_client = _build_tool()

    tool.call({"operation": "list", "catalog": "prod", "namespace": "analytics.daily"})

    payload = rest_client.call.call_args.args[0]
    assert payload["method"] == "GET"
    assert payload["path"] == "prod/namespaces/analytics.daily/policies"


def test_create_operation_requires_body() -> None:
    tool, _ = _build_tool()
    with pytest.raises(ValueError, match="Create operations require"):
        tool.call({"operation": "create", "catalog": "prod", "namespace": "ns"})


def test_attach_operation_requires_policy() -> None:
    tool, _ = _build_tool()
    with pytest.raises(ValueError, match="Policy name is required"):
        tool.call(
            {"operation": "attach", "catalog": "prod", "namespace": "ns", "body": {}}
        )
