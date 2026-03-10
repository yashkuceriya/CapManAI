import axios, { AxiosInstance } from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Token interceptor
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token')
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('capman:auth-expired'))
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

// Auth API functions
export const auth = {
  login: async (username: string, password: string) => {
    const formData = new FormData()
    formData.append('username', username)
    formData.append('password', password)
    const response = await apiClient.post('/api/auth/login', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    if (response.data.access_token) {
      localStorage.setItem('token', response.data.access_token)
      localStorage.setItem('user', JSON.stringify(response.data.user))
    }
    return response.data
  },

  register: async (username: string, email: string, password: string) => {
    const response = await apiClient.post('/api/auth/register', {
      username,
      email,
      password,
    })
    if (response.data.access_token) {
      localStorage.setItem('token', response.data.access_token)
      localStorage.setItem('user', JSON.stringify(response.data.user))
    }
    return response.data
  },

  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  },
}

// User API functions
export const users = {
  getProfile: async () => {
    const response = await apiClient.get('/api/users/me')
    return response.data
  },

  getLeaderboard: async (mode: 'xp' | 'volume' | 'mastery' = 'xp') => {
    const response = await apiClient.get('/api/users/leaderboard', {
      params: { mode },
    })
    return response.data
  },
}

// Scenarios API functions
export const scenarios = {
  generateScenario: async (
    difficulty: 'beginner' | 'intermediate' | 'advanced',
    marketRegime?: string,
    targetObjectives?: string[]
  ) => {
    const response = await apiClient.post('/api/scenarios/generate', {
      difficulty,
      market_regime: marketRegime,
      target_objectives: targetObjectives,
    })
    return response.data
  },

  submitResponse: async (sessionId: string, responseText: string) => {
    const response = await apiClient.post(
      `/api/scenarios/${sessionId}/respond`,
      {
        response_text: responseText,
      }
    )
    return response.data
  },

  answerProbe: async (sessionId: string, answerText: string) => {
    const response = await apiClient.post(
      `/api/scenarios/${sessionId}/probe`,
      {
        answer_text: answerText,
      }
    )
    return response.data
  },

  gradeSession: async (sessionId: string) => {
    const response = await apiClient.post(
      `/api/scenarios/${sessionId}/grade`,
      {}
    )
    return response.data
  },

  injectCurveball: async (sessionId: string) => {
    const response = await apiClient.post(
      `/api/scenarios/${sessionId}/curveball`,
      {}
    )
    return response.data
  },

  submitAdaptation: async (sessionId: string, adaptationText: string) => {
    const response = await apiClient.post(
      `/api/scenarios/${sessionId}/adapt`,
      {
        adaptation_text: adaptationText,
      }
    )
    return response.data
  },

  listReplayEvents: async () => {
    const response = await apiClient.get('/api/scenarios/replay/events')
    return response.data
  },

  generateReplay: async (
    difficulty: 'beginner' | 'intermediate' | 'advanced',
    eventId?: string
  ) => {
    const response = await apiClient.post('/api/scenarios/replay', {
      difficulty,
      event_id: eventId,
    })
    return response.data
  },

  getReveal: async (sessionId: string) => {
    const response = await apiClient.get(`/api/scenarios/${sessionId}/reveal`)
    return response.data
  },
}

// MTSS API functions
export const mtss = {
  getOverview: async () => {
    const response = await apiClient.get('/api/mtss/overview')
    return response.data
  },

  getStudent: async (userId: string) => {
    const response = await apiClient.get(`/api/mtss/student/${userId}`)
    return response.data
  },

  getObjectives: async () => {
    const response = await apiClient.get('/api/mtss/objectives')
    return response.data
  },

  getAlerts: async () => {
    const response = await apiClient.get('/api/mtss/alerts')
    return response.data
  },
}

// H2H API functions
export const h2h = {
  create: async (difficulty: 'beginner' | 'intermediate' | 'advanced' = 'intermediate') => {
    const response = await apiClient.post('/api/h2h/create', null, {
      params: { difficulty },
    })
    return response.data
  },

  listOpenMatches: async () => {
    const response = await apiClient.get('/api/h2h/open')
    return response.data
  },

  join: async (matchId: string) => {
    const response = await apiClient.post(`/api/h2h/${matchId}/join`, {})
    return response.data
  },

  submitResponse: async (matchId: string, responseText: string) => {
    const response = await apiClient.post(`/api/h2h/${matchId}/submit`, {
      response_text: responseText,
    })
    return response.data
  },

  grade: async (matchId: string) => {
    const response = await apiClient.post(`/api/h2h/${matchId}/grade`, {})
    return response.data
  },

  getMatchStatus: async (matchId: string) => {
    const response = await apiClient.get(`/api/h2h/${matchId}`)
    return response.data
  },
}

// Peer Review API functions
export const peerReview = {
  listAvailable: async () => {
    const response = await apiClient.get('/api/peer-review/available')
    return response.data
  },

  claim: async (sessionId: string) => {
    const response = await apiClient.post(`/api/peer-review/${sessionId}/claim`, {})
    return response.data
  },

  submit: async (sessionId: string, score: number, feedback: string) => {
    const response = await apiClient.post(`/api/peer-review/${sessionId}/submit`, {
      peer_review_score: score,
      peer_review_feedback: feedback,
    })
    return response.data
  },

  myReviews: async () => {
    const response = await apiClient.get('/api/peer-review/my-reviews')
    return response.data
  },

  myReceived: async () => {
    const response = await apiClient.get('/api/peer-review/my-received')
    return response.data
  },

  seedTestData: async () => {
    const response = await apiClient.post('/api/peer-review/seed-test-data', {})
    return response.data
  },
}

// Market data API functions
export const market = {
  getQuotes: async () => {
    const response = await apiClient.get('/api/market/quotes')
    return response.data
  },

  getFlashCards: async (count: number = 5) => {
    const response = await apiClient.get('/api/market/flashcards', {
      params: { count },
    })
    return response.data
  },
}

export default apiClient
