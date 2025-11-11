import type { TableSchema } from "@/types/api"

interface TableSchemaDisplayProps {
  schema: TableSchema
}

export function TableSchemaDisplay({ schema }: TableSchemaDisplayProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold mb-2">Schema</h3>
      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-left font-medium">Type</th>
              <th className="px-3 py-2 text-center font-medium">Required</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {schema.fields && schema.fields.length > 0 ? (
              schema.fields.map((field, idx) => (
                <tr key={idx} className="hover:bg-muted/50">
                  <td className="px-3 py-2 font-mono text-xs">{field.name}</td>
                  <td className="px-3 py-2 text-xs">{formatFieldType(field)}</td>
                  <td className="px-3 py-2 text-center">
                    {field.required ? (
                      <span className="text-xs text-destructive">Yes</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">No</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="px-3 py-2 text-sm text-muted-foreground italic text-center">
                  No fields defined
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function formatFieldType(field: {
  type: string | { type: string; [key: string]: unknown }
  [key: string]: unknown
}): string {
  if (typeof field.type === "string") {
    return field.type
  }
  
  if (typeof field.type === "object" && field.type !== null) {
    // Handle nested types like list, map, struct
    if (field.type.type === "list") {
      const elementType = formatFieldType({
        type: (field.type as { element?: unknown }).element || "unknown",
      })
      return `list<${elementType}>`
    }
    
    if (field.type.type === "map") {
      const keyType = formatFieldType({
        type: (field.type as { key?: unknown }).key || "unknown",
      })
      const valueType = formatFieldType({
        type: (field.type as { value?: unknown }).value || "unknown",
      })
      return `map<${keyType}, ${valueType}>`
    }
    
    if (field.type.type === "struct") {
      const fields = (field.type as { fields?: Array<{ name: string; type: unknown }> })
        .fields || []
      const fieldTypes = fields.map((f) => `${f.name}: ${formatFieldType({ type: f.type })}`)
      return `struct<${fieldTypes.join(", ")}>`
    }
    
    return JSON.stringify(field.type)
  }
  
  return "unknown"
}

