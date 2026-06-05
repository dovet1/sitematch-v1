import { FeatureRow } from './FeatureRow';

export function Features() {
  return (
    <section className="px-5 md:px-20 pt-[60px] pb-10">
      <div className="max-w-[1280px] mx-auto">
        {/* Section Header */}
        <div className="max-w-[720px] mb-9">
          <div className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[1.4px] text-sm-ink3 uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-sm-violet" />
            How it works
          </div>
          <h2 className="font-semibold text-section-h2 leading-[1.02] tracking-[-0.035em] mt-4 mb-0 text-sm-ink balance">
            Four tools. One workflow. From shortlist to signed.
          </h2>
        </div>

        {/* Feature 1: GapFinder */}
        <FeatureRow
          idx={1}
          name="GapFinder"
          kicker="Map brand presence"
          headline="see where every brand isn't yet."
          body="GapFinder maps brand presence across the UK so you can find the gaps before anyone else. Spot opportunities your competitors miss."
          bullets={[
            "Commercial occupiers across all sectors, mapped",
            "Filter by brand presence, population, and traffic counts",
            "Assess an area's store presence and compare to another area",
            "Export shortlists to Excel",
          ]}
          videoLabel="GapFinder demo"
          videoNote="Map view zooming into a region; gaps highlighting"
          videoSrc="/gapfinder/homepage_gifs/gapfinder_gif.mp4"
          ctas={[
            { label: "Find Gaps Now", style: "violet", requiresAuth: true }
          ]}
        />

        {/* Feature 2: Requirement Directory */}
        <FeatureRow
          idx={2}
          name="Requirement Directory"
          kicker="Verified live opportunities"
          headline="only the live ones, only the real ones."
          body="A curated directory of commercial property requirements in the UK. Every listing is verified by us and kept current, so you're only working with live opportunities."
          bullets={[
            "Hand-verified before going live",
            "Re-checked on a rolling basis",
            "Easily searchable and filterable",
          ]}
          videoLabel="Requirement Directory"
          videoNote="Scrolling the list, filtering, opening a detail card"
          videoSrc="/gapfinder/homepage_gifs/browse_listings_gif.mp4"
          reverse
          ctas={[
            { label: "Browse Requirements Now", style: "violet", href: "/search" },
            { label: "Post For Free (Forever!)", style: "ghost", href: "/occupier/create-listing-quick" },
          ]}
        />

        {/* Feature 3: SiteAnalyser */}
        <FeatureRow
          idx={3}
          name="SiteAnalyser"
          kicker="Catchment & demographics"
          headline="instant demographics for any UK postcode."
          body="SiteAnalyser pulls population, affluence and household data for any catchment in seconds."
          bullets={[
            "Drive-time and walk-time catchments",
            "Affluence, age, household composition and more",
            "Save analyses for later",
          ]}
          videoLabel="SiteAnalyser"
          videoNote="Dropping a pin, isochrone forming, stats panel populating"
          videoSrc="/gapfinder/homepage_gifs/siteanalyser_gif.mp4"
          ctas={[{ label: "Try For Free", style: "violet", href: "/siteanalyser" }]}
        />

        {/* Feature 4: SiteSketcher */}
        <FeatureRow
          idx={4}
          name="SiteSketcher"
          kicker="2D & 3D site mock-ups"
          headline="sketch a feasibility in a coffee break."
          body="Mock up site layouts in 2D and 3D. Draw, measure and visualise on any plot - without opening CAD."
          bullets={[
            "Drag, draw and measure on any plot",
            "Toggle between 2D and 3D views",
            "Add parking spaces to the map",
            "Upload your building plans or access drawings"
          ]}
          videoLabel="SiteSketcher"
          videoNote="Drawing a footprint on a plot, extruding to 3D"
          videoSrc="/gapfinder/homepage_gifs/sitesketcher_gif.mp4"
          reverse
          ctas={[{ label: "Try For Free", style: "violet", href: "/sitesketcher" }]}
        />
      </div>
    </section>
  );
}
