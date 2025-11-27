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

"""Unit tests for configuration loading."""

import os
import textwrap
from unittest import mock
from polaris_mcp import server

def test_main_loads_dotenv() -> None:
    with (
        mock.patch("polaris_mcp.server.load_dotenv") as mock_load_dotenv,
        mock.patch("polaris_mcp.server.create_server") as mock_create_server,
        mock.patch.dict(os.environ, {}, clear=True),
    ):
        mock_server_instance = mock_create_server.return_value
        
        server.main()
        
        mock_load_dotenv.assert_called_once_with(dotenv_path=None)
        mock_create_server.assert_called_once()
        mock_server_instance.run.assert_called_once()

def test_main_loads_custom_config_file() -> None:
    with (
        mock.patch("polaris_mcp.server.load_dotenv") as mock_load_dotenv,
        mock.patch("polaris_mcp.server.create_server") as mock_create_server,
        mock.patch.dict(os.environ, {"POLARIS_CONFIG_FILE": "/path/to/config.env"}, clear=True),
    ):
        mock_server_instance = mock_create_server.return_value
        
        server.main()
        
        mock_load_dotenv.assert_called_once_with(dotenv_path="/path/to/config.env")
        mock_create_server.assert_called_once()
        mock_server_instance.run.assert_called_once()

def test_config_loading_precedence(tmp_path) -> None:
    config_file = tmp_path / "test_config.env"
    config_file.write_text(
        textwrap.dedent("""
            POLARIS_BASE_URL=http://remote:8181/
            POLARIS_CLIENT_ID=file-client-id
        """).strip()
    )
    
    with (
        mock.patch("polaris_mcp.server.create_server") as mock_create_server,
        mock.patch.dict(os.environ, {
            "POLARIS_CONFIG_FILE": str(config_file),
            "POLARIS_BASE_URL": "http://localhost:8181/",
        }, clear=True),
    ):
        server.main()
        # Env vars take precedence over config file values
        assert os.environ["POLARIS_BASE_URL"] == "http://localhost:8181/"
        assert os.environ["POLARIS_CLIENT_ID"] == "file-client-id"

