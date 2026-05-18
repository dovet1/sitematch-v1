import { VideoSlot } from './VideoSlot';
import { RevealWrapper } from './RevealWrapper';

export function Hero() {
  return (
    <RevealWrapper>
      <section className="px-10 pt-20 pb-0 text-center max-md:px-5 max-md:pt-12">
        {/* Eyebrow */}
        <div className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[1.4px] text-sm-ink3 uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-sm-violet" />
          For commercial property professionals
        </div>

        {/* H1 */}
        <h1 className="mx-auto mt-[18px] max-w-[1080px] font-semibold text-sm-ink text-hero-h1 leading-[0.98] tracking-[-0.04em] balance">
          The clearest view of UK
          <br />
          commercial property — <em className="font-medium italic text-sm-violet-deep">in one place.</em>
        </h1>

        {/* Subtitle */}
        <p className="mx-auto mt-6 max-w-[620px] text-sm-ink2 leading-[1.45] balance" style={{ fontSize: 'clamp(16px, 1.6vw, 20px)' }}>
          Find requirements, map brand presence, analyse catchments and mock up sites — without the spreadsheet trail.
        </p>

        {/* CTAs */}
        <div className="flex justify-center gap-2.5 mt-8 flex-wrap">
          <button className="px-5 py-[13px] rounded-sm-btn bg-sm-violet text-white font-medium text-[15px] border border-sm-violet tracking-[-0.1px] hover:bg-sm-violet-deep transition-colors">
            Start 30-day free trial
          </button>
          <button className="px-5 py-[13px] rounded-sm-btn bg-transparent text-sm-ink font-medium text-[15px] border border-sm-border tracking-[-0.1px] hover:bg-sm-border-soft transition-colors">
            See it in action ↓
          </button>
        </div>

        {/* Video Placeholder */}
        <div className="mx-auto mt-16 max-w-[1180px] max-md:mt-10">
          <VideoSlot
            label="Full product overview"
            note="60-second walkthrough showing the dashboard, map and key flows"
            ratio="16/9"
            videoSrc="/gapfinder/homepage_gifs/gf_gif.mp4"
            alt="GapFinder product overview demonstration"
          />
        </div>
      </section>
    </RevealWrapper>
  );
}
