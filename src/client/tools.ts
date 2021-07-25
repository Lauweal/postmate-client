import { clientActions, messageType } from "./const"
import { ClientMessage } from "./interface"

export function sanitize(message: MessageEvent<ClientMessage>, allowedOrigin: string) {
    if (
        typeof allowedOrigin === 'string' &&
        message.origin !== allowedOrigin
    ) return false
    if (!message.data) return false
    if (
        typeof message.data === 'object' &&
        !('postmate' in message.data)
    ) return false
    if ((message.data as any).type !== messageType) return false
    if (!clientActions.includes((message.data as any).action as any)) return false
    return true
}

export const resolveOrigin = (url: string) => {
    const a = document.createElement('a')
    a.href = url
    const protocol = a.protocol.length > 4 ? a.protocol : window.location.protocol
    const host = a.host.length ? ((a.port === '80' || a.port === '443') ? a.hostname : a.host) : window.location.host
    return a.origin || `${protocol}//${host}`
}