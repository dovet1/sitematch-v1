'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Building2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { TopBar } from './components/shell/TopBar'
import { LeftRail } from './components/shell/LeftRail'
import { LeftPanel } from './components/shell/LeftPanel'
import { StatusBar } from './components/shell/StatusBar'
import { ResultsPanel } from './components/panels/ResultsPanel'
import { SavedAnalysesPanel } from './components/panels/SavedAnalysesPanel'
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
import { AnonymousPaywallOverlay } from './components/overlays/AnonymousPaywallOverlay'

// Navigation section type
type NavigationSection = 'overview' | 'demographics' | 'employment' | 'education' | 'mobility' | 'health'
type LeftPanelType = 'saved-analyses' | null

// Conversion constants
const WALK_SPEED_MPH = 3
const DRIVE_SPEED_MPH = 35
const DEFAULT_MAP_CENTER = { lat: 54.5, lng: -3 }
const DEFAULT_MAP_RADIUS_MILES = 120

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
  const { user, loading: authLoading } = useAuth()
  const { hasProAccess, loading: tierLoading } = useSubscriptionTier()

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
  const [loadingAnalysis, setLoadingAnalysis] = useState(false)
  const [analyzedLocation, setAnalyzedLocation] = useState<LocationResult | null>(null)
  const [analysisName, setAnalysisName] = useState<string | null>(null)
  const [analysisId, setAnalysisId] = useState<string | null>(null)
  const loadedAnalysisIdRef = useRef<string | null>(null)  // Track last loaded ID
  const loadingAnalysisRef = useRef<boolean>(false)        // Track in-flight status

  // Navigation state
  const [activeSection, setActiveSection] = useState<NavigationSection>('overview')
  const [activePanel, setActivePanel] = useState<LeftPanelType>(null)

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
    const urlAnalysisId = searchParams?.get('analysis')

    // Skip if no ID, already loading, or already loaded this ID
    if (!urlAnalysisId || loadingAnalysisRef.current || loadedAnalysisIdRef.current === urlAnalysisId) {
      return
    }

    // Wait for auth/tier loading to complete
    if (authLoading || tierLoading) return

    // Block anonymous users
    if (!user) return

    // Block free users - show upgrade modal instead of toast/redirect
    if (!hasProAccess) {
      // Clear the query param to prevent effect re-runs
      router.replace('/new-dashboard/tools/site-demographer-v2')
      // Show unified upgrade modal (consistent with other upgrade flows)
      setShowUpgradeModal(true)
      return
    }

    const loadAnalysis = async () => {
      loadingAnalysisRef.current = true  // Mark as loading (ref)
      setLoadingAnalysis(true)            // Also update UI state
      try {
        const response = await fetch(`/api/demographic-analyses/${urlAnalysisId}`)

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

        // After successful load:
        loadedAnalysisIdRef.current = urlAnalysisId  // Mark as loaded
        setAnalysisName(analysis.name)
        setAnalysisId(urlAnalysisId)

        toast.success('Analysis loaded successfully')
      } catch (error) {
        console.error('Error loading saved analysis:', error)
        toast.error(error instanceof Error ? error.message : 'Failed to load analysis')
        router.replace('/new-dashboard/tools/site-demographer-v2')
      } finally {
        loadingAnalysisRef.current = false  // Clear loading flag (ref)
        setLoadingAnalysis(false)            // Also update UI state
      }
    }

    loadAnalysis()
  }, [
    searchParams,
    authLoading,
    tierLoading,
    user,
    hasProAccess,
    router,
    loadSavedAnalysis,
    initializeSelection,
    setSelectedLocation,
    setMeasurementMode,
    setMeasurementValue,
    setAnalyzedLocation,
  ])

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
      setShowUpgradeModal(true)
    }
  }

  const handleTrafficToggle = () => {
    if (!hasProAccess && !showTraffic) {
      setShowUpgradeModal(true)
      return
    }
    setShowTraffic(!showTraffic)
  }

  const handleCountPointsToggle = () => {
    if (!hasProAccess && !showCountPoints) {
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

  const handleNavigationClick = (section: NavigationSection) => {
    setActivePanel(null)
    setActiveSection(section)
  }

  const handleSavedAnalysesClick = () => {
    setActivePanel('saved-analyses')
  }

  const handleViewSavedAnalysis = () => {
    setActivePanel(null)
    setActiveSection('overview')
  }

  // Show loading state while auth/subscription is being determined
  if (authLoading || tierLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-sm-bg">
        <Loader2 className="h-8 w-8 animate-spin text-sm-violet" />
      </div>
    )
  }

  // Block anonymous users with full-screen overlay
  if (!user) {
    return <AnonymousPaywallOverlay />
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
        hasProAccess={hasProAccess}
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
        <LeftRail
          activeSection={activeSection}
          activePanel={activePanel}
          onNavigationClick={handleNavigationClick}
          onSavedAnalysesClick={handleSavedAnalysesClick}
          hasResults={!!rawDemographicsData}
        />

        {/* LeftPanel */}
        <LeftPanel>
          {activePanel === 'saved-analyses' ? (
            <SavedAnalysesPanel
              onViewAnalysis={handleViewSavedAnalysis}
              hasProAccess={hasProAccess}
              tierLoading={tierLoading}
              onUpgradeClick={() => setShowUpgradeModal(true)}
            />
          ) : (
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
              onUpgradeClick={() => {
                setShowUpgradeModal(true)
              }}
              activeSection={activeSection}
            />
          )}
        </LeftPanel>

        {/* Map Canvas */}
        <div className="flex-1 relative min-h-0 flex flex-col">
          <div className="flex-1 relative">
            <MapCanvas
              center={
                analyzedLocation
                  ? { lat: analyzedLocation.center[1], lng: analyzedLocation.center[0] }
                  : DEFAULT_MAP_CENTER
              }
              radiusMiles={
                analyzedLocation
                  ? convertToRadiusMiles(measurementMode, measurementValue)
                  : DEFAULT_MAP_RADIUS_MILES
              }
              isochroneGeometry={analyzedLocation ? isochroneGeometry : null}
              loading={loading}
              measurementMode={measurementMode}
              measurementValue={measurementValue}
              selectedLsoaCodes={selectedLsoaCodes}
              allLsoaCodes={allLsoaCodes}
              onLsoaToggle={toggleLsoa}
              lsoaTooltipData={lsoaTooltipData}
              showTraffic={showTraffic}
              showCountPoints={showCountPoints}
              showAnalysisOverlay={!!analyzedLocation}
            />

            {analyzedLocation && (
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
            )}
          </div>

          {analyzedLocation && (
            <StatusBar
              measurementMode={measurementMode}
              measurementValue={measurementValue}
              lsoaCount={selectedLsoaCodes.size}
            />
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
        onUpgrade={handleUpgradeModalAction}
      />
    </div>
  )
}
