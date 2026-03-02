/**
 * Quản lý Speckle streams tạm thời.
 * - Theo dõi stream_id được tạo bởi converter
 * - Tự động xóa khi đóng tab/trình duyệt
 * - Xóa stream cũ khi upload file mới (chỉ giữ 1 stream tại 1 thời điểm)
 */

const SPECKLE_SERVER = import.meta.env.VITE_SPECKLE_SERVER_URL as string
const SPECKLE_TOKEN = import.meta.env.VITE_SPECKLE_TOKEN as string

// Lưu danh sách stream IDs cần cleanup
const tempStreamIds = new Set<string>()

/** Đăng ký stream tạm thời mới */
export function registerTempStream(streamId: string) {
    if (!streamId) return
    tempStreamIds.add(streamId)
    console.log(`[TempStream] 📌 Registered: ${streamId} (total: ${tempStreamIds.size})`)
}

/** Xóa 1 stream Speckle qua GraphQL API */
export async function deleteStream(streamId: string): Promise<boolean> {
    if (!streamId || !SPECKLE_TOKEN) return false
    try {
        const res = await fetch(`${SPECKLE_SERVER}/graphql`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SPECKLE_TOKEN}`,
            },
            body: JSON.stringify({
                query: `mutation { streamDelete(id: "${streamId}") }`,
            }),
        })
        const data = await res.json()
        if (data?.data?.streamDelete) {
            tempStreamIds.delete(streamId)
            console.log(`[TempStream] 🗑️ Deleted stream: ${streamId}`)
            return true
        } else {
            console.warn(`[TempStream] ⚠️ Failed to delete ${streamId}:`, data?.errors)
            return false
        }
    } catch (e) {
        console.warn(`[TempStream] ❌ Delete error for ${streamId}:`, e)
        return false
    }
}

/** Xóa tất cả streams tạm đã đăng ký */
export async function cleanupAllTempStreams() {
    if (tempStreamIds.size === 0) return
    console.log(`[TempStream] 🧹 Cleaning up ${tempStreamIds.size} temp stream(s)...`)
    const ids = [...tempStreamIds]
    await Promise.allSettled(ids.map(id => deleteStream(id)))
}

/**
 * Xóa stream cũ trước khi load stream mới
 * (chỉ giữ 1 dự án tạm tại 1 thời điểm)
 */
export async function replaceTempStream(oldStreamId: string | null, newStreamId: string) {
    if (oldStreamId && oldStreamId !== newStreamId) {
        await deleteStream(oldStreamId)
    }
    registerTempStream(newStreamId)
}

/** Cleanup khi đóng tab — dùng sendBeacon (fire-and-forget, đảm bảo gửi khi page unload) */
function cleanupOnUnload() {
    if (tempStreamIds.size === 0) return

    for (const streamId of tempStreamIds) {
        // sendBeacon đảm bảo request được gửi đi ngay cả khi tab đang đóng
        const payload = JSON.stringify({
            query: `mutation { streamDelete(id: "${streamId}") }`,
        })

        const blob = new Blob([payload], { type: 'application/json' })

        // Speckle GraphQL cần auth header → sendBeacon không hỗ trợ custom headers
        // Workaround: dùng fetch + keepalive
        try {
            fetch(`${SPECKLE_SERVER}/graphql`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SPECKLE_TOKEN}`,
                },
                body: payload,
                keepalive: true, // Cho phép request sống sót sau khi page unload
            }).catch(() => { }) // Ignore errors during unload
        } catch {
            // Fallback: thử sendBeacon (không có auth, có thể không hoạt động)
            navigator.sendBeacon(`${SPECKLE_SERVER}/graphql`, blob)
        }
    }

    console.log(`[TempStream] 🧹 Sent cleanup for ${tempStreamIds.size} stream(s)`)
}

// ─── Đăng ký sự kiện unload ─────────────────────────────────────────────────
if (typeof window !== 'undefined') {
    // beforeunload: user đóng tab/trình duyệt hoặc navigate away
    window.addEventListener('beforeunload', cleanupOnUnload)

    // visibilitychange → hidden: backup nếu beforeunload không fire (mobile)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            cleanupOnUnload()
        }
    })
}
