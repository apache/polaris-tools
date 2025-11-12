"""Unit tests for ``polaris_mcp.tools.namespace``."""

from __future__ import annotations

import unittest
from unittest import mock

from polaris_mcp.base import ToolExecutionResult
from polaris_mcp.tools.namespace import PolarisNamespaceTool


class PolarisNamespaceToolTest(unittest.TestCase):
    def _build_tool(self, mock_rest: mock.Mock) -> tuple[PolarisNamespaceTool, mock.Mock]:
        delegate = mock.Mock()
        delegate.call.return_value = ToolExecutionResult(text="done", is_error=False)
        mock_rest.return_value = delegate
        tool = PolarisNamespaceTool("https://polaris/", mock.sentinel.http, mock.sentinel.auth)
        return tool, delegate

    @mock.patch("polaris_mcp.tools.namespace.PolarisRestTool")
    def test_get_operation_encodes_namespace_with_unit_separator(self, mock_rest: mock.Mock) -> None:
        tool, delegate = self._build_tool(mock_rest)

        tool.call(
            {
                "operation": "get",
                "catalog": "prod",
                "namespace": [" analytics", "daily "],
            }
        )

        delegate.call.assert_called_once()
        payload = delegate.call.call_args.args[0]
        self.assertEqual(payload["method"], "GET")
        self.assertEqual(payload["path"], "prod/namespaces/analytics%1Fdaily")

    @mock.patch("polaris_mcp.tools.namespace.PolarisRestTool")
    def test_create_operation_infers_namespace_array_from_string(self, mock_rest: mock.Mock) -> None:
        tool, delegate = self._build_tool(mock_rest)
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
        self.assertEqual(payload["method"], "POST")
        self.assertEqual(payload["path"], "prod/namespaces")
        self.assertEqual(payload["body"]["namespace"], ["analytics", "daily"])
        self.assertIsNot(payload["body"], body)
        self.assertIsNot(payload["body"]["properties"], body["properties"])
        body["properties"]["owner"] = "changed"
        self.assertEqual(payload["body"]["properties"]["owner"], "analytics")

if __name__ == "__main__":
    unittest.main()
