// ============================================
// Mock Data — StreamTube Pro
// Configuration data only (no fake traffic data)
// ============================================

export const channelData = {
  name: 'StreamTube Pro Channel',
  handle: '@streamtubepro',
  avatar: null,
  subscribers: 0,
  totalViews: 0,
  totalVideos: 0,
  joinedDate: new Date().toISOString().split('T')[0],
};

export const recentStreams = [];

export const analyticsData = {
  viewersOverTime: [],
  chatRate: [],
  revenueBreakdown: [],
  stats: {
    avgViewers: 0,
    peakViewers: 0,
    totalChatMessages: 0,
    newSubscribers: 0,
    watchTimeHours: 0,
    revenue: 0,
  },
};

export const chatMessages = [];

export const scheduledStreams = [];

export const overlayScenes = [
  {
    id: 1, name: 'Main Scene', active: true,
    items: [
      { id: 'w1', type: 'webcam', label: 'Webcam', visible: true, x: 20, y: 400, w: 320, h: 240 },
      { id: 's1', type: 'screen', label: 'Screen Share', visible: true, x: 0, y: 0, w: 1920, h: 1080 },
      { id: 't1', type: 'text', label: 'Stream Title', visible: true, x: 20, y: 20, w: 400, h: 40 },
    ],
  },
  {
    id: 2, name: 'BRB Scene', active: false,
    items: [
      { id: 'i1', type: 'image', label: 'BRB Banner', visible: true, x: 0, y: 0, w: 1920, h: 1080 },
      { id: 't2', type: 'text', label: 'Be Right Back!', visible: true, x: 600, y: 500, w: 720, h: 80 },
    ],
  },
  {
    id: 3, name: 'Just Chatting', active: false,
    items: [
      { id: 'w2', type: 'webcam', label: 'Full Webcam', visible: true, x: 0, y: 0, w: 1920, h: 1080 },
      { id: 'a1', type: 'alert', label: 'Alert Box', visible: true, x: 600, y: 50, w: 720, h: 200 },
    ],
  },
];

export const categories = [
  'Gaming', 'Science & Technology', 'Education', 'Entertainment',
  'Music', 'Sports', 'News & Politics', 'People & Blogs',
  'Comedy', 'Film & Animation', 'Howto & Style', 'Travel & Events',
];

export const monetizationData = {
  superChats: [],
  memberJoins: [],
  todayRevenue: 0,
  monthRevenue: 0,
};

export const defaultStreamSettings = {
  title: '',
  description: '',
  category: 'Science & Technology',
  tags: [],
  privacy: 'public',
  latency: 'normal',
  dvr: true,
  autoCaptions: true,
  chatEnabled: true,
  slowMode: false,
  slowModeDelay: 5,
  subscriberOnly: false,
};

export const encoderPresets = [
  { id: 'auto', name: 'Auto (Recommended)', resolution: '1080p', bitrate: '4500', fps: '30' },
  { id: '1080p60', name: '1080p 60fps', resolution: '1080p', bitrate: '6000', fps: '60' },
  { id: '1080p30', name: '1080p 30fps', resolution: '1080p', bitrate: '4500', fps: '30' },
  { id: '720p60', name: '720p 60fps', resolution: '720p', bitrate: '4000', fps: '60' },
  { id: '720p30', name: '720p 30fps', resolution: '720p', bitrate: '2500', fps: '30' },
  { id: '480p30', name: '480p 30fps', resolution: '480p', bitrate: '1500', fps: '30' },
];
