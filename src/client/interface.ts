import PostMateChildClient from './children';
import PostMateMainClient from './main';

export interface IMessage {
    method: Method,
    url: string,
    version: string,
    data?: any
}

export interface IPostMateOptions {
    url: string;
    container: HTMLElement | null;
    name: string;
    classListArray: string[];
}
export type IPostClientType = "child" | "parent";
export type IPostMateClient = (options: IPostMateOptions) => Promise<PostMateChildClient | PostMateMainClient>;
/**
 * 请求体
 */
export interface IPostMateMessage {
    method: Method;
    version: string;
    url: string;
    data?: any;
}

export type Response<T = any> = {
    code: number;
    data: T;
    message: string;
}

export type ServiceFuc<P = any, T = any> = (data: P) => Promise<Response<T>> | Response<T>;


export type Method = "GET" | "POST" | "DELETE" | "PUT";