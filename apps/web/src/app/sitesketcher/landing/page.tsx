'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight,
  MapPin,
  Building2,
  Car,
  Users,
  TrendingUp,
  CheckCircle,
  Play,
  Star,
  Zap,
  Shield,
  Clock
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { StartTrialButton } from '@/components/StartTrialButton';
import { VideoLightbox } from '@/components/VideoLightbox';
import '@/styles/sitesketcher-landing.css';
import dynamic from 'next/dynamic';

// Performance optimizations - images and components are loaded efficiently

const DEMO_VIDEO_ID = 'DdBlMDdXe5w';

const commercialUserTypes = [
  {
    icon: Building2,
    title: 'Occupiers',
    description: 'Assess site suitability for your business requirements',
    features: ['Office space evaluation', 'Retail footprint analysis', 'Warehouse capacity planning']
  },
  {
    icon: Users,
    title: 'Agents',
    description: 'Present property potential with visual analysis',
    features: ['Client presentations', 'Site analysis tools', 'Building placement options']
  },
  {
    icon: TrendingUp,
    title: 'Investors',
    description: 'Evaluate development feasibility and ROI potential',
    features: ['Site size analysis', 'Parking requirements', 'Development capacity']
  },
  {
    icon: MapPin,
    title: 'Developers',
    description: 'Plan preliminary site layouts with precision',
    features: ['Building footprints', 'Zoning compliance', 'Site planning tools']
  }
];

const keyFeatures = [
  {
    icon: MapPin,
    title: 'Site Size Evaluation',
    description: 'Instantly measure and assess property dimensions with precision mapping tools'
  },
  {
    icon: Building2,
    title: 'Building Placement',
    description: 'Visualize building footprints and optimize space utilization'
  },
  {
    icon: Car,
    title: 'Parking Analysis',
    description: 'Calculate parking requirements and overlay capacity planning'
  }
];

const testimonials = [
  {
    name: 'Henry Foreman',
    role: 'Partner',
    company: 'FMX Urban Property Advisory',
    content: 'SiteMatcher shows me who\’s active and exactly what they\’re looking for. I get contacts instantly, and if I want to test an idea, SiteSketcher lets me draw a quick feasibility in minutes. It\’s straightforward, simple, and saves a huge amount of time.',
    rating: 5
  }
];

export default function SiteSketcherLanding() {
  const { user } = useAuth();
  const [showVideoLightbox, setShowVideoLightbox] = useState(false);

  return (
    <div className="min-h-screen bg-background sitesketcher-landing">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-slate-50 hero-section">
        <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))]" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 lg:pt-32 lg:pb-24">
          <div className="text-center fade-in">
            <Badge variant="outline" className="mb-4">
              <Zap className="w-3 h-3 mr-1" />
              Commercial Property Assessment Tool
            </Badge>
            
            <h1 className="hero-title text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 mb-6 text-contrast">
              Assess Commercial Property
              <span className="block text-blue-600">Feasibility Instantly</span>
            </h1>
            
            <p className="hero-subtitle max-w-2xl mx-auto text-xl text-gray-600 mb-8 text-contrast">
              SiteSketcher helps commercial real estate professionals quickly evaluate properties 
              through visual site analysis, building placement, and parking assessment.
            </p>

            {/* CTA Buttons - Stacked Hierarchy */}
            <div className="cta-buttons flex flex-col gap-4 justify-center items-center mb-12 max-w-sm mx-auto">
              {/* Primary Action - Full Width */}
              <StartTrialButton
                size="lg"
                userType="sitesketcher"
                redirectPath="/sitesketcher?welcome=true"
                className="cta-button cta-button-primary touch-button w-full text-white px-8 py-4 text-lg font-semibold"
              />
              
              {/* Secondary Action */}
              <Button
                size="lg"
                variant="outline"
                onClick={() => setShowVideoLightbox(true)}
                className="cta-button cta-button-secondary touch-button w-full px-8 py-3 text-base border-2 border-blue-200 hover:border-blue-300 hover:bg-blue-50"
              >
                <Play className="mr-2 h-4 w-4" />
                View Demo
              </Button>
              
              {/* Tertiary Action - Text Link Style */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.location.href = '/pricing'}
                className="cta-button touch-button text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-4 py-2 text-sm underline-offset-4 hover:underline"
              >
                View Pricing & Features
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Demo Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              See SiteSketcher in Action
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Watch how commercial real estate professionals use our tools to assess property potential
            </p>
          </div>

          <div className="relative max-w-4xl mx-auto">
            <Card className="overflow-hidden shadow-2xl cursor-pointer group" onClick={() => setShowVideoLightbox(true)}>
              <div className="relative aspect-video bg-black">
                {/* YouTube thumbnail */}
                <img
                  src={`https://img.youtube.com/vi/${DEMO_VIDEO_ID}/maxresdefault.jpg`}
                  alt="SiteSketcher Demo Video"
                  className="w-full h-full object-cover"
                />

                {/* Play button overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition-all">
                  <div className="bg-blue-600 group-hover:bg-blue-700 group-hover:scale-110 transition-all rounded-full p-6 shadow-2xl">
                    <Play className="w-12 h-12 text-white fill-white" />
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Essential Tools for Property Assessment
            </h2>
            <p className="text-lg text-gray-600">
              Everything you need to evaluate commercial property potential
            </p>
          </div>

          <div className="feature-grid grid md:grid-cols-3 gap-8">
            {keyFeatures.map((feature, index) => (
              <Card key={index} className="feature-card text-center p-6 hover:shadow-lg transition-shadow">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mb-4">
                  <feature.icon className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Trusted by Commercial Real Estate Professionals
            </h2>
          </div>

          <Card className="p-8 md:p-10 max-w-3xl mx-auto shadow-lg border-2 border-slate-100">
            <div className="flex justify-center mb-6">
              {[...Array(testimonials[0].rating)].map((_, i) => (
                <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
              ))}
            </div>
            <blockquote className="text-lg md:text-xl text-gray-700 text-center mb-8 leading-relaxed">
              "{testimonials[0].content}"
            </blockquote>
            <div className="text-center">
              <div className="font-semibold text-gray-900 text-lg">{testimonials[0].name}</div>
              <div className="text-gray-600">
                {testimonials[0].role}, {testimonials[0].company}
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 bg-blue-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white mb-4">
            Start Assessing Properties Today
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join commercial real estate professionals who trust SiteSketcher for property evaluation
          </p>
          <StartTrialButton
            size="lg"
            userType="sitesketcher"
            redirectPath="/sitesketcher?welcome=true"
            className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-3 text-lg"
          />
        </div>
      </section>

      {/* Video Lightbox */}
      <VideoLightbox
        isOpen={showVideoLightbox}
        onClose={() => setShowVideoLightbox(false)}
        videoId={DEMO_VIDEO_ID}
        title="SiteSketcher Demo"
      />

    </div>
  );
}