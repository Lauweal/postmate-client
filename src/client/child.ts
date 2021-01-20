import { Method } from "axios";
import md5 from "md5";
import { ChildAPI } from "postmate";
import { IMessage } from "./interface";
import { groupLog } from "../log";

export default class PostMateChildClient {
	constructor(private client: ChildAPI) {
		(this.client as any).model = {
			services: async (message: IMessage) => {
				const { method, url, version, data } = message;
				const key = md5(`${method}-${url}`);
				const func = this.servicesFunc.get(key);
				if (func && typeof func === "function") {
					const res = await func(data);
					if (!res)
						return groupLog(
							`[iframe无处理处理结果:${version}]: ${method}-${url}`,
							{}
						);
					this.client.emit('response', { ...message, data: res });
					return groupLog(`[iframe处理结果:${version}]: ${method}-${url}`);
				}
				return groupLog(`[iframe暂无当前操作:${version}]: ${method}-${url}`);
			},
			response: (message: IMessage) => {
				const func = this.responseFunc.get(message.version);
				if (func) {
					return func(message.data);
				}
			},
		};
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

	send = (method: Method, url: string, data?: any) => {
		const params = this.message(method, url, data);
		groupLog(`[iframe发送消息:${params.version}] ${method}-${url}`, data);
		return new Promise((res, rej) => {
			this.responseFunc.set(params.version, res);
			this.client.emit("services", params);
		})
			.then((res) => {
				groupLog(`[window响应消息:${params.version}] ${method}-${url}`, res);
				this.responseFunc.delete(params.version);
			})
			.catch((error) => {
				groupLog(
					`[iframe发送消息异常:${params.version}] ${method}-${url}`,
					error
				);
			});
	};
	
	remove = () => {}

	services = (
		method: Method,
		url: string,
		func: (data?: any) => Promise<any> | any
	) => {
		const key = md5(`${method}-${url}`);
		this.servicesFunc.set(key, func);
	};
}
