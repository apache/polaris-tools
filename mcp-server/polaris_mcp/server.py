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

"""Entry point for the Polaris Model Context Protocol server."""

from __future__ import annotations

import sys
import logging
import logging.config
import argparse
import os
from typing import Any, Mapping, MutableMapping, Sequence, Optional
from urllib.parse import urljoin, urlparse

import urllib3
from fastmcp import FastMCP
from fastmcp.tools.tool import ToolResult as FastMcpToolResult
from importlib import metadata
from mcp.types import TextContent
from dotenv import find_dotenv, load_dotenv

from polaris_mcp.authorization import (
    AuthorizationProvider,
    ClientCredentialsAuthorizationProvider,
    StaticAuthorizationProvider,
    none,
)
from polaris_mcp.base import ToolExecutionResult
from polaris_mcp.rest import PolarisRestTool
from polaris_mcp.tools import (
    PolarisCatalogRoleTool,
    PolarisCatalogTool,
    PolarisNamespaceTool,
    PolarisPolicyTool,
    PolarisPrincipalRoleTool,
    PolarisPrincipalTool,
    PolarisTableTool,
)

DEFAULT_BASE_URL = "http://localhost:8181/"
OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "isError": {"type": "boolean"},
        "meta": {"type": "object"},
    },
    "required": ["isError"],
    "additionalProperties": True,
}
DEFAULT_TOKEN_REFRESH_BUFFER_SECONDS = 60.0
DEFAULT_HTTP_TIMEOUT = 30.0
DEFAULT_HTTP_RETRIES_TOTAL = 3
DEFAULT_HTTP_RETRIES_BACKOFF_FACTOR = 0.5
HTTP_RETRIES_STATUS_FORCELIST = [401, 409, 429]
LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "()": "pythonjsonlogger.json.JsonFormatter",
            "format": "%(asctime)s %(name)s %(levelname)s %(message)s",
        }
    },
    "handlers": {
        "json": {
            "class": "logging.StreamHandler",
            "formatter": "json",
        }
    },
    "root": {"handlers": ["json"], "level": "INFO"},
}
logger = logging.getLogger(__name__)


