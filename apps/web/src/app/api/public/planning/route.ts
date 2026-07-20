import { NextRequest, NextResponse } from 'next/server'
import {
  MAX_BODY_BYTES,
  RateLimitError,
  fetchPlanningApplications,
  validateBoundary,
  type Boundary,
} from './planit'

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
 * Responds with NDJSON, one JSON object per line. A lookup fans out across the
 * planning authorities covering the boundary and can run for a minute or more,
 * so progress is streamed rather than leaving the client on a blank spinner:
 *
 *   {"type":"progress","done":3,"total":18,"authority":"Camden"}
 *   {"type":"result","applications":[…],"total":n,"truncated":b,"truncationReason":r}
 *
 * Exactly one terminal line is always emitted — `result`, or `error` if the
 * lookup failed. Validation failures still return plain JSON with an HTTP
 * status, because they fail before the stream opens.
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
        const result = await fetchPlanningApplications(boundary as Boundary, {
          onProgress: (progress) => send({ type: 'progress', ...progress }),
        })
        send({ type: 'result', ...result })
      } catch (error) {
        // The stream has already returned 200, so failures are terminal lines
        // rather than status codes; the client surfaces `error` either way.
        send({
          type: 'error',
          error:
            error instanceof RateLimitError
              ? 'Planning data is temporarily rate-limited — try again in a few minutes'
              : error instanceof Error
                ? error.message
                : 'Internal server error',
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      // Progress is only useful unbuffered, and a streamed response must not
      // be cached by shared caches the way the old single-shot JSON was.
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  })
}
