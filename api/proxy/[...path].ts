import type { VercelRequest, VercelResponse } from '@vercel/node'

const CONVERTER_URL = process.env.VITE_CONVERTER_URL || 'https://hub.zfenix.com/converter'

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')

    if (req.method === 'OPTIONS') {
        return res.status(204).end()
    }

    // Build target URL: /api/proxy/... → CONVERTER_URL/...
    const path = (req.query.path as string[] || []).join('/')
    const targetUrl = `${CONVERTER_URL}/${path}`

    try {
        // Forward the request to the real converter
        const fetchOptions: RequestInit = {
            method: req.method,
            headers: {
                'Content-Type': req.headers['content-type'] || 'application/json',
                ...(req.headers['authorization'] ? { 'Authorization': req.headers['authorization'] } : {}),
            },
        }

        // For POST/PUT, forward body
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            // Body is already parsed by Vercel, re-stringify
            fetchOptions.body = JSON.stringify(req.body)
        }

        const response = await fetch(targetUrl, fetchOptions)
        const data = await response.json()

        return res.status(response.status).json(data)
    } catch (err: any) {
        console.error('[Proxy] Error:', err)
        return res.status(502).json({ error: 'Proxy error', detail: err.message })
    }
}
