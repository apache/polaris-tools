import type { TableSchema } from "@/types/api"
import { TableSchemaDisplay } from "@/components/catalog/TableSchemaDisplay"

interface SchemaViewerProps {
  schema: TableSchema
}

export function SchemaViewer({ schema }: SchemaViewerProps) {
  return <TableSchemaDisplay schema={schema} />
}

export default SchemaViewer


