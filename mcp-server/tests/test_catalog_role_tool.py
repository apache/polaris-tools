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

"""Unit tests for ``polaris_mcp.tools.catalog_role``."""

from __future__ import annotations

import pytest
from unittest import mock

from polaris_mcp.base import ToolExecutionResult
from polaris_mcp.tools.catalog_role import PolarisCatalogRoleTool


def _build_tool() -> tuple[PolarisCatalogRoleTool, mock.Mock]:
    rest_client = mock.Mock()
    rest_client.call.return_value = ToolExecutionResult(text="ok", is_error=False)
    tool = PolarisCatalogRoleTool(rest_client=rest_client)
    return tool, rest_client


def test_list_grants_builds_expected_path() -> None:
    tool, rest_client = _build_tool()

    tool.call({"operation": "list-grants", "catalog": "prod", "catalogRole": "analyst"})

    payload = rest_client.call.call_args.args[0]
    assert payload["method"] == "GET"
    assert payload["path"] == "catalogs/prod/catalog-roles/analyst/grants"


def test_add_grant_requires_body() -> None:
    tool, rest_client = _build_tool()
    body = {"principal": "alice", "permission": "READ"}

    tool.call(
        {
            "operation": "grant",
            "catalog": "prod",
            "catalogRole": "analyst",
            "body": body,
        }
    )

    payload = rest_client.call.call_args.args[0]
    assert payload["method"] == "PUT"
    assert payload["path"] == "catalogs/prod/catalog-roles/analyst/grants"
    assert payload["body"] == body
    assert payload["body"] is not body  # it's a different object


def test_add_grant_fails_without_body() -> None:
    tool, _ = _build_tool()
    with pytest.raises(ValueError, match="AddGrantRequest payload"):
        tool.call(
            {"operation": "add-grant", "catalog": "prod", "catalogRole": "analyst"}
        )
