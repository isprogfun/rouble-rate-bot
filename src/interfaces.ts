export interface Update {
    update_id: number,
    message: {
        text: string,
        chat: {
            id: number,
            first_name: string,
            last_name: string,
            type: string
        }
    }
}

export interface ReplyMarkup {
    resize_keyboard?: boolean;
    remove_keyboard?: boolean;
    keyboard?: Array<Array<string>>;
}

export interface Options {
    hostname: string,
    port: string,
    method: string,
    path?: string
}

export interface UserUpdate {
    sendChanges?: boolean,
    lastMessage?: string,
    difference?: number,
    lastSend?: {string: number}
}

export interface Rate {
    title: string;
    rate: number;
}