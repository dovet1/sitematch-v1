'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Building2 } from 'lucide-react'
import { toast } from 'sonner'
import { TopBar } from './components/shell/TopBar'
import { LeftRail } from './components/shell/LeftRail'
import { LeftPanel } from './components/shell/LeftPanel'
import { StatusBar } from './components/shell/StatusBar'
import { ResultsPanel } from './components/panels/ResultsPanel'
import { MapCanvas } from './components/map/MapCanvas'
import { useDemographicsData } from '@/components/demographics/shared/hooks/useDemographicsData'
import { useLsoaSelection } from '@/components/demographics/shared/hooks/useLsoaSelection'
import { useLocationSearch } from '@/components/demographics/shared/hooks/useLocationSearch'
import { useSubscriptionTier } from '@/hooks/useSubscriptionTier'
import { useAuth } from '@/contexts/auth-context'
import { formatLocationDisplay } from '@/lib/mapbox'
import type { LocationResult } from '@/lib/mapbox'
import { Button } from './components/primitives/Button'
import { SaveAnalysisModal } from './components/modals/SaveAnalysisModal'
import { SiteAnalyserUpgradeModal } from './components/modals/SiteAnalyserUpgradeModal'

// Conversion constants
const WALK_SPEED_MPH = 3
const DRIVE_SPEED_MPH = 35

// Convert measurement to radius in miles
function convertToRadiusMiles(mode: 'distance' | 'drive_time' | 'walk_time', value: number): number {
  switch (mode) {
    case 'distance':
      return value
    case 'walk_time':
      return (value / 60) * WALK_SPEED_MPH
    case 'drive_time':
      return (value / 60) * DRIVE_SPEED_MPH
  }
}

