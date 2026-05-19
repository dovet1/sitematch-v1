'use client'

interface AuthLeftRailProps {
  mode: 'signin' | 'signup'
}

export function AuthLeftRail({ mode }: AuthLeftRailProps) {
  const isSignUp = mode === 'signup'

  return (
    <div className="hidden lg:flex flex-col justify-between py-8 px-12 bg-[#FBFAF7]">
      {/* Editorial Content */}
      <div className="flex flex-col gap-4">
        {/* Eyebrow */}
        <div className="text-[11px] font-[500] text-[#7033FF] uppercase tracking-[0.08em] font-jetbrains">
          {isSignUp ? 'GET STARTED' : 'WELCOME BACK'}
        </div>

        {/* Heading */}
        <h1 className="text-[26px] leading-[1.2] font-[600] text-[#171419] font-inter">
          {isSignUp ? (
            <>
              Join thousands of businesses
              <br />
              finding their perfect space
            </>
          ) : (
            <>
              Continue your search for
              <br />
              commercial property
            </>
          )}
        </h1>

        {/* Description */}
        <p className="text-[13px] leading-[1.5] text-[#4A4451] font-inter max-w-md">
          {isSignUp ? (
            <>
              Access the UK's most comprehensive commercial property database.
              Post requirements, save searches, and get instant notifications when
              matching properties become available.
            </>
          ) : (
            <>
              Pick up where you left off. Access your saved searches, requirements,
              and notifications to find the perfect commercial space for your business.
            </>
          )}
        </p>

        {/* Feature List */}
        <ul className="flex flex-col gap-2 mt-1">
          {isSignUp ? (
            <>
              <li className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 mt-0.5 flex-shrink-0"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="10" cy="10" r="10" fill="#EEE9FF" />
                  <path
                    d="M14 7L8.5 12.5L6 10"
                    stroke="#7033FF"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="text-[14px] text-[#171419] font-inter">
                  Search 100,000+ commercial properties nationwide
                </span>
              </li>
              <li className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 mt-0.5 flex-shrink-0"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="10" cy="10" r="10" fill="#EEE9FF" />
                  <path
                    d="M14 7L8.5 12.5L6 10"
                    stroke="#7033FF"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="text-[14px] text-[#171419] font-inter">
                  Post your requirements and let landlords find you
                </span>
              </li>
              <li className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 mt-0.5 flex-shrink-0"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="10" cy="10" r="10" fill="#EEE9FF" />
                  <path
                    d="M14 7L8.5 12.5L6 10"
                    stroke="#7033FF"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="text-[14px] text-[#171419] font-inter">
                  Get instant alerts for new matching properties
                </span>
              </li>
            </>
          ) : (
            <>
              <li className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 mt-0.5 flex-shrink-0"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="10" cy="10" r="10" fill="#EEE9FF" />
                  <path
                    d="M14 7L8.5 12.5L6 10"
                    stroke="#7033FF"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="text-[14px] text-[#171419] font-inter">
                  Access your saved searches and requirements
                </span>
              </li>
              <li className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 mt-0.5 flex-shrink-0"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="10" cy="10" r="10" fill="#EEE9FF" />
                  <path
                    d="M14 7L8.5 12.5L6 10"
                    stroke="#7033FF"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="text-[14px] text-[#171419] font-inter">
                  Manage active property enquiries
                </span>
              </li>
              <li className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 mt-0.5 flex-shrink-0"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="10" cy="10" r="10" fill="#EEE9FF" />
                  <path
                    d="M14 7L8.5 12.5L6 10"
                    stroke="#7033FF"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="text-[14px] text-[#171419] font-inter">
                  View notifications for new matching properties
                </span>
              </li>
            </>
          )}
        </ul>
      </div>

      {/* Customer Testimonial - Only show on signup */}
      {isSignUp && (
        <div className="mt-6 p-4 bg-white rounded-[16px] border border-[#EFEBE2]">
        <div className="flex gap-1 mb-2">
          {[...Array(5)].map((_, i) => (
            <svg
              key={i}
              className="w-4 h-4"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M8 0L9.79611 6.20389L16 8L9.79611 9.79611L8 16L6.20389 9.79611L0 8L6.20389 6.20389L8 0Z"
                fill="#7033FF"
              />
            </svg>
          ))}
        </div>
        <p className="text-[12px] leading-[1.5] text-[#171419] font-inter mb-2.5">
          "SiteMatcher helped us find the perfect retail space in central London.
          The search tools are incredibly powerful and the property data is
          always up to date."
        </p>
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-[#EEE9FF] flex items-center justify-center">
            <span className="text-[14px] font-[600] text-[#7033FF] font-inter">
              JM
            </span>
          </div>
          <div>
            <div className="text-[13px] font-[600] text-[#171419] font-inter">
              James Morrison
            </div>
            <div className="text-[12px] text-[#7C7588] font-inter">
              Property Director, Retail Co.
            </div>
          </div>
        </div>
        </div>
      )}
    </div>
  )
}
