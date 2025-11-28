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

"""Authorization helpers for the Polaris MCP server."""

from __future__ import annotations

import json
import os
import threading
import time
from abc import ABC, abstractmethod
from typing import Optional
from urllib.parse import urlencode, urljoin

import urllib3


class AuthorizationProvider(ABC):
    """Return Authorization header values for outgoing requests."""

    @abstractmethod
    def authorization_header(self, realm: Optional[str] = None) -> Optional[str]: ...


class StaticAuthorizationProvider(AuthorizationProvider):
    """Wrap a static bearer token."""

    def __init__(self, token: Optional[str]) -> None:
        value = (token or "").strip()
        self._header = f"Bearer {value}" if value else None

    def authorization_header(self, realm: Optional[str] = None) -> Optional[str]:
        return self._header


class ClientCredentialsAuthorizationProvider(AuthorizationProvider):
    """Implements the OAuth client-credentials flow with caching."""

    def __init__(
        self,
        base_url: str,
        http: urllib3.PoolManager,
        refresh_buffer_seconds: float,
        timeout: urllib3.Timeout,
    ) -> None:
        self._base_url = base_url
        self._http = http
        self._refresh_buffer_seconds = max(refresh_buffer_seconds, 0.0)
        self._timeout = timeout
        self._lock = threading.Lock()
        # {realm: (token, expires_at_epoch)}
        self._cached: dict[str, tuple[str, float]] = {}

    def authorization_header(self, realm: Optional[str] = None) -> Optional[str]:
        token = self._get_token_from_realm(realm)
        return f"Bearer {token}" if token else None

    def _get_token_from_realm(self, realm: Optional[str]) -> Optional[str]:
        def needs_refresh(cached):
            return (
                cached is None
                or cached[1] - self._refresh_buffer_seconds <= time.time()
            )

        cache_key = realm or ""
        token = self._cached.get(cache_key)
        # Token not expired
        if not needs_refresh(token):
            return token[0]
        # Acquire lock and verify again if token expired
        with self._lock:
            token = self._cached.get(cache_key)
            if needs_refresh(token):
                credentials = self._get_credentials_from_realm(realm)
                if not credentials:
                    return None
                token = self._fetch_token(realm, credentials)
                self._cached[cache_key] = token
        return token[0] if token else None

    def _get_credentials_from_realm(
        self, realm: Optional[str]
    ) -> Optional[dict[str, str]]:
        def get_env(key: str) -> Optional[str]:
            val = os.getenv(key)
            return val.strip() or None if val else None

        def load_creds(realm: Optional[str] = None) -> dict[str, Optional[str]]:
            prefix = f"POLARIS_REALM_{realm}_" if realm else "POLARIS_"
            return {
                "client_id": get_env(f"{prefix}CLIENT_ID"),
                "client_secret": get_env(f"{prefix}CLIENT_SECRET"),
                "scope": get_env(f"{prefix}TOKEN_SCOPE"),
                "token_url": get_env(f"{prefix}TOKEN_URL"),
            }

        # Try realm specific first then global
        for _ in (realm, None):
            creds = load_creds(_)
            if creds["client_id"] and creds["client_secret"]:
                return creds
        return None

    def _fetch_token(
        self, realm: Optional[str], credentials: dict[str, str]
    ) -> tuple[str, float]:
        token_url = credentials.get("token_url") or urljoin(
            self._base_url, "api/catalog/v1/oauth/tokens"
        )
        payload = {
            "grant_type": "client_credentials",
            "client_id": credentials["client_id"],
            "client_secret": credentials["client_secret"],
        }
        if credentials.get("scope"):
            payload["scope"] = credentials["scope"]

        encoded = urlencode(payload)
        header_name = os.getenv("POLARIS_REALM_CONTEXT_HEADER_NAME", "Polaris-Realm")
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        if realm:
            headers[header_name] = realm
        response = self._http.request(
            "POST",
            token_url,
            body=encoded,
            headers=headers,
            timeout=self._timeout,
        )
        if response.status != 200:
            raise RuntimeError(
                f"OAuth token endpoint returned {response.status}: {response.data.decode('utf-8', errors='ignore')}"
            )

        try:
            document = json.loads(response.data.decode("utf-8"))
        except json.JSONDecodeError as error:
            raise RuntimeError("OAuth token endpoint returned invalid JSON") from error

        token = document.get("access_token")
        if not isinstance(token, str) or not token:
            raise RuntimeError("OAuth token response missing access_token")

        expires_in = document.get("expires_in", 3600)
        try:
            ttl = float(expires_in)
        except (TypeError, ValueError):
            ttl = 3600.0
        ttl = max(ttl, self._refresh_buffer_seconds)
        expires_at = time.time() + ttl
        return token, expires_at


class _NoneAuthorizationProvider(AuthorizationProvider):
    def authorization_header(self, realm: Optional[str] = None) -> Optional[str]:
        return None


def none() -> AuthorizationProvider:
    """Return an AuthorizationProvider that never supplies a header."""

    return _NoneAuthorizationProvider()
