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
    monkeypatch.setenv("POLARIS_CLIENT_ID", "client")
    monkeypatch.setenv("POLARIS_CLIENT_SECRET", "secret")
    monkeypatch.setenv("POLARIS_TOKEN_URL", "https://auth/token")
    http = mock.Mock()
    now = time.time()
    response = SimpleNamespace(
        status=200,
        data=json.dumps({"access_token": "abc", "expires_in": 120}).encode("utf-8"),
    )
    http.request.return_value = response

    provider = ClientCredentialsAuthorizationProvider(
        base_url="https://polaris/",
        http=http,
        refresh_buffer_seconds=60.0,
        timeout=mock.sentinel.timeout,
    )

    with mock.patch("time.time", return_value=now):
        header1 = provider.authorization_header()
        header2 = provider.authorization_header()

    assert header1 == "Bearer abc"
    assert header2 == "Bearer abc"

    http.request.assert_called_once()
    args, kwargs = http.request.call_args
    assert args[1] == "https://auth/token"
    body = kwargs["body"]
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


def test_client_credentials_fetches_and_caches_realm_specific_token(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    http_mock = mock.Mock()
    provider = ClientCredentialsAuthorizationProvider(
        base_url="https://polaris/",
        http=http_mock,
        refresh_buffer_seconds=60.0,
        timeout=mock.sentinel.timeout,
    )
    monkeypatch.setenv("POLARIS_REALM_TEST_REALM_CLIENT_ID", "realm_client")
    monkeypatch.setenv("POLARIS_REALM_TEST_REALM_CLIENT_SECRET", "realm_secret")
    monkeypatch.setenv("POLARIS_REALM_TEST_REALM_TOKEN_URL", "https://realm-auth/token")

    now = time.time()
    response = SimpleNamespace(
        status=200,
        data=json.dumps({"access_token": "realm_token", "expires_in": 3600}).encode(
            "utf-8"
        ),
    )
    http_mock.request.return_value = response

    with mock.patch("time.time", return_value=now):
        header = provider.authorization_header(realm="TEST_REALM")

    assert header == "Bearer realm_token"
    http_mock.request.assert_called_once()
    args, kwargs = http_mock.request.call_args
    assert args[1] == "https://realm-auth/token"
    assert "client_id=realm_client" in kwargs["body"]
    assert "Polaris-Realm" in kwargs["headers"]
    assert kwargs["headers"]["Polaris-Realm"] == "TEST_REALM"


def test_client_credentials_refresh_buffer(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("POLARIS_CLIENT_ID", "client")
    monkeypatch.setenv("POLARIS_CLIENT_SECRET", "secret")
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
        base_url="https://polaris/",
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


def test_client_credentials_returns_none_if_no_credentials() -> None:
    http_mock = mock.Mock()
    provider = ClientCredentialsAuthorizationProvider(
        base_url="https://polaris/",
        http=http_mock,
        refresh_buffer_seconds=60.0,
        timeout=mock.sentinel.timeout,
    )
    assert provider.authorization_header() is None
    assert provider.authorization_header(realm="foo") is None


@pytest.mark.parametrize(
    "payload,expected_message",
    [
        ({"access_token": ""}, "missing access_token"),
        ({"nope": "value"}, "missing access_token"),
        ("not-json", "invalid JSON"),
    ],
)
def test_client_credentials_rejects_invalid_responses(
    payload: object, expected_message: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("POLARIS_CLIENT_ID", "client")
    monkeypatch.setenv("POLARIS_CLIENT_SECRET", "secret")
    http = mock.Mock()
    if isinstance(payload, str):
        data = payload.encode("utf-8")
    else:
        data = json.dumps(payload).encode("utf-8")
    http.request.return_value = SimpleNamespace(status=200, data=data)

    provider = ClientCredentialsAuthorizationProvider(
        base_url="https://polaris/",
        http=http,
        refresh_buffer_seconds=0.0,
        timeout=mock.sentinel.timeout,
    )

    with pytest.raises(RuntimeError, match=expected_message):
        provider.authorization_header()


def test_client_credentials_errors_on_non_200_status(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("POLARIS_CLIENT_ID", "client")
    monkeypatch.setenv("POLARIS_CLIENT_SECRET", "secret")
    http = mock.Mock()
    http.request.return_value = SimpleNamespace(status=500, data=b"boom")

    provider = ClientCredentialsAuthorizationProvider(
        base_url="https://polaris/",
        http=http,
        refresh_buffer_seconds=0.0,
        timeout=mock.sentinel.timeout,
    )

    with pytest.raises(RuntimeError, match="500"):
        provider.authorization_header()


def test_client_credentials_caches_tokens_separately_for_each_realm(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    http_mock = mock.Mock()
    provider = ClientCredentialsAuthorizationProvider(
        base_url="https://polaris/",
        http=http_mock,
        refresh_buffer_seconds=60.0,
        timeout=mock.sentinel.timeout,
    )
    # Global creds
    monkeypatch.setenv("POLARIS_CLIENT_ID", "global_client")
    monkeypatch.setenv("POLARIS_CLIENT_SECRET", "global_secret")
    # Realm creds
    monkeypatch.setenv("POLARIS_REALM_realm1_CLIENT_ID", "realm1_client")
    monkeypatch.setenv("POLARIS_REALM_realm1_CLIENT_SECRET", "realm1_secret")

    # First call for global
    http_mock.request.return_value = SimpleNamespace(
        status=200,
        data=json.dumps({"access_token": "global_token"}).encode("utf-8"),
    )
    assert provider.authorization_header() == "Bearer global_token"
    http_mock.request.assert_called_once()
    assert "client_id=global_client" in http_mock.request.call_args.kwargs["body"]

    # First call for realm1
    http_mock.request.return_value = SimpleNamespace(
        status=200,
        data=json.dumps({"access_token": "realm1_token"}).encode("utf-8"),
    )
    assert provider.authorization_header(realm="realm1") == "Bearer realm1_token"
    assert http_mock.request.call_count == 2
    assert "client_id=realm1_client" in http_mock.request.call_args.kwargs["body"]

    # Second call for global should hit cache
    assert provider.authorization_header() == "Bearer global_token"
    assert http_mock.request.call_count == 2

    # Second call for realm1 should hit cache
    assert provider.authorization_header(realm="realm1") == "Bearer realm1_token"
    assert http_mock.request.call_count == 2


def test_with_realm_header(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    realm_name = "TEST_REALM"
    http = mock.Mock()
    http.request.return_value = SimpleNamespace(
        status=200,
        data=json.dumps({"access_token": "token", "expires_in": 3600}).encode("utf-8"),
    )
    monkeypatch.setenv(f"POLARIS_REALM_{realm_name}_CLIENT_ID", "client")
    monkeypatch.setenv(f"POLARIS_REALM_{realm_name}_CLIENT_SECRET", "secret")
    provider = ClientCredentialsAuthorizationProvider(
        base_url="https://polaris/",
        http=http,
        refresh_buffer_seconds=60.0,
        timeout=mock.sentinel.timeout,
    )
    provider.authorization_header(realm=realm_name)
    call_args = http.request.call_args
    headers = call_args[1]["headers"]
    assert headers["Polaris-Realm"] == realm_name


def test_with_custom_realm_header(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    realm_name = "TEST_REALM"
    monkeypatch.setenv("POLARIS_REALM_CONTEXT_HEADER_NAME", "X-Polaris-Realm")
    http = mock.Mock()
    http.request.return_value = SimpleNamespace(
        status=200,
        data=json.dumps({"access_token": "token", "expires_in": 3600}).encode("utf-8"),
    )
    monkeypatch.setenv(f"POLARIS_REALM_{realm_name}_CLIENT_ID", "client")
    monkeypatch.setenv(f"POLARIS_REALM_{realm_name}_CLIENT_SECRET", "secret")
    provider = ClientCredentialsAuthorizationProvider(
        base_url="https://polaris/",
        http=http,
        refresh_buffer_seconds=60.0,
        timeout=mock.sentinel.timeout,
    )
    provider.authorization_header(realm=realm_name)
    call_args = http.request.call_args
    headers = call_args[1]["headers"]
    assert headers["X-Polaris-Realm"] == realm_name


def test_two_realms_one_incomplete(monkeypatch: pytest.MonkeyPatch) -> None:
    realm1_name = "TEST_REALM"
    realm2_name = "TEST2_REALM"
    http = mock.Mock()
    provider = ClientCredentialsAuthorizationProvider(
        base_url="https://polaris/",
        http=http,
        refresh_buffer_seconds=60.0,
        timeout=mock.sentinel.timeout,
    )
    # Realm 1 – complete credentials
    monkeypatch.setenv(f"POLARIS_REALM_{realm1_name}_CLIENT_ID", "client")
    monkeypatch.setenv(f"POLARIS_REALM_{realm1_name}_CLIENT_SECRET", "secret")
    # Realm 2 – missing secret
    monkeypatch.setenv(f"POLARIS_REALM_{realm2_name}_CLIENT_ID", "client2")
    # Mock response for realm 1
    http.request.return_value = SimpleNamespace(
        status=200,
        data=json.dumps({"access_token": "token", "expires_in": 3600}).encode("utf-8"),
    )
    # Realm 1 should succeed
    assert provider.authorization_header(realm=f"{realm1_name}") == "Bearer token"
    assert http.request.call_count == 1
    # Realm 2 should return None and not trigger an HTTP request
    http.request.reset_mock()
    assert provider.authorization_header(realm=f"{realm2_name}") is None
    assert http.request.call_count == 0
