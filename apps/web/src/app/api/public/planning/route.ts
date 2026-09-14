import { NextRequest, NextResponse } from 'next/server'
import { MAX_BODY_BYTES, validateBoundary, type Boundary } from './boundary'
import { fetchStoredPlanningApplications } from './stored'

export const dynamic = 'force-dynamic'

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    {
      applications: [],
      total: 0,
      truncated: false,
      truncationReason: null,
      error: message,
    },
    { status }
  )
}

/**
 * Planning applications inside a boundary — used by the unified workspace's
 * Planning tab (Find Gaps BUA polygon / Assess Area circle or isochrone).
 *
 * POST body: { boundary: GeoJSON Polygon | MultiPolygon }
 *
 * Reads the stored, classified Plota census (see ./stored). The PlanIt live path was
 * removed on 14 Sep 2026 once the national store was measured ready for cutover.
 *
 * Responds with NDJSON, exactly one line: `result`, or `error` if the lookup failed.
 * The line-delimited contract is kept so the client needs no second response format;
 * validation failures still return plain JSON with an HTTP status, because they fail
 * before the stream opens.
 *
 *   {"type":"result","applications":[…],"total":n,"truncated":b,"truncationReason":r,"freshness":{…}}
 */
export async function POST(request: NextRequest) {
  let boundary: unknown
  try {
    const text = await request.text()
    if (text.length > MAX_BODY_BYTES) {
      return errorResponse('Request body too large', 400)
    }
    let body: unknown
    try {
      body = JSON.parse(text)
    } catch {
      return errorResponse('Invalid JSON body', 400)
    }
    boundary = (body as { boundary?: unknown })?.boundary
    const invalid = validateBoundary(boundary)
    if (invalid) return errorResponse(invalid, 400)
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(JSON.stringify(payload) + '\n'))
      }
      try {
        const result = await fetchStoredPlanningApplications(boundary as Boundary)
        send({ type: 'result', ...result })
      } catch (error) {
        // The stream has already returned 200, so failures are terminal lines
        // rather than status codes; the client surfaces `error` either way.
        send({
          type: 'error',
          error: error instanceof Error ? error.message : 'Internal server error',
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      // A streamed response must not be held by shared caches or proxies.
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  })
}
