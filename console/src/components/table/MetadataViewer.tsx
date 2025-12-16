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

import type { TableMetadata } from "@/types/api"

interface MetadataViewerProps {
  metadata: TableMetadata
  metadataLocation?: string | null
}

export function MetadataViewer({ metadata, metadataLocation }: MetadataViewerProps) {
  return (
    <div className="space-y-6">
      <section>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <InfoRow label="UUID" value={metadata["table-uuid"]} mono />
          <InfoRow label="Format Version" value={String(metadata["format-version"])} />
          {metadata.location && <InfoRow label="Location" value={metadata.location} mono />}
          {metadataLocation && <InfoRow label="Metadata Location" value={metadataLocation} mono />}
        </div>
      </section>

      {metadata.properties && Object.keys(metadata.properties).length > 0 && (
        <section>
          <h3 className="text-sm font-semibold mb-2">Properties</h3>
          <div className="border rounded-md">
            <div className="divide-y">
              {Object.entries(metadata.properties).map(([key, value]) => (
                <div key={key} className="px-3 py-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">{key}:</span>
                  <span className="font-mono text-xs break-all">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {metadata["partition-specs"] && metadata["partition-specs"].length > 0 && (
        <section>
          <h3 className="text-sm font-semibold mb-2">Partition Specifications</h3>
          <div className="space-y-2">
            {metadata["partition-specs"].map((spec) => (
              <div key={spec["spec-id"]} className="border rounded-md p-3 text-sm">
                <div className="font-medium mb-2">
                  Spec ID: {spec["spec-id"]}
                  {spec["spec-id"] === metadata["default-spec-id"] && (
                    <span className="ml-2 text-xs text-muted-foreground">(default)</span>
                  )}
                </div>
                {spec.fields.length > 0 ? (
                  <div className="space-y-1">
                    {spec.fields.map((field, idx) => (
                      <div key={idx} className="text-xs">
                        <span className="font-mono">{field.name}</span>{" "}
                        <span className="text-muted-foreground">{field.transform}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground italic">No partition fields</div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div>
      <label className="text-sm font-medium text-muted-foreground">{label}</label>
      <p className={`mt-1 text-sm ${mono ? "font-mono break-all" : ""}`}>{value}</p>
    </div>
  )
}

export default MetadataViewer


