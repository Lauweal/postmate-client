import React, { createContext, useCallback, useMemo, useRef } from "react";
import { Method, Response, ServiceFuc } from "./interface";
import { groupLog } from "../log";
import { ClientAPI, PostmateClient, PostmateOptions } from "./client";

export interface IPostmateContext {
    open: (options?: PostmateOptions) => Promise<ClientAPI | null>;
    send?: <T = any>(method: Method, url: string, data?: any) => Promise<Response<T>>;
    services: <P = any, T = any>(method: Method, url: string, func: ServiceFuc<P, T>) => void;
    remove: () => void;
}

export const PostmateContext = createContext<IPostmateContext>({
    open: (options?: PostmateOptions) => Promise.resolve(null),
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
    const logref = useRef(groupLog(name, "TEST", log));
    const container = useRef<HTMLElement>()
    const postmate = useRef<ClientAPI | null>(null);

    const create = useCallback(async (options?: PostmateOptions): Promise<ClientAPI> => {
        if (options) {
            container.current = options?.container as any;
            return await new PostmateClient(groupLog(name, "PARENT", logref.current as any), options as any).create();
        }
        return await new PostmateClient(groupLog(name, "CHILDREN", logref.current as any)).create();
    }, [log, name, logref.current]);

    const open = useCallback((options?: PostmateOptions) => {
        if (postmate.current) {
            return postmate.current
        }
        return create(options).then((res) => {
            if (!res) return null;
            res.logger("env", "初始化成功", res);
            postmate.current = res;
            return res;
        })
    }, [postmate.current, logref.current]);

    const send = useMemo(() => {
        return (method: Method, url: string, data?: any): Promise<any> => {
            if (!postmate.current) return Promise.resolve({ code: -1, data: null, message: "异常" });
            return postmate.current.call({
                method, url, data
            });
        }
    }, [postmate.current]);

    const services = useMemo(() => {
        return (method: Method, url: string, func: ServiceFuc) => {
            if (!postmate.current) return;
            return postmate.current.service(method, url, func);
        }
    }, [postmate.current]);

    const remove = useMemo(() => {
        return () => {
            if (!postmate.current || !container.current || !container.current.hasChildNodes()) return;
            postmate.current.remove()
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