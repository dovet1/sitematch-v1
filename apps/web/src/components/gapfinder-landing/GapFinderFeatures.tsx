import { FeatureRow } from '../homepage-new/FeatureRow';

export function GapFinderFeatures() {
  return (
    <section className="px-5 md:px-20 pt-[60px] pb-10">
      <div className="max-w-[1280px] mx-auto">
        {/* Feature 1: Smart Filtering */}
        <FeatureRow
          idx={1}
          name="Smart Filtering"
          kicker="Precision targeting"
          headline="find the perfect location, faster"
          body="Filter locations by population, brand presence and brand proximity to identify the best opportunities for expansion."
          bullets={[
            "Filter by population",
            "See which brands are present or absent in any area",
            "Analyze brand proximity and competition density",
            "Export filtered results to Excel",
          ]}
          videoLabel="Smart Filtering demo"
          videoNote="Filtering interface with population and brand controls"
          videoSrc="/gapfinder/gf_landing_vids/brand_filter_and_export.mp4"
          ctas={[{ label: "Try GapFinder Now", style: "violet", requiresAuth: true }]}
        />

        {/* Feature 2: Area Assessment */}
        <FeatureRow
          idx={2}
          name="Area Assessment"
          kicker="Comprehensive analysis"
          headline="understand any area in seconds"
          body="Assess an area and see all stores within custom radius, walking distance or driving distance catchments."
          bullets={[
            "Custom radius analysis tools",
            "Walking distance catchments",
            "Driving time isochrones",
            "Complete store inventory and brand breakdown",
          ]}
          videoLabel="Area Assessment demo"
          videoNote="Drawing catchments and viewing store data"
          reverse
          ctas={[{ label: "Try GapFinder Now", style: "violet", requiresAuth: true }]}
        />

        {/* Feature 3: Gap Comparison */}
        <FeatureRow
          idx={3}
          name="Gap Comparison"
          kicker="Competitive intelligence"
          headline="see what's missing, spot the opportunity"
          body="Compare the brand presence in two areas side-by-side and identify what's missing from both markets."
          bullets={[
            "Side-by-side area comparison",
            "Brand presence differential analysis",
            "Identify gaps in both markets simultaneously",
            "Strategic expansion insights",
          ]}
          videoLabel="Gap Comparison demo"
          videoNote="Two areas compared with brand differential highlighted"
          ctas={[{ label: "Try GapFinder Now", style: "violet", requiresAuth: true }]}
        />

        {/* Feature 4: Requirement Overlay */}
        <FeatureRow
          idx={4}
          name="Requirement Overlay"
          kicker="Live opportunities"
          headline="layer on demand to find ready buyers"
          body="Layer on SiteMatcher's requirement directory to see other brands actively looking in an area—match supply with demand instantly."
          bullets={[
            "Verified live requirements from our directory",
            "See which brands are actively searching in your area",
            "Match available sites with ready buyers",
            "Direct contact details on Pro+ tier",
          ]}
          videoLabel="Requirement Overlay demo"
          videoNote="Requirements layer toggled on map showing active searches"
          reverse
          ctas={[{ label: "Try GapFinder Now", style: "violet", requiresAuth: true }]}
        />
      </div>
    </section>
  );
}
