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

"""Unit tests for ``polaris_mcp.rest``."""

from __future__ import annotations

from types import SimpleNamespace
from unittest import mock

import pytest
from urllib3._collections import HTTPHeaderDict

from polaris_mcp.rest import DEFAULT_TIMEOUT, PolarisRestTool


def _build_response(
    status: int, body: str, headers: dict[str, object] | None = None
) -> SimpleNamespace:
    """Return a lightweight stub with the attributes accessed by PolarisRestTool."""

    header_dict = HTTPHeaderDict()
    if headers:
        for key, value in headers.items():
            if isinstance(value, (list, tuple)):
                for item in value:
                    header_dict.add(key, item)
            else:
                header_dict.add(key, value)
    return SimpleNamespace(
        status=status, data=body.encode("utf-8"), headers=header_dict
    )


def _create_tool() -> tuple[PolarisRestTool, mock.Mock, mock.Mock]:
    http = mock.Mock()
    auth = mock.Mock()
    auth.authorization_header.return_value = "Bearer provided"
    tool = PolarisRestTool(
        name="test",
        description="desc",
        base_url="https://example.test/",
        default_path_prefix="api/catalog/v1/",
        http=http,
        authorization_provider=auth,
    )
    return tool, http, auth


def test_call_builds_request_and_metadata_with_json_body() -> None:
    tool, http, auth = _create_tool()
    http.request.return_value = _build_response(
        status=201,
        body='{"result":"ok"}',
        headers={"Content-Type": "application/json", "X-Request-Id": "abc123"},
    )

    result = tool.call(
        {
            "method": "post",
            "path": "namespaces",
            "query": {"page-size": "200", "tag": ["blue", "green"]},
            "headers": {
                "Prefer": ["return-minimal", "respond-async"],
                "Authorization": "Bearer user",
            },
            "body": {"name": "analytics"},
        }
    )

    expected_url = "https://example.test/api/catalog/v1/namespaces?page-size=200&tag=blue&tag=green"
    expected_headers = {
        "Accept": "application/json",
        "Prefer": "return-minimal, respond-async",
        "Authorization": "Bearer user",
        "Content-Type": "application/json",
    }

    http.request.assert_called_once_with(
        "POST",
        expected_url,
        body=b'{"name": "analytics"}',
        headers=expected_headers,
        timeout=DEFAULT_TIMEOUT,
    )
    auth.authorization_header.assert_not_called()

    assert not result.is_error
    assert f"POST {expected_url}" in result.text
    assert '"result": "ok"' in result.text
    assert result.metadata["method"] == "POST"
    assert result.metadata["url"] == expected_url
    assert result.metadata["status"] == 201
    assert result.metadata["request"]["body"] == {"name": "analytics"}
    assert result.metadata["response"]["body"] == {"result": "ok"}
    assert result.metadata["response"]["headers"]["X-Request-Id"] == "abc123"
    assert result.metadata["request"]["headers"]["Authorization"] == "[REDACTED]"
    assert (
        result.metadata["request"]["headers"]["Prefer"]
        == "return-minimal, respond-async"
    )


def test_call_uses_authorization_provider_and_handles_plain_text() -> None:
    tool, http, auth = _create_tool()
    auth.authorization_header.return_value = "Bearer dynamic"
    http.request.return_value = _build_response(
        status=404,
        body="failure",
        headers={"X-Trace": ["abc", "def"]},
    )

    result = tool.call(
        {
            "path": "https://override.test/api",
            "query": {"q": "one"},
            "headers": {"X-Custom": "42"},
            "body": "payload",
        }
    )

    expected_url = "https://override.test/api?q=one"
    expected_headers = {
        "Accept": "application/json",
        "X-Custom": "42",
        "Authorization": "Bearer dynamic",
        "Content-Type": "application/json",
    }

    http.request.assert_called_once_with(
        "GET",
        expected_url,
        body=b"payload",
        headers=expected_headers,
        timeout=DEFAULT_TIMEOUT,
    )
    auth.authorization_header.assert_called_once()

    assert result.is_error
    assert "Status: 404" in result.text
    assert result.metadata["url"] == expected_url
    assert result.metadata["request"]["bodyText"] == "payload"
    assert result.metadata["response"]["bodyText"] == "failure"
    assert result.metadata["response"]["headers"]["X-Trace"] == "abc, def"
    assert result.metadata["request"]["headers"]["Authorization"] == "[REDACTED]"


def test_call_requires_non_empty_path() -> None:
    tool, http, _ = _create_tool()

    with pytest.raises(ValueError, match="path.*must not be empty"):
        tool.call({"method": "GET"})

    http.request.assert_not_called()
