repo: dovet1/sitematch-v1
branch: main
path: apps/web/src

## Last sync
date: 2026-09-16T10:05:00Z

### Updated in this project
- Built Planning Monitor detailed UX flows (11 frames) on the unified app shell
- Grounded shell in real chrome: icon rail, centred search, left control panel, right results panel
- Adopted repo design tokens (sm-violet #7033FF, sm-ink #171419, sm-border #E8E4DC) and fonts (Inter + JetBrains Mono)
- Planning monitor designed as a third rail mode alongside Assess area and Find gaps

## Screen map
| Project screen | Built from |
| --- | --- |
| Planning Monitor Flows.dc.html — shell (all frames) | apps/web/src/app/gapfinder/page.tsx, apps/web/src/app/layout.tsx, apps/web/tailwind.config.js |
| Results panel patterns (1a, 1c, 1f) | apps/web/src/components/gapfinder/ResultsPanel.tsx |
| Map legend / marker treatment (1a, 1f) | apps/web/src/components/gapfinder/MapLegend.tsx, apps/web/src/components/gapfinder/BUAMap.tsx |
| Mode model (find-gaps / assess-area / planning monitor) | apps/web/src/components/gapfinder/BUAMap.tsx, ResultsPanel.tsx |

Note: no `/sitematcher-unified` route exists on `main` at time of writing — the unified shell was reconstructed from the GapFinder tool plus user-supplied screenshots.