def create_server() -> FastMCP:
    """Construct a FastMCP server with Polaris tools."""
    base_url = _resolve_base_url()
    timeout = _resolve_http_timeout()
    total_retries = int(
        os.getenv("POLARIS_HTTP_RETRIES_TOTAL", DEFAULT_HTTP_RETRIES_TOTAL)
    )
    backoff_factor = float(
        os.getenv(
            "POLARIS_HTTP_RETRIES_BACKOFF_FACTOR",
            DEFAULT_HTTP_RETRIES_BACKOFF_FACTOR,
        )
    )
    retry_strategy = urllib3.Retry(
        total=total_retries,
        backoff_factor=backoff_factor,
        status_forcelist=HTTP_RETRIES_STATUS_FORCELIST,
    )
    http = urllib3.PoolManager(retries=retry_strategy)
    authorization_provider = _resolve_authorization_provider(base_url, http, timeout)
    catalog_rest = PolarisRestTool(
        name="polaris.rest.catalog",
        description="Shared REST delegate for catalog operations",
        base_url=base_url,
        default_path_prefix="api/catalog/v1/",
        http=http,
        authorization_provider=authorization_provider,
        timeout=timeout,
    )
    management_rest = PolarisRestTool(
        name="polaris.rest.management",
        description="Shared REST delegate for management operations",
        base_url=base_url,
        default_path_prefix="api/management/v1/",
        http=http,
        authorization_provider=authorization_provider,
        timeout=timeout,
    )
    policy_rest = PolarisRestTool(
        name="polaris.rest.policy",
        description="Shared REST delegate for policy operations",
        base_url=base_url,
        default_path_prefix="api/catalog/polaris/v1/",
        http=http,
        authorization_provider=authorization_provider,
        timeout=timeout,
    )

    table_tool = PolarisTableTool(rest_client=catalog_rest)
    namespace_tool = PolarisNamespaceTool(rest_client=catalog_rest)
    principal_tool = PolarisPrincipalTool(rest_client=management_rest)
    principal_role_tool = PolarisPrincipalRoleTool(rest_client=management_rest)
    catalog_role_tool = PolarisCatalogRoleTool(rest_client=management_rest)
    policy_tool = PolarisPolicyTool(rest_client=policy_rest)
    catalog_tool = PolarisCatalogTool(rest_client=management_rest)

    server_version = _resolve_package_version()
    mcp = FastMCP(
        name="polaris-mcp",
        version=server_version,
    )

    @mcp.tool(
        name=table_tool.name,
        description=table_tool.description,
        output_schema=OUTPUT_SCHEMA,
    )
    def polaris_iceberg_table(
        operation: str,
        catalog: str,
        namespace: str | Sequence[str],
        table: str | None = None,
        query: Mapping[str, str | Sequence[str]] | None = None,
        headers: Mapping[str, str | Sequence[str]] | None = None,
        body: Any | None = None,
    ) -> FastMcpToolResult:
        return _call_tool(
            table_tool,
            required={
                "operation": operation,
                "catalog": catalog,
                "namespace": namespace,
            },
            optional={
                "table": table,
                "query": query,
                "headers": headers,
                "body": body,
            },
            transforms={
                "namespace": _normalize_namespace,
                "query": _copy_mapping,
                "headers": _copy_mapping,
                "body": _coerce_body,
            },
        )

    @mcp.tool(
        name=namespace_tool.name,
        description=namespace_tool.description,
        output_schema=OUTPUT_SCHEMA,
    )
    def polaris_namespace_request(
        operation: str,
        catalog: str,
        namespace: str | Sequence[str] | None = None,
        query: Mapping[str, str | Sequence[str]] | None = None,
        headers: Mapping[str, str | Sequence[str]] | None = None,
        body: Any | None = None,
    ) -> FastMcpToolResult:
        return _call_tool(
            namespace_tool,
            required={
                "operation": operation,
                "catalog": catalog,
            },
            optional={
                "namespace": namespace,
                "query": query,
                "headers": headers,
                "body": body,
            },
            transforms={
                "namespace": _normalize_namespace,
                "query": _copy_mapping,
                "headers": _copy_mapping,
                "body": _coerce_body,
            },
        )

    @mcp.tool(
        name=principal_tool.name,
        description=principal_tool.description,
        output_schema=OUTPUT_SCHEMA,
    )
    def polaris_principal_request(
        operation: str,
        principal: str | None = None,
        principalRole: str | None = None,
        query: Mapping[str, str | Sequence[str]] | None = None,
        headers: Mapping[str, str | Sequence[str]] | None = None,
        body: Any | None = None,
    ) -> FastMcpToolResult:
        return _call_tool(
            principal_tool,
            required={"operation": operation},
            optional={
                "principal": principal,
                "principalRole": principalRole,
                "query": query,
                "headers": headers,
                "body": body,
            },
            transforms={
                "query": _copy_mapping,
                "headers": _copy_mapping,
                "body": _coerce_body,
            },
        )

    @mcp.tool(
        name=principal_role_tool.name,
        description=principal_role_tool.description,
        output_schema=OUTPUT_SCHEMA,
    )
    def polaris_principal_role_request(
        operation: str,
        principalRole: str | None = None,
        catalog: str | None = None,
        catalogRole: str | None = None,
        query: Mapping[str, str | Sequence[str]] | None = None,
        headers: Mapping[str, str | Sequence[str]] | None = None,
        body: Any | None = None,
    ) -> FastMcpToolResult:
        return _call_tool(
            principal_role_tool,
            required={"operation": operation},
            optional={
                "principalRole": principalRole,
                "catalog": catalog,
                "catalogRole": catalogRole,
                "query": query,
                "headers": headers,
                "body": body,
            },
            transforms={
                "query": _copy_mapping,
                "headers": _copy_mapping,
                "body": _coerce_body,
            },
        )

    @mcp.tool(
        name=catalog_role_tool.name,
        description=catalog_role_tool.description,
        output_schema=OUTPUT_SCHEMA,
    )
    def polaris_catalog_role_request(
        operation: str,
        catalog: str,
        catalogRole: str | None = None,
        query: Mapping[str, str | Sequence[str]] | None = None,
        headers: Mapping[str, str | Sequence[str]] | None = None,
        body: Any | None = None,
    ) -> FastMcpToolResult:
        return _call_tool(
            catalog_role_tool,
            required={
                "operation": operation,
                "catalog": catalog,
            },
            optional={
                "catalogRole": catalogRole,
                "query": query,
                "headers": headers,
                "body": body,
            },
            transforms={
                "query": _copy_mapping,
                "headers": _copy_mapping,
                "body": _coerce_body,
            },
        )

    @mcp.tool(
        name=policy_tool.name,
        description=policy_tool.description,
        output_schema=OUTPUT_SCHEMA,
    )
    def polaris_policy_request(
        operation: str,
        catalog: str,
        namespace: str | Sequence[str] | None = None,
        policy: str | None = None,
        query: Mapping[str, str | Sequence[str]] | None = None,
        headers: Mapping[str, str | Sequence[str]] | None = None,
        body: Any | None = None,
    ) -> FastMcpToolResult:
        return _call_tool(
            policy_tool,
            required={
                "operation": operation,
                "catalog": catalog,
            },
            optional={
                "namespace": namespace,
                "policy": policy,
                "query": query,
                "headers": headers,
                "body": body,
            },
            transforms={
                "namespace": _normalize_namespace,
                "query": _copy_mapping,
                "headers": _copy_mapping,
                "body": _coerce_body,
            },
        )

    @mcp.tool(
        name=catalog_tool.name,
        description=catalog_tool.description,
        output_schema=OUTPUT_SCHEMA,
    )
    def polaris_catalog_request(
        operation: str,
        catalog: str | None = None,
        query: Mapping[str, str | Sequence[str]] | None = None,
        headers: Mapping[str, str | Sequence[str]] | None = None,
        body: Any | None = None,
    ) -> FastMcpToolResult:
        return _call_tool(
            catalog_tool,
            required={"operation": operation},
            optional={
                "catalog": catalog,
                "query": query,
                "headers": headers,
                "body": body,
            },
            transforms={
                "query": _copy_mapping,
                "headers": _copy_mapping,
                "body": _coerce_body,
            },
        )

    return mcp


