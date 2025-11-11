import { useQuery } from "@tanstack/react-query"
import { catalogsApi } from "@/api/management/catalogs"
import { principalsApi } from "@/api/management/principals"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Sparkles } from "lucide-react"

export function Home() {
  const { data: catalogs } = useQuery({
    queryKey: ["catalogs"],
    queryFn: () => catalogsApi.list(),
  })

  const { data: principals } = useQuery({
    queryKey: ["principals"],
    queryFn: () => principalsApi.list(),
  })

  return (
    <div className="space-y-8 p-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          Get started with Polaris Catalog
        </h1>
      </div>

      {/* Overview Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            Easily manage and secure Iceberg tables and catalogs with the{" "}
            <span className="text-green-600 dark:text-green-400">open source Polaris Catalog</span>.
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Polaris Catalog is an open source catalog for Apache Iceberg. Built on
            the open standard Apache Iceberg REST catalog protocol, Polaris Catalog
            allows multiple engines to read and write Iceberg tables while
            consistently managing security for all queries from all engines.
          </p>
          <div className="flex items-center justify-end">
            <Sparkles className="h-24 w-24 text-primary/20" />
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Catalogs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {catalogs?.length ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Connections</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {principals?.length ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Principals</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {principals?.length ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      
    </div>
  )
}

