'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Application {
  id: string;
  name: string;
  description?: string;
  ownerEmail: string;
  environment: string;
  createdAt: string;
  apiKeys: Array<{
    id: string;
    name: string;
    keyPreview: string;
    environment: string;
    isActive: boolean;
    lastUsedAt?: string;
    createdAt: string;
  }>;
  flags: Array<{
    id: string;
    key: string;
    name: string;
    isActive: boolean;
    rolloutPct: number;
    environment: string;
    createdAt: string;
  }>;
}

export default function ApplicationDashboard() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [ownerEmail, setOwnerEmail] = useState('demo@example.com');

  useEffect(() => {
    fetchApplications();
  }, [ownerEmail]);

  const fetchApplications = async () => {
    try {
      const response = await fetch(`/api/applications?ownerEmail=${encodeURIComponent(ownerEmail)}`);
      const data = await response.json();
      setApplications(data.applications || []);
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading applications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">🏢 Application Dashboard</h1>
              <p className="text-gray-600">Manage your feature flag applications</p>
            </div>
            <div className="flex gap-4">
              <Link 
                href="/onboard"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                + New Application
              </Link>
              <Link 
                href="/"
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Admin Panel
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Email Filter */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Filter by Owner Email
          </label>
          <input
            type="email"
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 w-72 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="email@example.com"
          />
        </div>

        {applications.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Applications Found</h3>
            <p className="text-gray-600 mb-6">Get started by creating your first application</p>
            <Link 
              href="/onboard"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Create Application
            </Link>
          </div>
        ) : (
          <div className="grid gap-6">
            {applications.map((app) => (
              <div key={app.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{app.name}</h2>
                    {app.description && (
                      <p className="text-gray-600 mt-1">{app.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {app.environment}
                      </span>
                      <span className="text-sm text-gray-500">
                        Created {new Date(app.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedApp(selectedApp?.id === app.id ? null : app)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    {selectedApp?.id === app.id ? 'Hide Details' : 'Show Details'}
                  </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">{app.apiKeys.length}</div>
                    <div className="text-sm text-gray-600">API Keys</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">{app.flags.length}</div>
                    <div className="text-sm text-gray-600">Feature Flags</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">
                      {app.flags.filter(f => f.isActive).length}
                    </div>
                    <div className="text-sm text-gray-600">Active Flags</div>
                  </div>
                </div>

                {/* Expanded Details */}
                {selectedApp?.id === app.id && (
                  <div className="border-t pt-6">
                    <div className="grid md:grid-cols-2 gap-8">
                      {/* API Keys */}
                      <div>
                        <h3 className="text-lg font-medium mb-4">🔑 API Keys</h3>
                        {app.apiKeys.length === 0 ? (
                          <p className="text-gray-500">No API keys found</p>
                        ) : (
                          <div className="space-y-3">
                            {app.apiKeys.map((key) => (
                              <div key={key.id} className="border rounded-lg p-3">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <div className="font-medium">{key.name}</div>
                                    <code className="text-sm text-gray-600">{key.keyPreview}</code>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className={`text-xs px-2 py-1 rounded-full ${
                                        key.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                      }`}>
                                        {key.isActive ? 'Active' : 'Inactive'}
                                      </span>
                                      <span className="text-xs text-gray-500">
                                        {key.environment}
                                      </span>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => copyToClipboard(key.keyPreview)}
                                    className="text-blue-600 hover:text-blue-800 text-sm"
                                  >
                                    Copy
                                  </button>
                                </div>
                                {key.lastUsedAt && (
                                  <div className="text-xs text-gray-500 mt-2">
                                    Last used: {new Date(key.lastUsedAt).toLocaleString()}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Feature Flags */}
                      <div>
                        <h3 className="text-lg font-medium mb-4">🚩 Feature Flags</h3>
                        {app.flags.length === 0 ? (
                          <p className="text-gray-500">No feature flags found</p>
                        ) : (
                          <div className="space-y-3">
                            {app.flags.map((flag) => (
                              <div key={flag.id} className="border rounded-lg p-3">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <div className="font-medium">{flag.name}</div>
                                    <code className="text-sm text-gray-600">{flag.key}</code>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className={`text-xs px-2 py-1 rounded-full ${
                                        flag.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                      }`}>
                                        {flag.isActive ? 'Active' : 'Inactive'}
                                      </span>
                                      <span className="text-xs text-gray-500">
                                        {flag.rolloutPct}% rollout
                                      </span>
                                    </div>
                                  </div>
                                  <Link
                                    href={`/flags/${flag.id}`}
                                    className="text-blue-600 hover:text-blue-800 text-sm"
                                  >
                                    Edit
                                  </Link>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Integration Example */}
                    <div className="mt-8 bg-gray-900 rounded-lg p-4">
                      <h4 className="text-white font-medium mb-3">🔗 Integration Example</h4>
                      <pre className="text-green-400 text-sm overflow-x-auto">
{`// JavaScript/TypeScript SDK
import { createFlagshipClient } from './sdk/flagship';

const client = createFlagshipClient('user-123', {
  userId: 'user-123',
  country: 'US'
}, {
  apiUrl: '${window.location.origin}',
  apiKey: '${app.apiKeys[0]?.keyPreview || 'your-api-key'}***'
});

const isEnabled = await client.isEnabled('your-feature-flag');`}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Help Section */}
        <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-blue-900 mb-3">🎯 Quick Actions</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <Link 
              href="/onboard"
              className="block p-4 bg-white rounded-lg hover:shadow-md transition-shadow"
            >
              <div className="font-medium text-gray-900">Create New App</div>
              <div className="text-sm text-gray-600">Register a new application and get API keys</div>
            </Link>
            <Link 
              href="/docs/integration-guide.md"
              className="block p-4 bg-white rounded-lg hover:shadow-md transition-shadow"
            >
              <div className="font-medium text-gray-900">Integration Guide</div>
              <div className="text-sm text-gray-600">Learn how to integrate with your apps</div>
            </Link>
            <Link 
              href="/"
              className="block p-4 bg-white rounded-lg hover:shadow-md transition-shadow"
            >
              <div className="font-medium text-gray-900">Manage Flags</div>
              <div className="text-sm text-gray-600">Create and configure feature flags</div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}