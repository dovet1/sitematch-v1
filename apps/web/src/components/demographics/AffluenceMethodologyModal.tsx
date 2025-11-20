'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface AffluenceMethodologyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AffluenceMethodologyModal({
  open,
  onOpenChange,
}: AffluenceMethodologyModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <span>⭐</span> How We Calculate the Affluence Score
          </DialogTitle>
          <DialogDescription>
            Our Affluence Score is designed to give a simple, accurate picture of how affluent a local area is, based on the latest official data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 text-sm">
          {/* Introduction */}
          <div className="space-y-2">
            <p className="text-gray-700">
              It combines two things:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-gray-700 ml-2">
              <li><strong>Census 2021 measures</strong> that describe the social and economic profile of each neighbourhood</li>
              <li><strong>Household income data</strong> for the wider Middle Layer Super Output Area (MSOA) that each neighbourhood belongs to</li>
            </ol>
            <p className="text-gray-700 mt-3">
              The result is a single score from <strong>0 to 100</strong>, where higher numbers indicate more affluent areas.
            </p>
          </div>

          <hr className="border-gray-200" />

          {/* Section 1 */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <span>1️⃣</span> Census-based Affluence Score (the foundation)
            </h3>
            <p className="text-gray-700">
              Every neighbourhood (LSOA) receives an initial score based entirely on <strong>Census 2021</strong>.
            </p>
            <p className="text-gray-700">
              We look at six indicators that are strongly linked to affluence:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-700 ml-2">
              <li><strong>Employment</strong> – how many adults are in work</li>
              <li><strong>Occupations</strong> – how many people work in professional or high-skilled jobs</li>
              <li><strong>Education</strong> – the percentage of residents with degree-level qualifications</li>
              <li><strong>Home ownership</strong> – the share of households that own their home</li>
              <li><strong>Health</strong> – how many residents report good or very good health</li>
              <li><strong>Housing type</strong> – the proportion of detached and semi-detached homes</li>
            </ul>
            <p className="text-gray-700 mt-3">
              For each area, we compare these values against the <strong>national average</strong>.
              Areas above the national average score higher, and areas below score lower.
            </p>
            <p className="text-gray-700">
              All six factors are then combined using a weighted formula to produce an initial <strong>Census-only Affluence Score (0–100)</strong>.
            </p>
            <p className="text-gray-700">
              This forms the core of the final score.
            </p>
          </div>

          <hr className="border-gray-200" />

          {/* Section 2 */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <span>2️⃣</span> Adding Income (to complete the picture)
            </h3>
            <p className="text-gray-700">
              Alongside the Census data, we add <strong>official household income estimates</strong> for each MSOA (a small cluster of neighbourhoods).
            </p>
            <p className="text-gray-700">
              Each neighbourhood inherits the <strong>total annual income</strong> of its parent MSOA.
            </p>
            <p className="text-gray-700">
              To make income comparable with the Census score, we convert it into a <strong>percentile</strong> from 0 to 100:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-700 ml-2">
              <li>Areas with the lowest incomes score near <strong>0</strong></li>
              <li>Middle-income areas score around <strong>50</strong></li>
              <li>The highest-income areas score close to <strong>100</strong></li>
            </ul>
            <p className="text-gray-700 mt-3">
              This gives every neighbourhood an <strong>Income Score (0–100)</strong>.
            </p>
          </div>

          <hr className="border-gray-200" />

          {/* Section 3 */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <span>3️⃣</span> The Blended Affluence Score (what you see)
            </h3>
            <p className="text-gray-700">
              Finally, we combine:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-700 ml-2">
              <li><strong>70%</strong> of the Census-based Affluence Score</li>
              <li><strong>30%</strong> of the Income Score</li>
            </ul>
            <p className="text-gray-700 mt-3">
              This creates the final <strong>Affluence Score with Income</strong>, shown on our platform.
            </p>
            <p className="text-gray-700">
              The Census measures remain the most important part of the score, because they reflect long-term characteristics of an area. Income adds an important additional layer that helps highlight neighbourhoods in places with particularly high or low earnings.
            </p>
          </div>

          <hr className="border-gray-200" />

          {/* Section 4 */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <span>4️⃣</span> What the numbers mean
            </h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-gray-900 w-20">70–100:</span>
                <span className="text-gray-700">Very affluent</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-gray-900 w-20">55–69:</span>
                <span className="text-gray-700">Above average</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-gray-900 w-20">40–54:</span>
                <span className="text-gray-700">Typical</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-gray-900 w-20">25–39:</span>
                <span className="text-gray-700">Below average</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-gray-900 w-20">0–24:</span>
                <span className="text-gray-700">Less affluent</span>
              </div>
            </div>
            <p className="text-gray-700 mt-3">
              These categories help make the score easier to understand at a glance.
            </p>
          </div>

          <hr className="border-gray-200" />

          {/* Section 5 */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <span>🎯</span> Why this approach works
            </h3>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-2">
              <li><strong>Data you can trust:</strong> Based only on official Census 2021 and government income statistics</li>
              <li><strong>Fair comparisons:</strong> Every score is benchmarked against national averages</li>
              <li><strong>Balanced:</strong> Combines both long-term socioeconomic factors and current income levels</li>
              <li><strong>Stable:</strong> The underlying data does not change year-to-year</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
