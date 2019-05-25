import { EventEmitter } from 'events';
import Channel from './Channel.js';
import User from './User.js';
import fetch from 'node-fetch';

export default class Client extends EventEmitter {
    private _channels: Map<string, Channel> = new Map();
    private _users: Map<string, User> = new Map();
    private _accessToken: string;
    private _instanceAt: number = Date.now();
    private _readyAt: number = null;
    private _user: User = null;
    private _activeChannel: Channel = null;
    static API_HOST: string = "https://iomirea.ml/api/v0/";

    constructor() {
        super();
    }

    // Getters/Setters
    get channels(): Map<string, Channel> {
        return this._channels;
    }

    set channels(value: Map<string, Channel>) {
        this._channels = value;
    }

    get users(): Map<string, User> {
        return this._users;
    }

    set users(value: Map<string, User>) {
        this._users = value;
    }

    get accessToken(): string {
        return this._accessToken;
    }

    set accessToken(value: string) {
        this._accessToken = value;
    }

    get instanceAt(): number {
        return this._instanceAt;
    }

    set instanceAt(value: number) {
        this._instanceAt = value;
    }

    get readyAt(): number {
        return this._readyAt;
    }

    set readyAt(value: number) {
        this._readyAt = value;
    }

    get user(): User {
        return this._user;
    }

    set user(value: User) {
        this._user = value;
    }

    get activeChannel(): Channel {
        return this._activeChannel;
    }

    set activeChannel(value: Channel) {
        this._activeChannel = value;
    }

    get uptime(): number {
        return Date.now() - this.readyAt;
    }

    // Methods
    login(token: string): Promise<Client> {
        return new Promise((resolve, reject) => {
            fetch(Client.API_HOST + "users/@me/channels", {
                headers: {
                    "Authorization": token,
                    "Content-Type": "application/json"
                }
            }).then(async r => {
                if (r.status === 200) {
                    this.accessToken = token;
                    this.readyAt = Date.now();
                    const channels: Array<{
                        id: string,
                        name: string,
                        owner_id: string,
                        user_ids: Array<string>,
                        pinned_ids: Array<string>
                    }> = await r.json();
                    for(let i: number = 0; i < channels.length; ++i) {
                        const tempChannel: Channel = new Channel(channels[i].id, channels[i].name, channels[i].owner_id, channels[i].user_ids, channels[i].pinned_ids, this);
                        this.channels.set(tempChannel.id, tempChannel);
                    }
                    await this.fetchUser("@me").then(u => {
                        this.user = u;
                        this.users.set(u.id, u);
                    });
                    this.emit("ready");
                    resolve(this);
                } else if (r.status === 401) {
                    r.text().then(reject);
                }
            });
        });
    }

    request(endpoint: string, json: boolean = false, method: string = "GET"): Promise<any> {
        return new Promise((resolve, reject) => {
            fetch(/^https?:\/\//.test(endpoint) ? endpoint : Client.API_HOST + endpoint, {
                headers: {
                    "Authorization": this.accessToken
                },
                method
            }).then(r => {
                if (json === true) return r.json();
                else return r.text();
            }).then(resolve)
                .catch(reject);
        });
    }

    fetchUser(s: string): Promise<{id:string}> {
        return new Promise((a,b)=>a({id:'1'}));
    }
}