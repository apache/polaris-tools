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

"""Unit tests for ``polaris_mcp.tools.namespace``."""

from __future__ import annotations

from unittest import mock

from polaris_mcp.base import ToolExecutionResult
from polaris_mcp.tools.namespace import PolarisNamespaceTool


def _build_tool() -> tuple[PolarisNamespaceTool, mock.Mock]:
    rest_client = mock.Mock()
    rest_client.call.return_value = ToolExecutionResult(text="done", is_error=False)
    tool = PolarisNamespaceTool(rest_client=rest_client)
    return tool, rest_client

def test_get_operation_encodes_namespace_with_unit_separator() -> None:
    tool, delegate = _build_tool()

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


def test_create_operation_infers_namespace_array_from_string() -> None:
    tool, delegate = _build_tool()
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
