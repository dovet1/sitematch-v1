'use client';

import { Building, Mail, MapPin, Phone } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-violet-600 rounded-lg flex items-center justify-center">
                <Building className="w-4 h-4 text-white" />
              </div>
              <span className="text-xl font-bold text-white">SiteMatcher</span>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Connecting commercial occupiers with the right property opportunities across the UK & Ireland.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="/search" className="hover:text-white transition-colors">
                  Search Requirements
                </a>
              </li>
              <li>
                <a href="/occupier/create-listing-quick" className="hover:text-white transition-colors">
                  Post Requirement
                </a>
              </li>
              <li>
                <a href="/sitesketcher" className="hover:text-white transition-colors">
                  SiteSketcher
                </a>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-white font-semibold mb-4">Support</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="/privacy" className="hover:text-white transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="/terms" className="hover:text-white transition-colors">
                  Terms of Service
                </a>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-white font-semibold mb-4">Contact</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <a href="mailto:rob@sitematcher.co.uk" className="hover:text-white transition-colors">
                  rob@sitematcher.co.uk
                </a>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <span>United Kingdom</span>
              </div>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-gray-800 mt-8 pt-8 text-center">
          <p className="text-sm text-gray-400">
            {new Date().getFullYear()} SITEMATCHER LTD. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}