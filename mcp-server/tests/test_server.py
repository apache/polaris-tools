"""Unit tests for ``polaris_mcp.server`` helpers."""

from __future__ import annotations

import os
import pytest
from collections import UserDict
from importlib import metadata
from unittest import mock

from polaris_mcp import server
from polaris_mcp.base import ToolExecutionResult


class TestServerHelpers:
    def test_call_tool_merges_arguments_and_applies_transforms(self) -> None:
        captured: dict[str, object] = {}

        class DummyTool:
            def call(self, arguments: dict[str, object]) -> ToolExecutionResult:
                captured["arguments"] = arguments
                return ToolExecutionResult(
                    text="done", is_error=False, metadata={"x": 1}
                )

        tool = DummyTool()
        sentinel = object()
        with mock.patch(
            "polaris_mcp.server._to_tool_result", return_value=sentinel
        ) as mock_to_result:
            result = server._call_tool(
                tool,
                required={"operation": "GET", "catalog": "prod"},
                optional={
                    "namespace": ("db", 1),
                    "table": None,
                    "query": {"limit": 10, "filter": None},
                },
                transforms={
                    "namespace": server._normalize_namespace,
                    "query": server._copy_mapping,
                },
            )

        assert result is sentinel
        assert captured["arguments"] == {
            "operation": "GET",
            "catalog": "prod",
            "namespace": ["db", "1"],
            "query": {"limit": 10},
        }
        mock_to_result.assert_called_once()
        tool_result_arg = mock_to_result.call_args.args[0]
        assert isinstance(tool_result_arg, ToolExecutionResult)
        assert tool_result_arg.text == "done"

    def test_copy_mapping_filters_none_and_normalizes_sequences(self) -> None:
        source = {"a": "keep", "b": None, "c": ["one", 2], "d": ("x", 3)}
        copied = server._copy_mapping(source)

        assert copied == {
            "a": "keep",
            "c": ["one", "2"],
            "d": ["x", "3"],
        }
        assert copied is not source
        assert server._copy_mapping(None) is None

    def test_normalize_namespace_accepts_text_and_sequences(self) -> None:
        assert server._normalize_namespace("analytics") == "analytics"
        assert server._normalize_namespace(("db", 23)) == ["db", "23"]

    def test_resolve_base_url_prefers_env_vars(self) -> None:
        with mock.patch.dict(
            os.environ,
            {
                "POLARIS_BASE_URL": " https://primary/ ",
                "POLARIS_REST_BASE_URL": "https://secondary/",
            },
            clear=True,
        ):
            assert server._resolve_base_url() == "https://primary/"

        with mock.patch.dict(
            os.environ,
            {"POLARIS_REST_BASE_URL": "https://secondary/"},
            clear=True,
        ):
            assert server._resolve_base_url() == "https://secondary/"

        with mock.patch.dict(
            os.environ,
            {"POLARIS_BASE_URL": "  ", "POLARIS_REST_BASE_URL": "https://secondary/"},
            clear=True,
        ):
            assert server._resolve_base_url() == "https://secondary/"

        with mock.patch.dict(os.environ, {}, clear=True):
            assert server._resolve_base_url() == server.DEFAULT_BASE_URL

    def test_resolve_base_url_validates_scheme_and_host(self) -> None:
        with mock.patch.dict(
            os.environ,
            {"POLARIS_BASE_URL": "ftp://legacy"},
            clear=True,
        ):
            with pytest.raises(ValueError, match="http or https"):
                server._resolve_base_url()

        with mock.patch.dict(
            os.environ,
            {"POLARIS_BASE_URL": "http://"},
            clear=True,
        ):
            with pytest.raises(ValueError, match="hostname"):
                server._resolve_base_url()

    def test_first_non_blank_returns_first_usable_value(self) -> None:
        assert server._first_non_blank(None, "  ", "\tvalue", "later") == "value"
        assert server._first_non_blank(None) is None

    def test_resolve_token_checks_multiple_env_variables(self) -> None:
        with mock.patch.dict(
            os.environ,
            {
                "POLARIS_API_TOKEN": " ",
                "POLARIS_BEARER_TOKEN": "token-b",
                "POLARIS_TOKEN": "token-c",
            },
            clear=True,
        ):
            assert server._resolve_token() == "token-b"

    def test_coerce_body_returns_plain_dict_for_mappings(self) -> None:
        user_dict = UserDict({"a": 1})
        assert server._coerce_body(user_dict) == {"a": 1}
        sequence = [1, 2]
        assert server._coerce_body(sequence) is sequence

    def test_to_tool_result_builds_fastmcp_payload_with_metadata(self) -> None:
        execution = ToolExecutionResult(
            text="ok", is_error=True, metadata={"foo": "bar"}
        )
        text_instance = object()
        fast_instance = object()
        with (
            mock.patch(
                "polaris_mcp.server.TextContent", return_value=text_instance
            ) as mock_text,
            mock.patch(
                "polaris_mcp.server.FastMcpToolResult", return_value=fast_instance
            ) as mock_result,
        ):
            output = server._to_tool_result(execution)

        assert output is fast_instance
        mock_text.assert_called_once_with(type="text", text="ok")
        mock_result.assert_called_once_with(
            content=[text_instance],
            structured_content={"isError": True, "meta": {"foo": "bar"}},
        )

    def test_to_tool_result_omits_meta_when_not_provided(self) -> None:
        execution = ToolExecutionResult(text="hello", is_error=False, metadata=None)
        with (
            mock.patch("polaris_mcp.server.TextContent") as mock_text,
            mock.patch("polaris_mcp.server.FastMcpToolResult") as mock_result,
        ):
            server._to_tool_result(execution)

        mock_text.assert_called_once_with(type="text", text="hello")
        structured = mock_result.call_args.kwargs["structured_content"]
        assert structured == {"isError": False}

    def test_resolve_package_version_uses_metadata_and_handles_missing(self) -> None:
        with mock.patch("polaris_mcp.server.metadata.version", return_value="2.0.0"):
            assert server._resolve_package_version() == "2.0.0"

        with mock.patch(
            "polaris_mcp.server.metadata.version",
            side_effect=metadata.PackageNotFoundError,
        ):
            assert server._resolve_package_version() == "dev"


