import { Method } from 'axios';
import PostMateChildClient from './child';
import PostMateParentClient from './parent';

export interface IMessage {
    method: Method,
    url: string,
    version: string,
    data?: string
}

export interface IPostMateOptions {
    url: string;
    container: HTMLElement | null;
    name: string;
    classListArray: string[];
}
export type IPostClientType = "child" | "parent";
export type IPostMateClient = (options: IPostMateOptions) => Promise<PostMateChildClient | PostMateParentClient>;
/**
 * 请求体
 */
export interface IPostMateMessage {
    method: Method;
    version: string;
    url: string;
    data?: any;
}
export type IPostMateServices<T = any> = (data: any) => T | Promise<T>;
