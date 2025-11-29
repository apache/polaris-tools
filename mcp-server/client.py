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

"""Local client for the Polaris MCP server."""

from fastmcp import Client
import asyncio
import argparse
import json
import sys
from typing import Any, Optional


async def _prompt(prompt: str, parse_json: bool = False) -> Optional[Any]:
    while True:
        user_input = await asyncio.to_thread(input, f"{prompt}: ")
        user_input = user_input.strip()
        if not user_input:
            return None
        if not parse_json:
            return user_input
        try:
            return json.loads(user_input)
        except json.JSONDecodeError:
            print("Invalid JSON. Please try again.")


async def _prompt_for_argument(arg_name: str, schema_property: dict, is_required: bool) -> Any:
    description = schema_property.get("description", "")
    arg_type = schema_property.get("type", "string")
    enum_values = schema_property.get("enum")
    enum_str = ", ".join(enum_values) if enum_values else ""

    # Build prompt
    parts = [f"Enter value for '{arg_name}'"]
    if description:
        parts.append(f"({description})")
    if is_required:
        parts.append("[REQUIRED]")
    if enum_values:
        parts.append(f"(options: {enum_str})")
    prompt = " ".join(parts)
    # Handle JSON input
    if arg_type == "object":
        return await _prompt(prompt, parse_json=True)
    # Handle primitive types
    while True:
        value = await _prompt(prompt)
        if is_required and not value:
            print(f"{arg_name} is required.")
            continue
        if value and enum_values:
            if value in enum_values:
                return value
            print(f"Invalid option. Please choose from: {enum_str}")
            continue
        return value


async def _display(result: Any) -> None:
    for content in result.content:
        print(content.text if content.type == "text" else content.type)
    if result.meta:
        print("--- Meta ---")
        print(json.dumps(result.meta, indent=2))


async def _run_session(session: Any, args: argparse.Namespace) -> None:
    def list_tools(tools):
        print("Available Tools:")
        for tool in tools:
            print(f"- {tool.name}: {tool.description}")

    # CLI mode
    if args.tool:
        tool_args = {}
        if args.args:
            try:
                tool_args = json.loads(args.args)
            except json.JSONDecodeError:
                print("Error: --args must be a valid JSON string.")
                sys.exit(1)
        elif args.args_file:
            try:
                with open(args.args_file) as f:
                    tool_args = json.load(f)
            except (FileNotFoundError, json.JSONDecodeError) as e:
                print(f"Error reading args file: {e}")
                sys.exit(1)
        try:
            result = await session.call_tool(args.tool, tool_args)
            await _display(result)
        except Exception as e:
            print(f"Error running tool '{args.tool}': {e}")
            sys.exit(1)
        return
    # Interactive mode
    tools = await session.list_tools()
    if not tools:
        print("No tools available on the MCP server.")
        return
    list_tools(tools)
    while True:
        print("-"*20)
        print("Select a tool by name, 'r' to refresh, 'q' to quit: ", end="", flush=True)
        choice = (await asyncio.to_thread(sys.stdin.readline)).strip()
        if choice.lower() == "q":
            break
        if choice.lower() == "r":
            print("Refreshing tool list...")
            tools = await session.list_tools()
            list_tools(tools)
            continue
        selected_tool = next(
            (tool for tool in tools if tool.name.lower() == choice.lower()), None
        )
        if not selected_tool:
            print(f"Tool '{choice}' not found. Please try again.")
            continue
        # Argument for interactive mode
        input_schema = selected_tool.inputSchema
        props = input_schema.get("properties", {})
        required = input_schema.get("required", [])
        arguments = {}
        if required:
            print("\n--- Required Arguments ---")
            for arg_name in required:
                schema = props.get(arg_name, {})
                value = await _prompt_for_argument(arg_name, schema, is_required=True)
                if value:
                    arguments[arg_name] = value
        optional_args = {k:v for k, v in props.items() if k not in required}
        if optional_args:
            print("\n--- Optional Arguments ---")
            for arg_name, schema in optional_args.items():
                value = await _prompt_for_argument(arg_name, schema, is_required=False)
                if value:
                    arguments[arg_name] = value
        print(
            f"\nRunning tool '{selected_tool.name}' with arguments:\n"
            f"{json.dumps(arguments, indent=2)}"
        )
        try:
            result = await session.call_tool(selected_tool.name, arguments)
            await _display(result)
        except Exception as e:
            print(f"Error running tool '{selected_tool.name}': {e}")


async def run():
    parser = argparse.ArgumentParser(description="Polaris MCP Client")
    parser.add_argument("server", help="MCP server. Can be a local .py file, or an HTTP/SSE URL.")
    parser.add_argument("--tool", help="Tool to run directly (skips interactive mode).")
    parser.add_argument("--args", help="JSON string of arguments for the tool (used with --tool).")
    parser.add_argument("--args-file", help="Path to JSON file with arguments for the tool (used with --tool).")
    args = parser.parse_args()
    server = args.server.strip()
    if not (server.endswith(".py") or server.startswith(("http://", "https://"))):
        print(f"Error: '{server}' must be a .py file or an URL.")
        sys.exit(1)
    async with Client(server) as session:
        await _run_session(session, args)

if __name__ == "__main__":
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        print("\nExiting...")
        sys.exit(0)
