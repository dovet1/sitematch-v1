import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Building2, ArrowLeft, Search } from 'lucide-react'

export default function AgencyNotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center py-16">
      <div className="max-w-md mx-auto text-center px-6">
        {/* Icon */}
        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-8">
          <Building2 className="w-12 h-12 text-gray-400" />
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Agency Not Found
        </h1>

        {/* Description */}
        <p className="text-gray-600 mb-8 leading-relaxed">
          The agency you're looking for doesn't exist or may have been removed. 
          It's also possible this agency is still pending approval.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/agents">
            <Button size="lg" className="flex items-center">
              <Search className="w-5 h-5 mr-2" />
              Browse All Agencies
            </Button>
          </Link>
          <Link href="/">
            <Button variant="outline" size="lg" className="flex items-center">
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>

        {/* Help Text */}
        <p className="text-sm text-gray-500 mt-8">
          If you believe this is an error, please contact support.
        </p>
      </div>
    </div>
  )
}