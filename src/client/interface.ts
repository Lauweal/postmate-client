export type ClientActions = "send" | "close" | "message" | "detect";

export type ClientMessage = {
    action: ClientActions;
    type: string;
    payload: any;
}

export type ClientPayload = {
    method: Method,
    url: string,
    version?: string,
    data?: any
}

export type ClientServices = (data: any) => any;


export type Response<T = any> = {
    code: number;
    data: T;
    message: string;
}

export type ServiceFuc<P = any, T = any> = (data: P) => Promise<Response<T>> | Response<T>;


export type Method = "GET" | "POST" | "DELETE" | "PUT";