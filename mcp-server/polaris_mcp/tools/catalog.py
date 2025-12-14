#
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# for additional information regarding copyright ownership.
# The ASF licenses this file to you under the Apache License,
# Version 2.0 (the "License"); you may not use this file except
# in compliance with the License.  You may obtain a copy of the
# License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
# either express or implied.  See the License for the specific
# language governing permissions and limitations under the License.
#

"""Catalog MCP tool."""

from __future__ import annotations

import copy
from typing import Any, Optional, Set

from polaris_mcp.base import (
    JSONDict,
    McpTool,
    ToolExecutionResult,
    copy_if_object,
    require_text,
)
from polaris_mcp.rest import PolarisRestTool, encode_path_segment


class PolarisCatalogTool(McpTool):
    """Interact with the Polaris management API for catalog lifecycle operations."""

    TOOL_NAME = "polaris-catalog-request"
    TOOL_DESCRIPTION = "Perform catalog operations (list, get, create, update, delete)."

    LIST_ALIASES: Set[str] = {"list", "ls"}
    GET_ALIASES: Set[str] = {"get", "load", "fetch"}
    CREATE_ALIASES: Set[str] = {"create"}
    UPDATE_ALIASES: Set[str] = {"update"}
    DELETE_ALIASES: Set[str] = {"delete", "drop", "remove"}

    def __init__(self, rest_client: PolarisRestTool) -> None:
        self._rest_client = rest_client

    @property
    def name(self) -> str:
        return self.TOOL_NAME

    @property
    def description(self) -> str:
        return self.TOOL_DESCRIPTION

    def input_schema(self) -> JSONDict:
        return {
            "type": "object",
            "properties": {
                "operation": {
                    "type": "string",
                    "enum": ["list", "get", "create", "update", "delete"],
                    "description": (
                        "Catalog operation to execute. Supported values: list, get, create, update, delete."
                    ),
                },
                "catalog": {
                    "type": "string",
                    "description": (
                        "Catalog name (required for get, update, delete). Automatically appended to the path."
                    ),
                },
                "query": {
                    "type": "object",
                    "description": "Optional query parameters.",
                    "additionalProperties": {"type": "string"},
                },
                "headers": {
                    "type": "object",
                    "description": "Optional request headers.",
                    "additionalProperties": {"type": "string"},
                },
                "body": {
                    "type": "object",
                    "description": (
                        "Optional request body payload for create/update. See polaris-management-service.yml."
                    ),
                },
            },
            "required": ["operation"],
        }

    def call(self, arguments: Any) -> ToolExecutionResult:
        if not isinstance(arguments, dict):
            raise ValueError("Tool arguments must be a JSON object.")

        operation = require_text(arguments, "operation").lower().strip()
        normalized = self._normalize_operation(operation)

        delegate_args: JSONDict = {}
        copy_if_object(arguments.get("query"), delegate_args, "query")
        copy_if_object(arguments.get("headers"), delegate_args, "headers")

        realm = arguments.get("realm")
        if isinstance(realm, str) and realm.strip():
            delegate_args["realm"] = realm

        if normalized == "list":
            self._handle_list(delegate_args)
        elif normalized == "get":
            self._handle_get(arguments, delegate_args)
        elif normalized == "create":
            self._handle_create(arguments, delegate_args)
        elif normalized == "update":
            self._handle_update(arguments, delegate_args)
        elif normalized == "delete":
            self._handle_delete(arguments, delegate_args)
        else:  # pragma: no cover
            raise ValueError(f"Unsupported operation: {operation}")

        raw = self._rest_client.call(delegate_args)
        return self._maybe_augment_error(raw, normalized)

    def _handle_list(self, delegate_args: JSONDict) -> None:
        delegate_args["method"] = "GET"
        delegate_args["path"] = "catalogs"

    def _handle_get(self, arguments: dict, delegate_args: JSONDict) -> None:
        catalog_name = encode_path_segment(require_text(arguments, "catalog"))
        delegate_args["method"] = "GET"
        delegate_args["path"] = f"catalogs/{catalog_name}"

    def _handle_create(self, arguments: dict, delegate_args: JSONDict) -> None:
        body = arguments.get("body")
        if not isinstance(body, dict):
            raise ValueError(
                "Create operations require a body matching CreateCatalogRequest."
            )
        delegate_args["method"] = "POST"
        delegate_args["path"] = "catalogs"
        delegate_args["body"] = copy.deepcopy(body)

    def _handle_update(self, arguments: dict, delegate_args: JSONDict) -> None:
        catalog_name = encode_path_segment(require_text(arguments, "catalog"))
        body = arguments.get("body")
        if not isinstance(body, dict):
            raise ValueError(
                "Update operations require a body matching UpdateCatalogRequest."
            )
        delegate_args["method"] = "PUT"
        delegate_args["path"] = f"catalogs/{catalog_name}"
        delegate_args["body"] = copy.deepcopy(body)

    def _handle_delete(self, arguments: dict, delegate_args: JSONDict) -> None:
        catalog_name = encode_path_segment(require_text(arguments, "catalog"))
        delegate_args["method"] = "DELETE"
        delegate_args["path"] = f"catalogs/{catalog_name}"

    def _maybe_augment_error(
        self, result: ToolExecutionResult, operation: str
    ) -> ToolExecutionResult:
        if not result.is_error:
            return result
        metadata = copy.deepcopy(result.metadata) if result.metadata is not None else {}
        status = int(metadata.get("response", {}).get("status", -1))
        if status not in (400, 409):
            return result

        hint: Optional[str] = None
        if operation == "create":
            hint = (
                "Create requests must include catalog configuration in the body. "
                "See CreateCatalogRequest in spec/polaris-management-service.yml."
            )
        elif operation == "update":
            hint = (
                "Update requests require the catalog name in the path and body matching UpdateCatalogRequest. "
                "Ensure currentEntityVersion matches the latest catalog version."
            )

        if not hint:
            return result

        metadata["hint"] = hint
        text = result.text
        if hint not in text:
            text = f"{text}\nHint: {hint}"
        return ToolExecutionResult(text=text, is_error=True, metadata=metadata)

    def _normalize_operation(self, operation: str) -> str:
        if operation in self.LIST_ALIASES:
            return "list"
        if operation in self.GET_ALIASES:
            return "get"
        if operation in self.CREATE_ALIASES:
            return "create"
        if operation in self.UPDATE_ALIASES:
            return "update"
        if operation in self.DELETE_ALIASES:
            return "delete"
        raise ValueError(f"Unsupported operation: {operation}")
