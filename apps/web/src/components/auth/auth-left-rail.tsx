'use client'

interface AuthLeftRailProps {
  mode: 'signin' | 'signup'
}

export function AuthLeftRail({ mode }: AuthLeftRailProps) {
  return (
    <div className="hidden lg:flex flex-col justify-center py-8 px-12 bg-[#FBFAF7]">
      {/* Editorial Content */}
      <div className="flex flex-col gap-4">
        {/* Heading */}
        <h1 className="text-[26px] leading-[1.2] font-[600] text-[#171419] font-inter">
          "With SiteMatcher I can see the market in seconds. It's easily the fastest way I've found to spot real opportunities."
        </h1>

        {/* Description */}
        <p className="text-[13px] leading-[1.5] text-[#4A4451] font-inter max-w-md">
          Kerry Northfold
        </p>
      </div>

    </div>
  )
}
