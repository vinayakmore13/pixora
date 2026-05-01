import { Eye, MessageSquare, TrendingUp, Zap } from 'lucide-react';
import { useState } from 'react';

interface PortfolioViewData {
  date: string;
  views: number;
}

interface InquiryData {
  week: string;
  inquiries: number;
  bookings: number;
}

interface TopImage {
  id: string;
  title: string;
  views: number;
  likes: number;
  inquiries?: number;
}

interface PhotographerStatsProps {
  photographerId: string;
  viewData?: PortfolioViewData[];
  inquiryData?: InquiryData[];
  topImages?: TopImage[];
  totalViews?: number;
  totalInquiries?: number;
  conversionRate?: number;
  isLoading?: boolean;
  isPerspectivePhotographer?: boolean; // If viewing own stats
}

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b'];

export function PhotographerStats({
  photographerId,
  viewData = [],
  inquiryData = [],
  topImages = [],
  totalViews = 0,
  totalInquiries = 0,
  conversionRate = 0,
  isLoading = false,
  isPerspectivePhotographer = false,
}: PhotographerStatsProps) {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');
  const [selectedMetric, setSelectedMetric] = useState<'views' | 'inquiries' | 'conversion'>('views');

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-gray-200 rounded-lg animate-pulse" />
      </div>
    );
  }

  // Mock data for demonstration (replace with real data from API)
  const mockViewData = viewData.length > 0 ? viewData : [
    { date: 'Mon', views: 120 },
    { date: 'Tue', views: 150 },
    { date: 'Wed', views: 200 },
    { date: 'Thu', views: 180 },
    { date: 'Fri', views: 250 },
    { date: 'Sat', views: 280 },
    { date: 'Sun', views: 210 },
  ];

  const mockInquiryData = inquiryData.length > 0 ? inquiryData : [
    { week: 'Week 1', inquiries: 12, bookings: 8 },
    { week: 'Week 2', inquiries: 15, bookings: 9 },
    { week: 'Week 3', inquiries: 18, bookings: 12 },
    { week: 'Week 4', inquiries: 22, bookings: 15 },
  ];

  const mockTopImages = topImages.length > 0 ? topImages : [
    { id: '1', title: 'Bride Portrait', views: 450, likes: 120, inquiries: 8 },
     { id: '2', title: 'User Portrait', views: 380, likes: 98, inquiries: 6 },
    { id: '3', title: 'Reception Moment', views: 320, likes: 85, inquiries: 5 },
  ];

  const stats = [
    {
      label: 'Portfolio Views',
      value: totalViews.toLocaleString(),
      change: '+12%',
      icon: Eye,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      label: 'Booking Inquiries',
      value: totalInquiries.toString(),
      change: '+8%',
      icon: MessageSquare,
      color: 'bg-purple-100 text-purple-600',
    },
    {
      label: 'Conversion Rate',
      value: `${conversionRate || 15}%`,
      change: '+3%',
      icon: Zap,
      color: 'bg-amber-100 text-amber-600',
    },
    {
      label: 'Avg. Response Time',
      value: '2h',
      change: '-20%',
      icon: TrendingUp,
      color: 'bg-green-100 text-green-600',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Performance Analytics</h2>
          {isPerspectivePhotographer && (
            <p className="text-gray-600 mt-2">Track your portfolio performance and booking metrics</p>
          )}
        </div>
        {isPerspectivePhotographer && (
          <div className="flex gap-2">
            {(['week', 'month', 'year'] as const).map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  timeRange === range
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <Icon size={24} />
                </div>
                <span className="text-sm font-semibold text-green-600">{stat.change}</span>
              </div>
              <p className="text-gray-600 text-sm mb-1">{stat.label}</p>
              <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Portfolio Views Chart */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Portfolio Views Over Time</h3>
          <div className="space-y-3">
            {mockViewData.map((item, idx) => {
              const maxValue = Math.max(...mockViewData.map(d => d.views));
              const percentage = (item.views / maxValue) * 100;
              return (
                <div key={idx} className="flex items-center gap-3">
                  <div className="w-10 text-sm font-semibold text-gray-600 text-right">
                    {item.date}
                  </div>
                  <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="w-12 text-right text-sm font-semibold text-gray-900">
                    {item.views}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Inquiries vs Bookings */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Inquiries & Bookings</h3>
          <div className="space-y-4">
            {mockInquiryData.map((item, idx) => {
              const totalMax = Math.max(...mockInquiryData.map(d => d.inquiries + d.bookings));
              const inquiryPercent = (item.inquiries / totalMax) * 100;
              const bookingPercent = (item.bookings / totalMax) * 100;
              return (
                <div key={idx}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-700">{item.week}</span>
                    <span className="text-xs text-gray-600">
                      {item.inquiries} inquiries, {item.bookings} bookings
                    </span>
                  </div>
                  <div className="flex gap-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="bg-purple-500 rounded-l-full transition-all"
                      style={{ width: `${inquiryPercent}%` }}
                      title={`Inquiries: ${item.inquiries}`}
                    />
                    <div
                      className="bg-blue-500 rounded-r-full transition-all"
                      style={{ width: `${bookingPercent}%` }}
                      title={`Bookings: ${item.bookings}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-6 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500" />
              <span className="text-sm text-gray-600">Inquiries</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-sm text-gray-600">Bookings</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Performing Images */}
      {mockTopImages.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Top Performing Images</h3>
          <div className="space-y-4">
            {mockTopImages.map((image, idx) => (
              <div key={image.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                {/* Rank Badge */}
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                  {idx + 1}
                </div>

                {/* Image Info */}
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{image.title}</h4>
                  <div className="flex gap-4 mt-2">
                    <span className="text-sm text-gray-600 flex items-center gap-1">
                      <Eye size={16} /> {image.views} views
                    </span>
                    <span className="text-sm text-gray-600 flex items-center gap-1">
                      ❤️ {image.likes} likes
                    </span>
                    {image.inquiries && (
                      <span className="text-sm text-gray-600 flex items-center gap-1">
                        <MessageSquare size={16} /> {image.inquiries} inquiries
                      </span>
                    )}
                  </div>
                </div>

                {/* Performance Bar */}
                <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-600 to-purple-600"
                    style={{ width: `${Math.min((image.views / 500) * 100, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insights & Recommendations */}
      {isPerspectivePhotographer && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-200">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Zap className="text-blue-600" size={20} />
            Performance Insights
          </h3>
          <ul className="space-y-3 text-gray-700">
            <li className="flex items-start gap-3">
              <span className="text-green-600 font-bold mt-1">✓</span>
              <span>Your wedding portfolio is getting 40% more views than average. Keep uploading high-quality wedding content!</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-blue-600 font-bold mt-1">→</span>
              <span>Respond to inquiries within 2 hours to increase booking conversion by 25%</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-purple-600 font-bold mt-1">✚</span>
              <span>Add event/user testimonials - profiles with reviews convert 3x better!</span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