def _call_tool(
    tool: Any,
    *,
    required: Mapping[str, Any],
    optional: Mapping[str, Any | None] | None = None,
    transforms: Mapping[str, Any] | None = None,
) -> FastMcpToolResult:
    arguments: MutableMapping[str, Any] = dict(required)
    if optional:
        for key, value in optional.items():
            if value is not None:
                arguments[key] = value
    if transforms:
        for key, transform in transforms.items():
            if key in arguments and arguments[key] is not None:
                arguments[key] = transform(arguments[key])
    return _to_tool_result(tool.call(arguments))


def _to_tool_result(result: ToolExecutionResult) -> FastMcpToolResult:
    structured = {"isError": result.is_error}
    if result.metadata is not None:
        structured["meta"] = result.metadata

    logger.info("Tool call result", extra=structured)

    return FastMcpToolResult(
        content=[TextContent(type="text", text=result.text)],
        structured_content=structured,
    )


def _copy_mapping(
    mapping: Mapping[str, Any] | None,
) -> MutableMapping[str, Any] | None:
    if mapping is None:
        return None
    copied: MutableMapping[str, Any] = {}
    for key, value in mapping.items():
        if value is None:
            continue
        if isinstance(value, (list, tuple)):
            copied[key] = [str(item) for item in value]
        else:
            copied[key] = value
    return copied


def _coerce_body(body: Any) -> Any:
    """Return plain dicts for mapping objects so downstream JSON encoding succeeds."""
    if isinstance(body, Mapping):
        return dict(body)
    return body


def _normalize_namespace(namespace: str | Sequence[str]) -> str | list[str]:
    if isinstance(namespace, str):
        return namespace
    return [str(part) for part in namespace]


def _resolve_base_url() -> str:
    for candidate in (
        os.getenv("POLARIS_BASE_URL"),
        os.getenv("POLARIS_REST_BASE_URL"),
    ):
        if candidate and candidate.strip():
            return _validate_base_url(candidate.strip())
    return _validate_base_url(DEFAULT_BASE_URL)