class TestAuthorizationProviderResolution:
    def test_resolve_authorization_provider_uses_token_when_available(self) -> None:
        fake_http = object()
        with (
            mock.patch("polaris_mcp.server._resolve_token", return_value="abc"),
            mock.patch.dict(os.environ, {}, clear=True),
        ):
            provider = server._resolve_authorization_provider(
                "https://base/", fake_http
            )

        assert isinstance(provider, server.StaticAuthorizationProvider)
        assert provider.authorization_header() == "Bearer abc"

    def test_resolve_authorization_provider_uses_client_credentials(self) -> None:
        fake_http = object()
        fake_provider = object()
        with (
            mock.patch("polaris_mcp.server._resolve_token", return_value=None),
            mock.patch.dict(
                os.environ,
                {
                    "POLARIS_CLIENT_ID": " client ",
                    "POLARIS_CLIENT_SECRET": "secret",
                    "POLARIS_TOKEN_SCOPE": " scope ",
                    "POLARIS_TOKEN_URL": "https://oauth/token",
                },
                clear=True,
            ),
            mock.patch(
                "polaris_mcp.server.ClientCredentialsAuthorizationProvider",
                return_value=fake_provider,
            ) as mock_factory,
        ):
            provider = server._resolve_authorization_provider(
                "https://base/", fake_http
            )

        assert provider is fake_provider
        mock_factory.assert_called_once_with(
            token_endpoint="https://oauth/token",
            client_id="client",
            client_secret="secret",
            scope="scope",
            http=fake_http,
        )
