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

"""Unit tests for ``polaris_mcp.tools.principal_role``."""

from __future__ import annotations

import pytest
from unittest import mock

from polaris_mcp.base import ToolExecutionResult
from polaris_mcp.tools.principal_role import PolarisPrincipalRoleTool


def _build_tool() -> tuple[PolarisPrincipalRoleTool, mock.Mock]:
    rest_client = mock.Mock()
    rest_client.call.return_value = ToolExecutionResult(text="ok", is_error=False)
    tool = PolarisPrincipalRoleTool(rest_client=rest_client)
    return tool, rest_client


def test_list_operation_sets_management_path() -> None:
    tool, rest_client = _build_tool()

    tool.call({"operation": "list"})

    payload = rest_client.call.call_args.args[0]
    assert payload["method"] == "GET"
    assert payload["path"] == "principal-roles"


def test_assign_catalog_role_requires_body() -> None:
    tool, _ = _build_tool()

    with pytest.raises(ValueError, match="Missing required field: catalog"):
        tool.call({"operation": "assign-catalog-role", "principalRole": "analyst"})


def test_get_operation_encodes_principal_role() -> None:
    tool, rest_client = _build_tool()

    tool.call({"operation": "get", "principalRole": "team role"})

    payload = rest_client.call.call_args.args[0]
    assert payload["method"] == "GET"
    assert payload["path"] == "principal-roles/team%20role"
