import md5 from 'md5';
import { LOGTYPE } from "../log";
import { messageType } from "./const";
import { ClientMessage, ClientPayload, ClientServices, Method } from "./interface";
import { resolveOrigin, sanitize } from "./tools";

export type PostmateOptions = {
    url: string;
    container: HTMLElement;
    name: string;
}

export class ClientAPI {
    private queue: Map<string, any> = new Map([]);
    private services: Map<string, ClientServices> = new Map([]);
    constructor(
        private client: Window & typeof globalThis = window,
        private children: Window | null | undefined,
        private close: () => void,
        private log: (type: LOGTYPE, tag: string, ...message: any) => void,
        private origin: string
    ) {
        this.client.addEventListener("message", this.onMessage, false);
    }

    private onMessage = (ev: MessageEvent<ClientMessage>) => {
        const { data, source } = ev;
        if (!data) return;
        const { action, payload } = data;
        if (action === 'message') {
            this.log("message", `[返回数据] ${payload.method}:${payload.url} ${payload.version}`, data);
            const func = this.queue.get(payload.version);
            if (typeof func !== 'function') return this.log("env", `[回调处理异常] ${payload.method}:${payload.url} ${payload.version}`, "缺少接受返回值的回调函数");
            func(payload);
        }
        if (action === 'send') {
            if (!payload || !payload.method || !payload.url) return this.log("error", `[收到异常数据包]`, payload);
            const { method, url, version, data } = payload;
            this.log("message", `[收到请求] ${payload.method}:${payload.url} ${version}`, data);
            const func = this.services.get(`${method}:${url}`);
            if (typeof func !== 'function') return this.log("error", `[请求处理异常] ${payload.method}:${payload.url} ${version}`, "缺少处理函数");
            const res = func(data);
            if (res && typeof res.then === 'function') return res.then((value: any) => {
                (source as any).postMessage({
                    action: "message",
                    type: messageType,
                    payload: { ...payload, data: value }
                }, ev.origin);
            }).catch((error: any) => {
                (source as any).postMessage({
                    action: "message",
                    type: messageType,
                    payload: { ...payload, data: null, error: error }
                }, ev.origin);
                return null;
            });
            (source as any).postMessage({
                action: "message",
                type: messageType,
                payload: { ...payload, data: res }
            }, ev.origin);
        }
        if (action === 'close') {
            this.log("env", "[关闭客户端]", this);
            this.client.removeEventListener("message", this.onMessage);
        }
    }

    call = (options: ClientPayload) => {
        const { method, url, data } = options;
        const version = md5(JSON.stringify({
            method,
            url,
            data,
            time: new Date().getTime()
        }));
        return new Promise<ClientPayload>((res, rej) => {
            try {
                this.children?.postMessage({
                    action: "send",
                    type: messageType,
                    payload: { ...options, version }
                }, this.origin);
                this.queue.set(version, res);
            } catch (error) {
                rej(error);
            }
        }).then((res) => {
            const { method, url, data, version } = res;
            this.queue.delete(version as string);
            return data;
        }).catch((error) => {
            this.log("error", "[请求返回异常]", error);
        });
    }

    service = (method: Method, url: string, func: ClientServices) => {
        if (typeof func !== 'function') return this.log("error", "[处理函数注册异常]", "func非函数类型");
        this.log("register", `[函数注册] ${method}:${url}`, func);
        this.services.set(`${method}:${url}`, func);
    }

    get logger() {
        return this.log;
    }

    remove = () => {
        this.close();
    }
}

export class PostmateClient {
    private iframe?: HTMLIFrameElement;
    private container?: HTMLElement;
    private origin: string = "";
    constructor(private log: (type: LOGTYPE, tag: string, ...message: any) => void, private options?: PostmateOptions) {
        if (this.options) {
            this.container = this.options.container;
            this.origin = resolveOrigin(this.options.url);
        }
    }

    /**
     * iframe 加载监听
     * @param func 
     * @returns 
     */
    private iframeLoad(func: any) {
        if (!this.iframe) return this.log("error", "缺少iframe节点");
        if ((this.iframe as any).attachEvent) return (this.iframe as any).attachEvent('onload', func);
        return this.iframe.onload = func;
    }

