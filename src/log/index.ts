const envs = ['development', 'test', 'production'];
const tagLevelColor = new Map([
    ['message', '#00c54f'],
    ['register', '#1A83EC'],
    ['error', '#E40662']
]);
export type LOGTYPE = "register" | "message" | "error";

export function groupLog(name: string, logger?: boolean): (type: LOGTYPE, tag: string, ...message: any) => void {
    return (type: LOGTYPE, tag: string, ...message: any) => {
        if (!logger || !console || !console.group || !console.log) return;
        console.group.apply(console, [`%c${name}%c${tag}`, 'background: #6f5a5a; color: #fff;border-top-left-radius: 2px; border-bottom-left-radius: 2px; padding: 2px 10px;', `background: ${tagLevelColor.get(
            type,
        )};color: #fff;border-top-right-radius: 2px; border-bottom-right-radius: 2px;padding: 2px 10px;`]);
        console.log.apply(console, [...message]);
        console.groupEnd.apply(console);
    }
}