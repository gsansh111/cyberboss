module.exports = {
  apps: [{
    name: 'cyberboss',
    script: 'scripts/shared-start.js',
    cwd: '/home/ubuntu/cyberboss',
    autorestart: true,
    max_restarts: 5,
    min_uptime: '30s',
    restart_delay: 30000,
    env: {
      CYBERBOSS_RUNTIME: 'claudecode',
      CYBERBOSS_CLAUDE_COMMAND: 'claude',
      CYBERBOSS_USER_NAME: '小航',
      CYBERBOSS_USER_GENDER: 'female',
      CYBERBOSS_WORKSPACE_ROOT: '/home/ubuntu/cyberboss',
      CYBERBOSS_ALLOWED_USER_IDS: 'o9cq8063gLCiSO9PGeHIUe4XSWUk@im.wechat',
      ANTHROPIC_BASE_URL: 'https://api.deepseek.com/anthropic',
      CYBERBOSS_CLAUDE_MODEL: 'deepseek-chat',
      CYBERBOSS_CHECKIN_MIN_INTERVAL_MS: '180000',
      CYBERBOSS_CHECKIN_MAX_INTERVAL_MS: '1800000',
      CYBERBOSS_ENABLE_LOCATION_SERVER: 'true',
      CYBERBOSS_VISION_MODE: 'auto',
      CYBERBOSS_VISION_PROVIDER: 'openai-compatible',
      CYBERBOSS_VISION_API_BASE_URL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      CYBERBOSS_VISION_MODEL: 'qwen3.5-omni-plus',
      CYBERBOSS_VISION_TIMEOUT_MS: '30000',
    }
  }, {
    name: 'private-chat',
    script: 'server.js',
    cwd: '/home/ubuntu/cyberboss/private-chat',
    autorestart: true,
    max_restarts: 10,
    min_uptime: '30s',
    env: {
      PORT: '4320',
    },
  }, {
    name: 'phone-reporter',
    script: 'scripts/phone-reporter.js',
    cwd: '/home/ubuntu/cyberboss',
    autorestart: true,
    max_restarts: 10,
    min_uptime: '30s',
    env: {
    },
  }, {
    name: 'cloudflare-tunnel',
    script: 'scripts/start-tunnel.sh',
    cwd: '/home/ubuntu/cyberboss',
    autorestart: true,
    max_restarts: 10,
    min_uptime: '30s',
  }]
};
