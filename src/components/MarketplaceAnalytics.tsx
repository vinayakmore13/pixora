import { Award, BarChart3, Calendar, Search, TrendingUp, Users, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { marketplaceEngine } from '../lib/marketplaceMatching';

interface MarketplaceAnalyticsProps {
  isPhotographerView?: boolean;
}

export function MarketplaceAnalytics({ isPhotographerView = false }: MarketplaceAnalyticsProps) {
  const [trends, setTrends] = useState<Array<{ style: string; volume: number }>>([]);
  const [selectedTrend, setSelectedTrend] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTrends = async () => {
      try {
        const trendingStyles = await marketplaceEngine.getTrendingStyles();
        setTrends(trendingStyles);
        if (trendingStyles.length > 0) {
          setSelectedTrend(trendingStyles[0].style);
        }
      } catch (error) {
        console.error('Error loading trends:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTrends();
  }, []);

  const mockInsights = [
    {
      title: 'Weddings',
      volume: 8450,
      growth: '+23%',
      avgBudget: '₹80,000',
      demand: 'Very High',
      color: 'from-pink-600 to-red-600',
    },
    {
      title: 'Engagement',
      volume: 5230,
      growth: '+18%',
      avgBudget: '₹50,000',
      demand: 'High',
      color: 'from-purple-600 to-pink-600',
    },
    {
      title: 'Pre-Wedding Shoots',
      volume: 4120,
      growth: '+15%',
      avgBudget: '₹45,000',
      demand: 'High',
      color: 'from-blue-600 to-purple-600',
    },
    {
      title: 'Corporate Events',
      volume: 2840,
      growth: '+12%',
      avgBudget: '₹60,000',
      demand: 'Moderate',
      color: 'from-green-600 to-blue-600',
    },
    {
      title: 'Portraits',
      volume: 6230,
      growth: '+28%',
      avgBudget: '₹25,000',
      demand: 'Very High',
      color: 'from-orange-600 to-pink-600',
    },
    {
      title: 'Birthday Parties',
      volume: 3450,
      growth: '+19%',
      avgBudget: '₹35,000',
      demand: 'Moderate',
      color: 'from-yellow-600 to-orange-600',
    },
  ];

  const demandMetrics = [
    { icon: Search, label: 'Search Volume', value: '32.5K', change: '+15%', color: 'bg-blue-100 text-blue-600' },
    { icon: Users, label: 'Active Clients', value: '8,430', change: '+22%', color: 'bg-purple-100 text-purple-600' },
    { icon: Award, label: 'Photographers', value: '1,256', change: '+8%', color: 'bg-green-100 text-green-600' },
    { icon: Calendar, label: 'Bookings', value: '4,521', change: '+31%', color: 'bg-orange-100 text-orange-600' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Marketplace Insights</h1>
        <p className="text-xl text-gray-600">
          {isPhotographerView
            ? 'Real-time marketplace trends to help you optimize your portfolio'
            : 'Discover what\'s trending and find the perfect photographer'}
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {demandMetrics.map((metric, idx) => {
          const Icon = metric.icon;
          return (
            <div key={idx} className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className={`inline-flex p-3 rounded-lg ${metric.color} mb-4`}>
                <Icon size={20} />
              </div>
              <p className="text-gray-600 text-sm mb-1">{metric.label}</p>
              <div className="flex items-end gap-2">
                <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
                <span className="text-green-600 font-semibold text-sm mb-1">{metric.change}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Trending Styles Grid */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <TrendingUp size={28} className="text-blue-600" />
          Hot Photography Styles Right Now
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockInsights.map((insight, idx) => {
            const maxVolume = Math.max(...mockInsights.map(i => i.volume));
            const percentage = (insight.volume / maxVolume) * 100;

            return (
              <div
                key={idx}
                onClick={() => setSelectedTrend(insight.title)}
                className={`p-6 rounded-xl border-2 cursor-pointer transition-all ${
                  selectedTrend === insight.title
                    ? 'border-blue-600 bg-blue-50 shadow-lg'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">{insight.title}</h3>
                  <span className={`text-green-600 font-bold text-sm bg-green-50 px-2 py-1 rounded`}>
                    {insight.growth}
                  </span>
                </div>

                {/* Volume Bar */}
                <div className="mb-4">
                  <div className="text-sm text-gray-600 mb-2">
                    {insight.volume.toLocaleString()} searches this month
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${insight.color}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Avg Budget</span>
                    <span className="font-semibold text-gray-900">{insight.avgBudget}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Demand Level</span>
                    <span className="font-semibold text-gray-900">{insight.demand}</span>
                  </div>
                </div>

                {/* Action */}
                <button
                  className={`w-full mt-4 py-2 rounded-lg font-semibold transition-all ${
                    selectedTrend === insight.title
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {isPhotographerView ? 'Check Opportunities' : 'Find Photographers'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pricing Insights */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-8 border border-blue-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <BarChart3 size={28} className="text-blue-600" />
          Price Insights for {selectedTrend || 'Weddings'}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg p-6">
            <p className="text-gray-600 text-sm mb-2">Entry Level</p>
            <p className="text-3xl font-bold text-gray-900">₹30,000</p>
            <p className="text-gray-500 text-xs mt-1">1-3 years experience</p>
          </div>
          <div className="bg-white rounded-lg p-6 border-2 border-blue-600">
            <p className="text-gray-600 text-sm mb-2">Mid-Range (Most Popular)</p>
            <p className="text-3xl font-bold text-blue-600">₹60,000</p>
            <p className="text-gray-500 text-xs mt-1">5-10 years experience</p>
          </div>
          <div className="bg-white rounded-lg p-6">
            <p className="text-gray-600 text-sm mb-2">Premium</p>
            <p className="text-3xl font-bold text-gray-900">₹100,000+</p>
            <p className="text-gray-500 text-xs mt-1">10+ years, award-winning</p>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-white rounded-xl p-8 border border-gray-200 shadow-sm">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Zap size={24} className="text-yellow-600" />
          Smart Tips
        </h2>

        {isPhotographerView ? (
          <ul className="space-y-3 text-gray-700">
            <li className="flex gap-3">
              <span className="text-blue-600 font-bold">1.</span>
              <span>
                <strong>Weddings & Engagement</strong> are trending up 23% — consider specializing in these high-demand,
                high-budget categories
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-blue-600 font-bold">2.</span>
              <span>
                <strong>Portraits</strong> have the highest growth (28%) — add portrait sessions to capture this demand
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-blue-600 font-bold">3.</span>
              <span>
                <strong>Premium pricing</strong> works — photographers charging ₹80,000+ are booking 40% more events
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-blue-600 font-bold">4.</span>
              <span>
                <strong>Update your portfolio</strong> with trending styles to attract more AI matches from clients
              </span>
            </li>
          </ul>
        ) : (
          <ul className="space-y-3 text-gray-700">
            <li className="flex gap-3">
              <span className="text-blue-600 font-bold">1.</span>
              <span>
                <strong>Wedding season</strong> is in full demand (8,450 monthly searches) — book early to get the best
                photographers
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-blue-600 font-bold">2.</span>
              <span>
                <strong>Portrait shoots</strong> are most affordable (₹25,000 avg) — great option for a quality session
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-blue-600 font-bold">3.</span>
              <span>
                <strong>Mid-range photographers</strong> (₹50-80K) offer best value — 5-10 years experience with high
                ratings
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-blue-600 font-bold">4.</span>
              <span>
                <strong>Use our AI matcher</strong> to find photographers who perfectly fit your event type and budget
              </span>
            </li>
          </ul>
        )}
      </div>
    </div>
  );
}

