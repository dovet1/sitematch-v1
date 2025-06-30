import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex mb-8">
        <p className="fixed left-0 top-0 flex w-full justify-center border-b border-border bg-gradient-to-b from-background pb-6 pt-8 backdrop-blur-2xl lg:static lg:w-auto lg:rounded-xl lg:border lg:bg-muted lg:p-4">
          SiteMatch Commercial Directory
        </p>
      </div>

      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight">
          Welcome to SiteMatch
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Find and list commercial properties and businesses in your area
        </p>
        <div className="flex gap-4 justify-center">
          <Button size="lg">Browse Directory</Button>
          <Button variant="outline" size="lg">List Your Business</Button>
        </div>
      </div>

      <div className="mt-16 grid text-center lg:max-w-5xl lg:w-full lg:grid-cols-4 lg:text-left gap-6">
        <div className="group rounded-lg border border-border px-5 py-4 transition-colors hover:bg-accent hover:text-accent-foreground">
          <h2 className="mb-3 text-2xl font-semibold">
            Directory{' '}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              →
            </span>
          </h2>
          <p className="m-0 max-w-[30ch] text-sm text-muted-foreground">
            Browse commercial properties and business listings
          </p>
        </div>

        <div className="group rounded-lg border border-border px-5 py-4 transition-colors hover:bg-accent hover:text-accent-foreground">
          <h2 className="mb-3 text-2xl font-semibold">
            Search{' '}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              →
            </span>
          </h2>
          <p className="m-0 max-w-[30ch] text-sm text-muted-foreground">
            Find properties by location, type, and amenities
          </p>
        </div>

        <div className="group rounded-lg border border-border px-5 py-4 transition-colors hover:bg-accent hover:text-accent-foreground">
          <h2 className="mb-3 text-2xl font-semibold">
            List{' '}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              →
            </span>
          </h2>
          <p className="m-0 max-w-[30ch] text-sm text-muted-foreground">
            Add your commercial property to our directory
          </p>
        </div>

        <div className="group rounded-lg border border-border px-5 py-4 transition-colors hover:bg-accent hover:text-accent-foreground">
          <h2 className="mb-3 text-2xl font-semibold">
            Connect{' '}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              →
            </span>
          </h2>
          <p className="m-0 max-w-[30ch] text-sm text-muted-foreground">
            Connect property owners with potential tenants
          </p>
        </div>
      </div>
    </main>
  )
}