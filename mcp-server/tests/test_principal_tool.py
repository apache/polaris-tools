"""Unit tests for ``polaris_mcp.tools.principal``."""

from __future__ import annotations

import pytest
from unittest import mock

from polaris_mcp.base import ToolExecutionResult
from polaris_mcp.tools.principal import PolarisPrincipalTool


def _build_tool() -> tuple[PolarisPrincipalTool, mock.Mock]:
    rest_client = mock.Mock()
    rest_client.call.return_value = ToolExecutionResult(text="ok", is_error=False)
    tool = PolarisPrincipalTool(rest_client=rest_client)
    return tool, rest_client


def test_list_operation_sets_management_path() -> None:
    tool, rest_client = _build_tool()

    tool.call({"operation": "list"})

    payload = rest_client.call.call_args.args[0]
    assert payload["method"] == "GET"
    assert payload["path"] == "principals"


def test_assign_role_requires_principal_and_body() -> None:
    tool, _ = _build_tool()
    with pytest.raises(ValueError, match="Missing required field: principal"):
        tool.call({"operation": "assign-role"})

    with pytest.raises(ValueError, match="GrantPrincipalRoleRequest"):
        tool.call({"operation": "assign-role", "principal": "alice"})


def test_get_operation_encodes_principal() -> None:
    tool, rest_client = _build_tool()

    tool.call({"operation": "get", "principal": "svc user"})

    payload = rest_client.call.call_args.args[0]
    assert payload["method"] == "GET"
    assert payload["path"] == "principals/svc%20user"
