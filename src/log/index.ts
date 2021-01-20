const envs = ['development', 'test'];

export function groupLog(name: string, ...message: any) {
    if (envs.includes(process.env.NODE_ENV as string)) {
        console.group.apply(console, [name]);
        console.log.apply(console, [...message]);
        console.groupEnd.apply(console);
    }
}