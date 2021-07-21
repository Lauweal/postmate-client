import React, { createContext, useCallback, useContext, useMemo, useRef } from "react";
import Postmate from 'postmate';
import { IPostMateOptions, Method, Response, ServiceFuc } from "./interface";
import { groupLog } from "../log";
import PostMateMainClient from "./main";
import PostMateChildClient from "./children";

export interface IPostmateContext {
    open: (options?: IPostMateOptions) => Promise<PostMateChildClient | PostMateChildClient | null>;
    send?: <T = any>(method: Method, url: string, data?: any) => Promise<Response<T>>;
    services: <P = any, T = any>(method: Method, url: string, func: ServiceFuc<P, T>) => void;
    remove: () => void;
}

export const PostmateContext = createContext<IPostmateContext>({
    open: (options?: IPostMateOptions) => Promise.resolve(null),
    services: (method: Method, url: string, func: ServiceFuc) => { },
    remove: () => { }
});

export interface IPostmateProviderProps {
    log: boolean; // 是否开启日志
    name: string;
    children: JSX.Element;
}

export function PostmateProvider(props: IPostmateProviderProps) {
    const { log, name } = props;
    const logref = useRef(groupLog(name, log));
    const container = useRef<HTMLElement>()
    const postmate = useRef<PostMateChildClient | PostMateMainClient | null>(null);

    const create = useCallback(async (options?: IPostMateOptions): Promise<PostMateChildClient | PostMateMainClient> => {
        if (options) {
            container.current = options?.container as any;
            return await new Postmate(options as any).then((res) => new PostMateMainClient(res, groupLog(name, logref.current as any)));
        }
        return await new Postmate.Model({ height: function () { return (document as any).height || document.body.offsetHeight; }, }).then((res) => new PostMateChildClient(res, groupLog(name, logref.current as any)));
    }, [log, name, logref.current]);

    const open = useCallback((options?: IPostMateOptions) => {
        if (postmate.current) {
            postmate.current.remove();
            postmate.current = null;
        }
        return create(options).then((res) => {
            if (!res) return null;
            logref.current("register", "初始化成功", res);
            postmate.current = res;
            return res;
        })
    }, [postmate.current, logref.current]);

    const send = useMemo(() => {
        return (method: Method, url: string, data?: any): Promise<Response> => {
            if (!postmate.current) return Promise.resolve({ code: -1, data: null, message: "异常" });
            return postmate.current.send(method, url, data);
        }
    }, [postmate.current]);

    const services = useMemo(() => {
        return (method: Method, url: string, func: ServiceFuc) => {
            if (!postmate.current) return;
            return postmate.current.service<any, any>(method, url, func);
        }
    }, [postmate.current]);

    const remove = useMemo(() => {
        return () => {
            if (!postmate.current || !container.current || !container.current.hasChildNodes()) return;
            postmate.current.remove();
            return postmate.current = null;
        }
    }, [postmate.current, container.current])

    return (
        <PostmateContext.Provider
            value={{
                open: open as any,
                send: send as any,
                services,
                remove
            }}
        >
            {props.children}
        </PostmateContext.Provider>
    );
}