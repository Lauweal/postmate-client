import { Method } from "axios";
import md5 from "md5";
import { ParentAPI } from "postmate";
import { IMessage } from "./interface";
import { groupLog } from "../log";

export default class PostMateParentClient {
    constructor(private client: ParentAPI) {
        this.client.on('services', async (message: IMessage) => {
            const { method, url, version, data } = message;
            const key = md5(`${method}-${url}`);
            const func = this.servicesFunc.get(key);
            if (func && typeof func === "function") {
                const res = await func(data);
                if (!res)
                    return groupLog(
                        `[window无处理处理结果:${version}]: ${method}-${url}`,
                        {}
                    );
                this.client.call('response', { ...message, data: res });
                return groupLog(`[window处理结果:${version}]: ${method}-${url}`);
            }
            return groupLog(`[window暂无当前操作:${version}]: ${method}-${url}`);
        });
        this.client.on('response', async (message: IMessage) => {
            const { version, data } = message;
            const func = this.responseFunc.get(version);
            if (func) {
                return func(data);
            }
        });
	}
	private responseFunc = new Map<string, (value: any) => void>([]);
	private servicesFunc = new Map<string, (data?: any) => Promise<any> | any>(
		[]
	);
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
		this.client.destroy();
	}

	send = (method: Method, url: string, data?: any) => {
		const params = this.message(method, url, data);
		groupLog(`[window发送消息:${params.version}] ${method}-${url}`, data);
		return new Promise((res, rej) => {
			this.responseFunc.set(params.version, res);
			this.client.call("services", params);
		})
			.then((res) => {
				groupLog(`[iframe响应消息:${params.version}] ${method}-${url}`, res);
				this.responseFunc.delete(params.version);
			})
			.catch((error) => {
				groupLog(
					`[window发送消息异常:${params.version}] ${method}-${url}`,
					error
				);
			});
	};

	services = (
		method: Method,
		url: string,
		func: (data?: any) => Promise<any> | any
	) => {
		const key = md5(`${method}-${url}`);
		this.servicesFunc.set(key, func);
	};
}