export default function SiteDemographerDesktop() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const { user } = useAuth()
  const { hasProAccess } = useSubscriptionTier()

  // Preserve full path including query params
  const currentPath = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '')

  // Get site context from URL params
  const linkedSiteId = searchParams?.get('site_id')
  const linkedSiteName = searchParams?.get('site_name')

  // Shared hooks for data management
  const {
    rawDemographicsData,
    isochroneGeometry,
    lsoaTooltipData,
    nationalAverages,
    loading,
    error,
    analyze,
    reset: resetDemographics,
    updateData,
    loadSavedAnalysis,
  } = useDemographicsData()

  const {
    selectedLsoaCodes,
    allLsoaCodes,
    isRefetchingData,
    setIsRefetchingData,
    toggleLsoa,
    initializeSelection,
    reset: resetSelection,
  } = useLsoaSelection()

  const {
    selectedLocation,
    measurementMode,
    measurementValue,
    setSelectedLocation,
    setMeasurementMode,
    setMeasurementValue,
    reset: resetLocation,
  } = useLocationSearch()

  // Local state
  const [showTraffic, setShowTraffic] = useState(false)
  const [showCountPoints, setShowCountPoints] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [upgradeFeature, setUpgradeFeature] = useState<'save' | 'traffic' | 'count' | 'demographics'>('demographics')
  const [loadingAnalysis, setLoadingAnalysis] = useState(false)
  const [analyzedLocation, setAnalyzedLocation] = useState<LocationResult | null>(null)
  const [analysisName, setAnalysisName] = useState<string | null>(null)
  const [analysisId, setAnalysisId] = useState<string | null>(null)

  // Construct analysisData for save modal (lines 891-903 from DemographicsResults)
  const analysisData = selectedLocation && selectedLsoaCodes && rawDemographicsData ? {
    location: { lat: selectedLocation.center[1], lng: selectedLocation.center[0] },
    location_name: formatLocationDisplay(selectedLocation),
    measurement_mode: measurementMode,
    measurement_value: measurementValue,
    selected_lsoa_codes: Array.from(selectedLsoaCodes),
    demographics_data: rawDemographicsData,
    national_averages: nationalAverages,
    isochrone_geometry: isochroneGeometry,
  } : null

  // Load saved analysis from query parameter
  useEffect(() => {
    const analysisId = searchParams?.get('analysis')
    if (!analysisId || loadingAnalysis) return

    const loadAnalysis = async () => {
      setLoadingAnalysis(true)
      try {
        const response = await fetch(`/api/demographic-analyses/${analysisId}`)

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to load analysis')
        }

        const { analysis } = await response.json()

        // Reconstruct location object
        const reconstructedLocation: LocationResult = {
          id: `saved-${analysis.id}`,
          place_type: ['place'],
          text: analysis.location_name,
          place_name: analysis.location_name,
          center: [analysis.location.lng, analysis.location.lat],
          context: [],
        }

        // Load saved state
        setSelectedLocation(reconstructedLocation)
        setMeasurementMode(analysis.measurement_mode)
        setMeasurementValue(analysis.measurement_value)

        // Load demographics data
        loadSavedAnalysis({
          demographics_data: analysis.demographics_data,
          isochrone_geometry: analysis.isochrone_geometry,
          national_averages: analysis.national_averages,
        })

        // Initialize LSOA selection
        initializeSelection(analysis.selected_lsoa_codes)

        // Set analyzed location for map
        setAnalyzedLocation(reconstructedLocation)

        // Set analysis name and ID
        setAnalysisName(analysis.name)
        setAnalysisId(analysisId)

        toast.success('Analysis loaded successfully')
      } catch (error) {
        console.error('Error loading saved analysis:', error)
        toast.error(error instanceof Error ? error.message : 'Failed to load analysis')
        router.replace('/new-dashboard/tools/site-demographer-v2')
      } finally {
        setLoadingAnalysis(false)
      }
    }

    loadAnalysis()
  }, [searchParams])

  // Re-fetch aggregated data when selection changes
  useEffect(() => {
    if (!rawDemographicsData || selectedLsoaCodes.size === 0) return

    const fetchAggregatedData = async () => {
      setIsRefetchingData(true)
      try {
        const codes = Array.from(selectedLsoaCodes)
        const dataResponse = await fetch('/api/demographics/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            geography_codes: codes,
          }),
        })

        if (!dataResponse.ok) {
          throw new Error('Failed to fetch demographics data')
        }

        const demographicsData = await dataResponse.json()
        updateData(demographicsData.by_lsoa)
      } catch (err) {
        console.error('Error refetching demographics:', err)
      } finally {
        setIsRefetchingData(false)
      }
    }

    const timeoutId = setTimeout(fetchAggregatedData, 300)
    return () => clearTimeout(timeoutId)
  }, [selectedLsoaCodes, updateData])

  const handleAnalyze = async (locationOverride?: LocationResult, shouldReset?: boolean) => {
    const location = locationOverride || selectedLocation
    if (!location) return

    if (!measurementValue || typeof measurementValue !== 'number' || measurementValue <= 0) {
      toast.error('Please enter a valid distance or time value')
      return
    }

    if (shouldReset) {
      resetDemographics()
      resetSelection()
    }

    const result = await analyze(location, measurementMode, measurementValue)

    if (result.success && result.lsoaCodes) {
      initializeSelection(result.lsoaCodes)
      setAnalyzedLocation(location)
    }
  }

  const handleReset = () => {
    resetDemographics()
    resetSelection()
    resetLocation()
    setAnalyzedLocation(null)
    setAnalysisName(null)
    setAnalysisId(null)
  }

  const handleSaveClick = () => {
    if (hasProAccess) {
      setShowSaveModal(true)
    } else {
      setUpgradeFeature('save')
      setShowUpgradeModal(true)
    }
  }

  const handleTrafficToggle = () => {
    if (!hasProAccess && !showTraffic) {
      setUpgradeFeature('traffic')
      setShowUpgradeModal(true)
      return
    }
    setShowTraffic(!showTraffic)
  }

  const handleCountPointsToggle = () => {
    if (!hasProAccess && !showCountPoints) {
      setUpgradeFeature('count')
      setShowUpgradeModal(true)
      return
    }
    setShowCountPoints(!showCountPoints)
  }

  const handleUpgradeModalAction = () => {
    setShowUpgradeModal(false)
    if (!user) {
      router.push(`/auth?mode=signup&returnUrl=${encodeURIComponent(currentPath)}`)
    } else {
      router.push('/pricing')
    }
  }

  return (
    <div className="h-screen flex flex-col bg-sm-bg">
      {/* TopBar */}
      <TopBar
        selectedLocation={selectedLocation}
        onLocationChange={setSelectedLocation}
        measurementMode={measurementMode}
        onMeasurementModeChange={setMeasurementMode}
        measurementValue={measurementValue}
        onMeasurementValueChange={setMeasurementValue}
        onAnalyze={handleAnalyze}
        loading={loading}
        hasResults={!!rawDemographicsData}
        onSave={handleSaveClick}
        analysisName={analysisName}
        analysisId={analysisId}
      />

      {/* Site Context Banner */}
      {linkedSiteId && linkedSiteName && (
        <div className="bg-sm-violet/10 border-b border-sm-violet/20 px-4 py-3 shrink-0">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-sm-violet" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-sm-ink">
                Saving to site: <span className="text-sm-violet">{linkedSiteName}</span>
              </p>
              <p className="text-xs text-sm-ink/60">
                This analysis will be automatically linked to the site when you save
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const url = new URL(window.location.href)
                url.searchParams.delete('site_id')
                url.searchParams.delete('site_name')
                window.history.replaceState({}, '', url.toString())
                window.location.reload()
              }}
            >
              Remove Link
            </Button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* LeftRail */}
        <LeftRail />

        {/* LeftPanel with ResultsPanel */}
        <LeftPanel>
          <ResultsPanel
            loading={loading}
            error={error}
            location={selectedLocation}
            measurementMode={measurementMode}
            measurementValue={measurementValue}
            totalLsoaCount={allLsoaCodes.length}
            rawData={rawDemographicsData}
            selectedLsoaCodes={selectedLsoaCodes}
            nationalAverages={nationalAverages}
            isFreeTier={!hasProAccess}
            isochroneGeometry={isochroneGeometry}
            linkedSiteId={linkedSiteId}
            onUpgradeClick={(feature?: 'save' | 'traffic' | 'count' | 'demographics') => {
              setUpgradeFeature(feature || 'demographics')
              setShowUpgradeModal(true)
            }}
            onSave={handleSaveClick}
          />
        </LeftPanel>

        {/* Map Canvas */}
        <div className="flex-1 relative min-h-0 flex flex-col">
          {analyzedLocation ? (
            <>
              <div className="flex-1 relative">
                <MapCanvas
                  center={{ lat: analyzedLocation.center[1], lng: analyzedLocation.center[0] }}
                  radiusMiles={convertToRadiusMiles(measurementMode, measurementValue)}
                  isochroneGeometry={isochroneGeometry}
                  loading={loading}
                  measurementMode={measurementMode}
                  measurementValue={measurementValue}
                  selectedLsoaCodes={selectedLsoaCodes}
                  allLsoaCodes={allLsoaCodes}
                  onLsoaToggle={toggleLsoa}
                  lsoaTooltipData={lsoaTooltipData}
                  showTraffic={showTraffic}
                  showCountPoints={showCountPoints}
                />

                {/* Traffic & Count Point Toggles - Floating Buttons */}
                <div className="absolute bottom-4 left-4 z-20 flex flex-col gap-2">
                  <Button
                    onClick={handleTrafficToggle}
                    variant={showTraffic ? 'primary' : 'secondary'}
                    size="sm"
                  >
                    {showTraffic ? 'Hide Traffic' : 'Show Traffic'}
                    {!hasProAccess && !showTraffic && <span className="ml-1.5 text-xs">🔒</span>}
                  </Button>
                  <Button
                    onClick={handleCountPointsToggle}
                    variant={showCountPoints ? 'primary' : 'secondary'}
                    size="sm"
                  >
                    {showCountPoints ? 'Hide Count Points' : 'Show Count Points'}
                    {!hasProAccess && !showCountPoints && <span className="ml-1.5 text-xs">🔒</span>}
                  </Button>
                </div>
              </div>

              {/* StatusBar */}
              <StatusBar
                measurementMode={measurementMode}
                measurementValue={measurementValue}
                lsoaCount={selectedLsoaCodes.size}
              />
            </>
          ) : loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-sm-violet/20 border-t-sm-violet mx-auto mb-4" />
                <p className="text-sm text-sm-ink/60">Analysing location...</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-sm px-8">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-sm-violet/10 flex items-center justify-center">
                  <svg className="w-10 h-10 text-sm-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                </div>
                <p className="text-base font-medium text-sm-ink mb-2">Ready to analyse</p>
                <p className="text-sm text-sm-ink/60">Enter a UK location above to view demographic insights</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save Analysis Modal */}
      <SaveAnalysisModal
        open={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        analysisData={analysisData}
        linkedSiteId={linkedSiteId}
      />

      {/* Upgrade Modal */}
      <SiteAnalyserUpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature={upgradeFeature}
        onUpgrade={handleUpgradeModalAction}
      />
    </div>
  )
}
