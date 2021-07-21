import md5 from 'md5';
import Postmate, { ChildAPI } from 'postmate';
import { LOGTYPE } from '../log';
import { IMessage, Method, ServiceFuc } from './interface';

export default class PostMateChildClient {
    private queue = new Map<string, (value: any) => void>([]);
    private services = new Map<string, ServiceFuc>([]);
    constructor(private client: ChildAPI | any, private log: (type: LOGTYPE, tag: string, ...message: any) => void) {
        this.client.model.services = async (message: IMessage) => {
            const { method, url, version, data } = message;
            const key = md5(`${method}-${url}`);
            this.log('message', `[PARENT请求] ${method}:${url} ${version}`, "[PARENT参数]", data);
            const func = this.services.get(key);
            if (!func || typeof func !== 'function') {
                this.log('error', `[PARENT请求] ${method}:${url} ${version}`, "[CHILDREN]缺少调用函数");
                return (await this.client)?.emit('response', { ...message, data: { code: -1, data: null, message: '[CHILDREN]缺少调用函数' } });
            }
            const res = await func(data);
            if (!res) {
                this.log('error', `[PARENT请求] ${method}:${url} ${version}`, "[CHILDREN]无返回信息");
                return (await this.client).emit('response', { ...message, data: { code: -1, data: null, message: '[CHILDREN]无返回信息' } });
            }
            return (await this.client).emit('response', { ...message, data: { code: 1, data: res, message: '[CHILDREN]返回数据' } });
        };
        this.client.model.response = async (message: IMessage) => {
            const { method, url, version, data } = message;
            const func = this.queue.get(version);
            if (!func || typeof func !== 'function') return this.log('error', `[PARENT返回] ${method}:${url} ${version}`, "[CHILD]缺少任务");
            if (!data.data && data.code === -1) {
                this.queue.delete(version);
                return func(null);
            }
            return func(data.data);
        };
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

    }

    send = (method: Method, url: string, data?: any): Promise<any> => {
        const params = this.message(method, url, data);
        this.log("message", `[CHILDREN发起请求] ${method}:${url} ${params.version}`, params);
        return new Promise((res, rej) => {
            try {
                this.queue.set(params.version, res);
                this.client?.emit("services", params);
            } catch (error) {
                rej(error);
            }
        })
            .then((res) => {
                this.log('message', `[PARENT回应] ${method}:${url} ${params.version}`, res);
                this.queue.delete(params.version);
                return res;
            })
            .catch((error) => {
                this.log("error", `[CHILDREN请求异常] ${method}:${url} ${params.version}`, error);
                return null
            });
    };

    service = <P = any, T = any>(
        method: Method,
        url: string,
        func: ServiceFuc<P, T>
    ) => {
        const key = md5(`${method}-${url}`);
        this.log('register', `[CHILDREN注册函数] ${method}:${url}`, func);
        this.services.set(key, func);
    };
}