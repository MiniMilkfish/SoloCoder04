const getApiBaseUrl = () => {
  if (window.location.protocol === 'file:') {
    return 'http://localhost:3001';
  }
  return '';
};

const CONFIG = {
  API_BASE_URL: getApiBaseUrl(),
  CHUNK_SIZE: 5 * 1024 * 1024,
  MAX_FILE_SIZE: 100 * 1024 * 1024,
  MAX_RETRY_COUNT: 3,
  TOKEN_KEY: 'file_manager_token',
  USER_KEY: 'file_manager_user'
};
