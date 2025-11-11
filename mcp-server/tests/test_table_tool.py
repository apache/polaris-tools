"""Unit tests for ``polaris_mcp.tools.table``."""

from __future__ import annotations

import unittest
from unittest import mock

from polaris_mcp.base import ToolExecutionResult
from polaris_mcp.tools.table import PolarisTableTool


class PolarisTableToolOperationsTest(unittest.TestCase):
    def _build_tool(self, mock_rest: mock.Mock) -> tuple[PolarisTableTool, mock.Mock]:
        delegate = mock.Mock()
        delegate.call.return_value = ToolExecutionResult(text="ok", is_error=False, metadata={"k": "v"})
        mock_rest.return_value = delegate
        tool = PolarisTableTool("https://polaris/", mock.sentinel.http, mock.sentinel.auth)
        return tool, delegate

    @mock.patch("polaris_mcp.tools.table.PolarisRestTool")
    def test_list_operation_uses_get_and_copies_query_and_headers(self, mock_rest: mock.Mock) -> None:
        tool, delegate = self._build_tool(mock_rest)
        arguments = {
            "operation": "LS",
            "catalog": "prod west",
            "namespace": ["  analytics", "daily "],
            "query": {"page-size": "200"},
            "headers": {"Prefer": "return=representation"},
        }

        result = tool.call(arguments)

        self.assertIs(result, delegate.call.return_value)
        delegate.call.assert_called_once()
        payload = delegate.call.call_args.args[0]
        self.assertEqual(payload["method"], "GET")
        self.assertEqual(payload["path"], "prod%20west/namespaces/analytics%1Fdaily/tables")
        self.assertEqual(payload["query"], {"page-size": "200"})
        self.assertIsNot(payload["query"], arguments["query"])
        self.assertEqual(payload["headers"], {"Prefer": "return=representation"})
        self.assertIsNot(payload["headers"], arguments["headers"])

    @mock.patch("polaris_mcp.tools.table.PolarisRestTool")
    def test_get_operation_accepts_alias_and_encodes_table(self, mock_rest: mock.Mock) -> None:
        tool, delegate = self._build_tool(mock_rest)
        arguments = {
            "operation": "fetch",
            "catalog": "prod",
            "namespace": [" core ", "sales"],
            "table": "Daily Metrics",
        }

        tool.call(arguments)

        delegate.call.assert_called_once()
        payload = delegate.call.call_args.args[0]
        self.assertEqual(payload["method"], "GET")
        self.assertEqual(payload["path"], "prod/namespaces/core%1Fsales/tables/Daily%20Metrics")
        self.assertNotIn("body", payload)

    @mock.patch("polaris_mcp.tools.table.PolarisRestTool")
    def test_get_operation_requires_table_argument(self, mock_rest: mock.Mock) -> None:
        tool, _ = self._build_tool(mock_rest)

        with self.assertRaisesRegex(ValueError, "Table name is required"):
            tool.call({"operation": "get", "catalog": "prod", "namespace": "analytics"})

    @mock.patch("polaris_mcp.tools.table.PolarisRestTool")
    def test_create_operation_deep_copies_request_body(self, mock_rest: mock.Mock) -> None:
        tool, delegate = self._build_tool(mock_rest)
        body = {"table": "t1", "properties": {"schema-id": 1}}
        tool.call(
            {
                "operation": "create",
                "catalog": "prod",
                "namespace": "analytics",
                "body": body,
            }
        )

        delegate.call.assert_called_once()
        payload = delegate.call.call_args.args[0]
        self.assertEqual(payload["method"], "POST")
        self.assertEqual(payload["path"], "prod/namespaces/analytics/tables")
        self.assertEqual(payload["body"], {"table": "t1", "properties": {"schema-id": 1}})
        self.assertIsNot(payload["body"], body)
        self.assertIsNot(payload["body"]["properties"], body["properties"])

        body["properties"]["schema-id"] = 99
        self.assertEqual(payload["body"]["properties"]["schema-id"], 1)

    @mock.patch("polaris_mcp.tools.table.PolarisRestTool")
    def test_create_operation_requires_body(self, mock_rest: mock.Mock) -> None:
        tool, _ = self._build_tool(mock_rest)

        with self.assertRaisesRegex(ValueError, "Create operations require"):
            tool.call({"operation": "create", "catalog": "prod", "namespace": "analytics"})

    @mock.patch("polaris_mcp.tools.table.PolarisRestTool")
    def test_commit_operation_requires_table_and_body(self, mock_rest: mock.Mock) -> None:
        tool, _ = self._build_tool(mock_rest)

        with self.assertRaisesRegex(ValueError, "Table name is required"):
            tool.call(
                {
                    "operation": "commit",
                    "catalog": "prod",
                    "namespace": "analytics",
                    "body": {"changes": []},
                }
            )

        with self.assertRaisesRegex(ValueError, "Commit operations require"):
            tool.call(
                {
                    "operation": "commit",
                    "catalog": "prod",
                    "namespace": "analytics",
                    "table": "t1",
                }
            )

    @mock.patch("polaris_mcp.tools.table.PolarisRestTool")
    def test_commit_operation_post_request_with_body_copy(self, mock_rest: mock.Mock) -> None:
        tool, delegate = self._build_tool(mock_rest)
        body = {"changes": [{"type": "append", "snapshot-id": 5}]}

        tool.call(
            {
                "operation": "update",
                "catalog": "prod",
                "namespace": "analytics",
                "table": "metrics",
                "body": body,
            }
        )

        delegate.call.assert_called_once()
        payload = delegate.call.call_args.args[0]
        self.assertEqual(payload["method"], "POST")
        self.assertEqual(payload["path"], "prod/namespaces/analytics/tables/metrics")
        self.assertEqual(
            payload["body"], {"changes": [{"type": "append", "snapshot-id": 5}]}
        )
        self.assertIsNot(payload["body"], body)
        self.assertIsNot(payload["body"]["changes"], body["changes"])

        body["changes"][0]["snapshot-id"] = 42
        self.assertEqual(payload["body"]["changes"][0]["snapshot-id"], 5)

    @mock.patch("polaris_mcp.tools.table.PolarisRestTool")
    def test_delete_operation_uses_alias_and_encodes_table(self, mock_rest: mock.Mock) -> None:
        tool, delegate = self._build_tool(mock_rest)

        tool.call(
            {
                "operation": "drop",
                "catalog": "prod",
                "namespace": "analytics",
                "table": "fact daily",
            }
        )

        delegate.call.assert_called_once()
        payload = delegate.call.call_args.args[0]
        self.assertEqual(payload["method"], "DELETE")
        self.assertEqual(payload["path"], "prod/namespaces/analytics/tables/fact%20daily")

    @mock.patch("polaris_mcp.tools.table.PolarisRestTool")
    def test_namespace_validation_rejects_blank_values(self, mock_rest: mock.Mock) -> None:
        tool, _ = self._build_tool(mock_rest)

        with self.assertRaisesRegex(ValueError, "Namespace must be provided"):
            tool.call({"operation": "list", "catalog": "prod", "namespace": None})

        with self.assertRaisesRegex(ValueError, "Namespace array must contain"):
            tool.call({"operation": "list", "catalog": "prod", "namespace": []})

        with self.assertRaisesRegex(ValueError, "Namespace array elements"):
            tool.call({"operation": "list", "catalog": "prod", "namespace": ["ok", " "]})


if __name__ == "__main__":
    unittest.main()