    private initialParent(res: (value: ClientAPI | PromiseLike<ClientAPI>) => void) {
        let _payload = {
            ack: 0,
            spc: 0
        };
        const message = (ev: MessageEvent<ClientMessage>) => {
            if ((!this.iframe || !this.iframe.contentWindow) && (!this.iframe || !this.iframe.contentDocument || !(this.iframe.contentDocument as any).parentWindow)) {
                this.log("error", 'iframe实例获取失败')
                return;
            }
            const { action, payload } = ev.data;
            const children: Window = this.iframe?.contentWindow || (this.iframe?.contentDocument as any).parentWindow;
            if (action === 'detect' && payload) {
                const { ack, spc } = payload;
                _payload = payload;
                this.log("env", "收到链接码", `[CHILDREN] ack:${ack} spc:${spc}`);
                if (ack == 0 && spc == 1) {
                    _payload.ack = ack + 1;
                    children.postMessage({
                        action: 'detect',
                        type: messageType,
                        payload: _payload
                    }, this.origin);
                }
                if (ack == 1 && spc == 1) {
                    this.log("env", "SUCCESS", `${this.origin}`);
                    res(new ClientAPI(window, children, this.remove, this.log, this.origin))
                }
            }
            if (action === 'close') {
                this.iframe.remove();
                this.container?.removeChild(this.iframe);
                window.removeEventListener("message", message);
            }
        }
        if (this.container) {
            const old = this.container.getElementsByClassName(this.options?.name as string);
            if (old.length) {
                this.iframe = old[0] as HTMLIFrameElement;
            } else {
                this.iframe = document.createElement('iframe');
                this.iframe.className = this.options?.name as string;
                this.iframe.style.setProperty("width", "100%");
                this.iframe.style.setProperty("height", "100%");
                this.iframe.style.setProperty("border", "transparent");
                this.iframe.style.setProperty("background", "#fff");
                this.container.appendChild(this.iframe as HTMLIFrameElement);
            }
        }
        this.iframeLoad(() => {
            try {
                this.log("env", "[IFRAME]加载完成", this.options?.url);
                const children: Window = this.iframe?.contentWindow || (this.iframe?.contentDocument as any).parentWindow;
                children.postMessage({
                    action: 'detect',
                    type: messageType,
                    payload: _payload
                }, this.origin);
            } catch (error) {
                console.log(error);
            }
        });
        window.addEventListener('message', message, false);
        if (this.iframe) this.iframe.src = this.options?.url as string;
    }

    private initialChildren(res: (value: ClientAPI | PromiseLike<ClientAPI>) => void) {
        const message = (ev: MessageEvent<ClientMessage>) => {
            const { action, payload } = ev.data;
            if (action === 'detect' && payload) {
                const { ack, spc } = payload;
                this.log("env", "收到链接码", `[CHILDREN] ack:${ack} spc:${spc}`);
                if (ack == 0 && spc == 0) {
                    (ev.source as any).postMessage({
                        action: 'detect',
                        type: messageType,
                        payload: {
                            ack,
                            spc: spc + 1
                        }
                    }, ev.origin);
                }
                if (ack == 1 && spc == 1) {
                    (ev.source as any).postMessage({
                        action: 'detect',
                        type: messageType,
                        payload: {
                            ack,
                            spc
                        }
                    }, ev.origin);
                    this.log("env", "SUCCESS", `ack:${ack} spc:${spc}`);
                    res(new ClientAPI(window, window.parent, this.remove, this.log, ev.origin));
                }
            }
            if (action === 'close') {
                window.removeEventListener("message", message);
                window.parent.close();
                (ev.source as any).postMessage({
                    action: 'close',
                    type: messageType,
                    payload: { status: false }
                }, ev.origin);
            }
        }
        window.addEventListener('message', message, false);
    }

    private remove() {
        if (this.container && this.iframe) {
            if ((!this.iframe || !this.iframe.contentWindow) && (!this.iframe || !this.iframe.contentDocument || !(this.iframe.contentDocument as any).parentWindow)) {
                this.log("error", 'iframe实例获取失败')
                return;
            }
            const children: Window = this.iframe?.contentWindow || (this.iframe?.contentDocument as any).parentWindow;
            children.postMessage({
                action: 'close',
                type: messageType,
                payload: { status: true }
            }, this.origin);
        }
    }

    create() {
        return new Promise<ClientAPI>((res) => {
            if (this.container) return this.initialParent(res);
            return this.initialChildren(res);
        })
    }
}