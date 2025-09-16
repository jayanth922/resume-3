'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Application {
  id: string;
  name: string;
  description?: string;
  ownerEmail: string;
  environment: string;
  createdAt: string;
  _count: {
    apiKeys: number;
    flags: number;
  };
}

interface NewApplicationResult {
  application: Application;
  apiKey: {
    id: string;
    key: string;
    preview: string;
  };
}

export default function OnboardingPage() {
  const [step, setStep] = useState<'register' | 'success'>('register');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NewApplicationResult | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    ownerEmail: '',
    environment: 'production' as 'development' | 'staging' | 'production'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
        setStep('success');
      } else {
        alert(data.error || 'Failed to create application');
      }
    } catch (error) {
      console.error('Error creating application:', error);
      alert('Error creating application');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  if (step === 'success' && result) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-gray-900">🎉 Application Created!</h1>
              <p className="text-gray-600 mt-2">Your feature flag service is ready to use</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Application Details */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">Application Details</h2>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Name</label>
                    <p className="text-gray-900">{result.application.name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Environment</label>
                    <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full ml-2">
                      {result.application.environment}
                    </span>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Application ID</label>
                    <div className="flex items-center gap-2">
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded">{result.application.id}</code>
                      <button 
                        onClick={() => copyToClipboard(result.application.id)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* API Key */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <h2 className="text-xl font-semibold text-red-800">⚠️ Save Your API Key</h2>
                </div>
                <p className="text-red-700 mb-4 text-sm">
                  This is the only time you'll see the full API key. Store it securely!
                </p>
                <div className="bg-white rounded border p-3">
                  <label className="text-sm font-medium text-gray-500">API Key</label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded flex-1 break-all">
                      {result.apiKey.key}
                    </code>
                    <button 
                      onClick={() => copyToClipboard(result.apiKey.key)}
                      className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Integration Guide */}
            <div className="mt-8 bg-blue-50 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-blue-900">🚀 Quick Integration</h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium mb-2">JavaScript/TypeScript</h3>
                  <pre className="bg-gray-900 text-green-400 p-3 rounded text-sm overflow-x-auto">
{`import { createFlagshipClient } from './sdk/javascript';

const client = createFlagshipClient('user-123', {
  userId: 'user-123',
  country: 'US'
}, {
  apiUrl: '${window.location.origin}',
  apiKey: '${result.apiKey.preview}***'
});

const isEnabled = await client.isEnabled('my-feature');`}
                  </pre>
                </div>
                <div>
                  <h3 className="font-medium mb-2">Python</h3>
                  <pre className="bg-gray-900 text-green-400 p-3 rounded text-sm overflow-x-auto">
{`from sdk.python import create_flagship_client

config = FlagshipConfig(
    api_url='${window.location.origin}',
    api_key='${result.apiKey.preview}***'
)

async with create_flagship_client('user-123', config) as client:
    is_enabled = await client.is_enabled('my-feature')`}
                  </pre>
                </div>
              </div>
            </div>

            {/* Next Steps */}
            <div className="mt-8 text-center">
              <h2 className="text-xl font-semibold mb-4">Next Steps</h2>
              <div className="grid md:grid-cols-3 gap-4 mb-6">
                <Link href="/dashboard" className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
                  📊 View Dashboard
                </Link>
                <Link href="/flags" className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors">
                  🚩 Create Your First Flag
                </Link>
                <Link href="/docs" className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors">
                  📚 Read Integration Docs
                </Link>
              </div>
              <p className="text-gray-600 text-sm">
                Need help? Check out our <a href="/docs" className="text-blue-600 hover:underline">documentation</a> or 
                contact support at <a href="mailto:support@flagship.dev" className="text-blue-600 hover:underline">support@flagship.dev</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">🚀 Welcome to Flagship</h1>
          <p className="text-xl text-gray-600">Register your application to start using feature flags</p>
        </div>

        <div className="bg-white rounded-lg shadow p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Application Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="My Awesome App"
              />
              <p className="text-sm text-gray-500 mt-1">
                A descriptive name for your application
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description (Optional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                placeholder="Brief description of your application"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Owner Email *
              </label>
              <input
                type="email"
                required
                value={formData.ownerEmail}
                onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="you@company.com"
              />
              <p className="text-sm text-gray-500 mt-1">
                Used for notifications and account management
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Environment *
              </label>
              <select
                value={formData.environment}
                onChange={(e) => setFormData({ ...formData, environment: e.target.value as 'development' | 'staging' | 'production' })}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="development">Development</option>
                <option value="staging">Staging</option>
                <option value="production">Production</option>
              </select>
              <p className="text-sm text-gray-500 mt-1">
                Choose the environment this application will run in
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="font-medium text-blue-900">What happens next?</h3>
                  <ul className="text-sm text-blue-800 mt-1 space-y-1">
                    <li>• You'll receive a unique API key for your application</li>
                    <li>• Use the API key to authenticate SDK requests</li>
                    <li>• Create feature flags and start experimenting safely</li>
                    <li>• Monitor usage and performance through the dashboard</li>
                  </ul>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {loading ? 'Creating Application...' : 'Create Application & Get API Key'}
            </button>
          </form>
        </div>

        <div className="mt-8 text-center">
          <p className="text-gray-600">
            Already have an application? <Link href="/dashboard" className="text-blue-600 hover:underline">View Dashboard</Link>
          </p>
        </div>
      </div>
    </div>
  );
}