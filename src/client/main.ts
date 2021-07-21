import md5 from "md5";
import { ParentAPI } from "postmate";
import { IMessage, Method, ServiceFuc } from "./interface";
import { LOGTYPE } from "../log";

export default class PostMateMainClient {
    private queue = new Map<string, (value: any) => void>([]);
    private services = new Map<string, ServiceFuc>([]);
    constructor(private client: ParentAPI, private log: (type: LOGTYPE, tag: string, ...message: any) => void) {
        this.client.on('services', async (message: IMessage) => {
            const { method, url, version, data } = message;
            const key = md5(`${method}-${url}`);
            this.log('message', `[CHILDREN请求] ${method}:${url} ${version}`, "[CHILDREN参数]", data);
            const func = this.services.get(key);
            if (!func || typeof func !== 'function') {
                this.log('error', `[CHILDREN请求] ${method}:${url} ${version}`, "[PARENT缺少调用函数");
                return (await this.client).call('response', { ...message, data: { code: -1, data: null, message: '[PARENT]缺少调用函数' } });
            }
            const res = await func(data);
            if (!res) {
                this.log('error', `[CHILDREN请求] ${method}:${url} ${version}`, "[PARENT]无返回信息");
                return (await this.client).call('response', { ...message, data: { code: -1, data: null, message: '[PARENT]无返回信息' } });
            }
            return (await this.client).call('response', { ...message, data: { code: 1, data: res, message: '[PARENT]返回数据' } });
        });
        this.client.on('response', async (message: IMessage) => {
            const { method, url, version, data } = message;
            const func = this.queue.get(version);
            if (!func || typeof func !== 'function') return this.log('error', `[CHILDREN返回] ${method}:${url} ${version}`, "[PARENT]缺少任务");
            if (!data.data && data.code === -1) {
                this.queue.delete(version);
                return func(null);
            }
            return func(data.data);
        });
    }

    private message = (method: Method, url: string, data?: any): IMessage => {
        const version = md5(
            JSON.stringify({ method, url, data, time: new Date().getTime() })
        );
        return {
            method,
            url,
            version,
            data,
        };
    };

    remove = () => {
        if (this.client.frame && this.client.frame.parentNode && this.client.frame.parentNode.removeChild) {
            this.client.destroy();
        }
    }

    send = (method: Method, url: string, data?: any): Promise<any> => {
        const params = this.message(method, url, data);
        this.log("message", `[PARENT发起请求] ${method}:${url} ${params.version}`, params);
        return new Promise((res, rej) => {
            try {
                this.queue.set(params.version, res);
                this.client?.call("services", params);
            } catch (error) {
                rej(error);
            }
        })
            .then((res) => {
                this.log('message', `[CHILDREN回应] ${method}:${url} ${params.version}`, res);
                this.queue.delete(params.version);
                return res;
            })
            .catch((error) => {
                this.log("error", `[PARENT请求异常] ${method}:${url} ${params.version}`, error);
                return null
            });
    };

    service = <P = any, T = any>(
        method: Method,
        url: string,
        func: ServiceFuc<P, T>
    ) => {
        const key = md5(`${method}-${url}`);
        this.log('register', `[PARENT注册函数] ${method}:${url}`, func);
        this.services.set(key, func);
    };
}