def _validate_base_url(value: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("Polaris base URL must use http or https.")
    if not parsed.netloc:
        raise ValueError("Polaris base URL must include a hostname.")
    return value


def _resolve_http_timeout() -> urllib3.Timeout:
    def parse_timeout(raw: Optional[str]) -> Optional[float]:
        try:
            return float(raw.strip()) if raw and raw.strip() else None
        except ValueError:
            return None

    default_timeout = parse_timeout(os.getenv("POLARIS_HTTP_TIMEOUT_SECONDS"))
    connect_timeout = (
        parse_timeout(os.getenv("POLARIS_HTTP_CONNECT_TIMEOUT_SECONDS"))
        or default_timeout
        or DEFAULT_HTTP_TIMEOUT
    )
    read_timeout = (
        parse_timeout(os.getenv("POLARIS_HTTP_READ_TIMEOUT_SECONDS"))
        or default_timeout
        or DEFAULT_HTTP_TIMEOUT
    )

    return urllib3.Timeout(connect=connect_timeout, read=read_timeout)


def _resolve_authorization_provider(
    base_url: str, http: urllib3.PoolManager, timeout: urllib3.Timeout
) -> AuthorizationProvider:
    token = _resolve_token()
    if token:
        return StaticAuthorizationProvider(token)

    client_id = _first_non_blank(
        os.getenv("POLARIS_CLIENT_ID"),
    )
    client_secret = _first_non_blank(
        os.getenv("POLARIS_CLIENT_SECRET"),
    )

    if client_id and client_secret:
        scope = _first_non_blank(os.getenv("POLARIS_TOKEN_SCOPE"))
        token_url = _first_non_blank(os.getenv("POLARIS_TOKEN_URL"))
        endpoint = token_url or urljoin(base_url, "api/catalog/v1/oauth/tokens")
        refresh_buffer_seconds = DEFAULT_TOKEN_REFRESH_BUFFER_SECONDS
        refresh_buffer_seconds_str = os.getenv("POLARIS_TOKEN_REFRESH_BUFFER_SECONDS")
        if refresh_buffer_seconds_str:
            try:
                refresh_buffer_seconds = float(refresh_buffer_seconds_str.strip())
            except ValueError:
                pass
        return ClientCredentialsAuthorizationProvider(
            token_endpoint=endpoint,
            client_id=client_id,
            client_secret=client_secret,
            scope=scope,
            http=http,
            refresh_buffer_seconds=refresh_buffer_seconds,
            timeout=timeout,
        )

    return none()


def _resolve_token() -> str | None:
    return _first_non_blank(
        os.getenv("POLARIS_API_TOKEN"),
        os.getenv("POLARIS_BEARER_TOKEN"),
        os.getenv("POLARIS_TOKEN"),
    )


def _first_non_blank(*candidates: str | None) -> str | None:
    for candidate in candidates:
        if candidate and candidate.strip():
            return candidate.strip()
    return None


def _resolve_package_version() -> str:
    try:
        return metadata.version("polaris-mcp")
    except metadata.PackageNotFoundError:
        return "dev"


def main() -> None:
    """Script entry point."""
    config_file = os.getenv("POLARIS_CONFIG_FILE")
    if config_file is None:
        config_file = find_dotenv(".polaris_mcp.env")
    load_dotenv(dotenv_path=config_file)

    logging.config.dictConfig(LOGGING_CONFIG)
    server = create_server()

    parser = argparse.ArgumentParser(description="Run Apache Polaris MCP Server")
    parser.add_argument(
        "--transport",
        choices=["stdio", "sse", "http"],
        default="stdio",
        help="Transport type to use (default: stdio)",
    )
    parser.add_argument(
        "--host",
        default="127.0.0.1",
        help="Host for SSE/HTTP transportS (default: 127.0.0.1)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="Port for SSE/HTTP transports (default: 8000)",
    )
    args = parser.parse_args()

    if args.transport == "stdio":
        logger.info("Starting Apache Polaris MCP server using STDIO transport")
        server.run()
    elif args.transport == "sse":
        logger.info(
            f"Starting Apache Polaris MCP server using SSE transport on http://{args.host}:{args.port}/sse"
        )
        server.run(transport="sse", host=args.host, port=args.port)
    elif args.transport == "http":
        logger.info(
            f"Starting Apache Polaris MCP server using HTTP transport on http://{args.host}:{args.port}/mcp"
        )
        server.run(transport="http", host=args.host, port=args.port, path="/mcp")
    else:
        logger.error(f"Unknown transport: {args.transport}")
        sys.exit(1)


if __name__ == "__main__":  # pragma: no cover
    main()
