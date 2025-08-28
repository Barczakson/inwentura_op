import { NextRequest } from 'next/server'
import { GET } from '../route'

describe('/api/health', () => {
  it('should return health status', async () => {
    const request = new NextRequest('http://localhost:3000/api/health', {
      method: 'GET',
    })

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ message: 'Good!' })
  })

  it('should return JSON response', async () => {
    const response = await GET()
    
    expect(response.headers.get('content-type')).toContain('application/json')
  })

  it('should be accessible without authentication', async () => {
    // Health endpoint should be publicly accessible
    const request = new NextRequest('http://localhost:3000/api/health', {
      method: 'GET',
      headers: {
        // No authorization headers
      }
    })

    const response = await GET()
    
    expect(response.status).toBe(200)
  })

  it('should handle multiple concurrent requests', async () => {
    const requests = Array.from({ length: 10 }, () => GET())
    const responses = await Promise.all(requests)

    responses.forEach(response => {
      expect(response.status).toBe(200)
    })

    const data = await Promise.all(responses.map(r => r.json()))
    data.forEach(d => {
      expect(d).toEqual({ message: 'Good!' })
    })
  })

  it('should respond quickly', async () => {
    const start = Date.now()
    const response = await GET()
    const end = Date.now()

    expect(response.status).toBe(200)
    expect(end - start).toBeLessThan(100) // Should respond in less than 100ms
  })
})
