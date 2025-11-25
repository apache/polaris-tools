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

"""Unit tests for ``polaris_mcp.authorization``."""

from __future__ import annotations

import json
import time
from types import SimpleNamespace
from unittest import mock

import pytest

from polaris_mcp.authorization import (
    ClientCredentialsAuthorizationProvider,
    StaticAuthorizationProvider,
    none,
)


def test_static_authorization_provider_trims_and_formats() -> None:
    provider = StaticAuthorizationProvider("  token123 ")
    assert provider.authorization_header() == "Bearer token123"

    empty = StaticAuthorizationProvider("   ")
    assert empty.authorization_header() is None


def test_none_authorization_provider_returns_none() -> None:
    provider = none()
    assert provider.authorization_header() is None


def test_client_credentials_fetches_and_caches_tokens(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    http = mock.Mock()
    now = time.time()
    response = SimpleNamespace(
        status=200,
        data=json.dumps({"access_token": "abc", "expires_in": 120}).encode("utf-8"),
    )
    http.request.return_value = response

    provider = ClientCredentialsAuthorizationProvider(
        token_endpoint="https://auth/token",
        client_id="client",
        client_secret="secret",
        scope=None,
        http=http,
        refresh_buffer_seconds=0.0,
        timeout=mock.sentinel.timeout,
    )

    with mock.patch("time.time", return_value=now):
        header1 = provider.authorization_header()
        header2 = provider.authorization_header()

    assert header1 == "Bearer abc"
    assert header2 == "Bearer abc"

    http.request.assert_called_once()
    body = http.request.call_args.kwargs["body"]
    assert "grant_type=client_credentials" in body
    assert "client_id=client" in body
    assert "client_secret=secret" in body

    # Force expiry to trigger a refresh
    http.request.reset_mock()
    refreshed = SimpleNamespace(
        status=200,
        data=json.dumps({"access_token": "def", "expires_in": 3600}).encode("utf-8"),
    )
    http.request.return_value = refreshed
    with mock.patch("time.time", return_value=now + 4000):
        header3 = provider.authorization_header()

    assert header3 == "Bearer def"
    http.request.assert_called_once()


def test_client_credentials_refresh_buffer() -> None:
    http = mock.Mock()
    now = time.time()
    expires_in = 120
    refresh_buffer = 30.0

    response = SimpleNamespace(
        status=200,
        data=json.dumps({"access_token": "initial", "expires_in": expires_in}).encode(
            "utf-8"
        ),
    )
    http.request.return_value = response

    provider = ClientCredentialsAuthorizationProvider(
        token_endpoint="https://auth/token",
        client_id="client",
        client_secret="secret",
        scope=None,
        http=http,
        refresh_buffer_seconds=refresh_buffer,
        timeout=mock.sentinel.timeout,
    )

    # Initial valid token
    with mock.patch("time.time", return_value=now):
        header1 = provider.authorization_header()
    assert header1 == "Bearer initial"
    http.request.assert_called_once()
    http.request.reset_mock()

    # Valid token before refresh
    with mock.patch("time.time", return_value=now + (expires_in - refresh_buffer - 1)):
        header2 = provider.authorization_header()
    assert header2 == "Bearer initial"
    http.request.assert_not_called()

    # Refresh token once reached refresh buffer
    refreshed_response = SimpleNamespace(
        status=200,
        data=json.dumps({"access_token": "refreshed", "expires_in": expires_in}).encode(
            "utf-8"
        ),
    )
    http.request.return_value = refreshed_response
    with mock.patch("time.time", return_value=now + (expires_in - refresh_buffer)):
        header3 = provider.authorization_header()
    assert header3 == "Bearer refreshed"
    http.request.assert_called_once()
    http.request.reset_mock()

    # Force expiry to trigger a refresh
    with mock.patch("time.time", return_value=now + expires_in + 1):
        header4 = provider.authorization_header()
    assert header4 == "Bearer refreshed"
    http.request.assert_not_called()


@pytest.mark.parametrize(
    "payload,expected_message",
    [
        ({"access_token": ""}, "missing access_token"),
        ({"nope": "value"}, "missing access_token"),
        ("not-json", "invalid JSON"),
    ],
)
def test_client_credentials_rejects_invalid_responses(
    payload: object, expected_message: str
) -> None:
    http = mock.Mock()
    if isinstance(payload, str):
        data = payload.encode("utf-8")
    else:
        data = json.dumps(payload).encode("utf-8")
    http.request.return_value = SimpleNamespace(status=200, data=data)

    provider = ClientCredentialsAuthorizationProvider(
        token_endpoint="https://auth/token",
        client_id="client",
        client_secret="secret",
        scope=None,
        http=http,
        refresh_buffer_seconds=0.0,
        timeout=mock.sentinel.timeout,
    )

    with pytest.raises(RuntimeError, match=expected_message):
        provider.authorization_header()


def test_client_credentials_errors_on_non_200_status() -> None:
    http = mock.Mock()
    http.request.return_value = SimpleNamespace(status=500, data=b"boom")

    provider = ClientCredentialsAuthorizationProvider(
        token_endpoint="https://auth/token",
        client_id="client",
        client_secret="secret",
        scope=None,
        http=http,
        refresh_buffer_seconds=0.0,
        timeout=mock.sentinel.timeout,
    )

    with pytest.raises(RuntimeError, match="500"):
        provider.authorization_header()
