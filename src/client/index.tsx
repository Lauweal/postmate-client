import React, { createContext, useContext, useMemo, useRef } from "react";
import Postmate, { Model } from 'postmate';
import PostMateChildClient from "./child";
import { IPostClientType, IPostMateOptions, IPostMateServices } from "./interface";
import PostMateParentClient from "./parent";
import { groupLog } from "../log";
import { Method } from "axios";

export interface IPostmateContext {
    open: (type: IPostClientType, options?: IPostMateOptions) => Promise<boolean>;
    send: (method: Method, url: string, data?: any) => Promise<any>;
    services: (method: Method, url: string, func: IPostMateServices) => void;
    remove: () => void;
}

export const PostmateContext = createContext<IPostmateContext>({
    open: (type: IPostClientType, options?: IPostMateOptions) => Promise.resolve(false),
    send: (method: Method, url: string, data?: any) => Promise.resolve(undefined),
    services: (method: Method, url: string, func: IPostMateServices) => { },
    remove: () => { }
});

export function PostmateProvider(props: any) {
    const postmate = useRef<PostMateChildClient | PostMateParentClient | null>(null);

    const create = (type: IPostClientType, options?: IPostMateOptions): Promise<PostMateChildClient | PostMateParentClient> => {
        if (type === 'parent') {
            return new Postmate(options as any).then((res) => new PostMateParentClient(res));
        }
        return new Postmate.Model({
            height: function () { return (document as any).height || document.body.offsetHeight; },
        }).then((res) => new PostMateChildClient(res));
    }

    const open = useMemo(() => {
        return (type: IPostClientType, options?: IPostMateOptions) => {
            if (postmate.current) {
                postmate.current.remove();
                postmate.current = null;
            }
            return create(type, options).then((res) => {
                if (!res) return false;
                groupLog('[SUCCESS] 初始化成功')
                postmate.current = res;
                return true;
            })
        }
    }, [postmate.current]);

    const send = useMemo(() => {
        return (method: Method, url: string, data?: any) => {
            if (!postmate.current) return Promise.resolve(undefined);
            return postmate.current.send(method, url, data);
        }
    }, [postmate.current]);

    const services = useMemo(() => {
        return (method: Method, url: string, func: IPostMateServices) => {
            if (!postmate.current) return;
            return postmate.current.services(method, url, func);
        }
    }, [postmate.current]);

    const remove = useMemo(() => {
        return () => {
            if (!postmate.current) return;
            return postmate.current.remove();
        }
    }, [postmate.current])

    return (
        <PostmateContext.Provider
            value={{
                open,
                send,
                services,
                remove
            }}
        >
            {props.children}
        </PostmateContext.Provider>
    );
}