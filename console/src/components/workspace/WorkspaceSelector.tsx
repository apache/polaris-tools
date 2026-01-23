/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Workspace } from "@/types/workspaces"

interface WorkspaceSelectorProps {
  workspaces: Workspace[]
  selectedWorkspace: Workspace | null
  onSelectWorkspace: (workspace: Workspace) => void
}

export function WorkspaceSelector({
  workspaces,
  selectedWorkspace,
  onSelectWorkspace,
}: WorkspaceSelectorProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="workspace">Select a workspace</Label>
      <Select
        value={selectedWorkspace?.name}
        onValueChange={(name) => {
          const workspace = workspaces.find(ws => ws.name === name)
          if (workspace) {
            onSelectWorkspace(workspace)
          }
        }}
      >
        <SelectTrigger id="workspace">
          <SelectValue placeholder="Select workspace" />
        </SelectTrigger>
        <SelectContent>
          {workspaces.map((workspace) => (
            <SelectItem key={workspace.name} value={workspace.name}>
                {workspace.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

