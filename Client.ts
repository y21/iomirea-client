import * as readline from 'readline';
import * as fs from 'fs';
import Client from './structures/Client';
import ConsoleHelper from './structures/ConsoleHelperT';
import chalk from "chalk";
import { writeFile } from 'fs';

// Helper module imports
import formatDate from './modules/formatDate';
import showAccount from './modules/showAccount';
import showChannel from './modules/showChannel';
import showChannels from './modules/showChannels';
import showMenu from './modules/showMenu';
import showSettings from './modules/showSettings';
import Channel from "./structures/Channel";

const config: object = {};
const client: Client = new Client();

fs.readFile("./.config", "utf8", (err, data) => {
    if (err) {
        console.log(chalk.red("An error occured while trying to open .config"));
        process.exit(1);
    }
    for (const { key, value } of data.split("\n").map(v => ({ key: v.split("=")[0], value: v.substr(v.indexOf("=") + 1) }))) {
        /*Object.defineProperty(config, key, {
            value,
            writable: false
        });*/
        config[key] = value;
    }

    client.login(config["ACCESS_TOKEN"]).catch(e => {
        const parsed: object = JSON.parse(e);
        console.log(chalk.red("Error while logging in. " + e.message));
        process.exit(1);
    });
});

const rl: readline.Interface = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// rlState
// 0 = Menu Selection
// 0.1 = Menu - View Channel
// 0.2 = Menu - Account Information
// 0.3 = Menu - Settings
// 0.4 = Menu - Exit
// 1 = View Channels
// 2 = Account Information
// 3 = Channel Browser
// 4 = Channel Browser (Send Message)
// 5 = Settings
// 6 = Settings (Change Access Token)
let rlState: number = 0;
let tempInput: string = "";

console.clear();
console.log(chalk.yellow("Connecting..."));

client.on("ready", () => {
    console.log(chalk.green(`Connected! (${client.channels.size} Channels, ${((client.readyAt - client.instanceAt) / 1000).toFixed(2)}s)`));
    console.log(ConsoleHelper.iomirea);
    showMenu(rlState = 0.1);
});

process.stdin.on("keypress", async (str, {name}) => {
    if (rlState >= 0 && rlState < 1) {
        if (name === "down") {
            ConsoleHelper.reset();
            if (rlState === 0 || rlState === 0.1) showMenu(rlState = 0.2);
            else if (rlState === 0.2) showMenu(rlState = 0.3);
            else if (rlState === 0.3) showMenu(rlState = 0.4);
            else showMenu(rlState = 0.4);
        } else if (name === "up") {
            ConsoleHelper.reset();
            if (rlState === 0.2) showMenu(rlState = 0.1);
            else if (rlState === 0.3) showMenu(rlState = 0.2);
            else if (rlState === 0.4) showMenu(rlState = 0.3);
            else showMenu(rlState = 0.1);
        } else if (name === "return") {
            ConsoleHelper.reset();
            if (rlState === 0 || rlState === 0.1) {
                rlState = 1;
                showChannels(client);
            }
            else if (rlState === 0.2) {
                rlState = 2;
                showAccount(client);
            }
            else if (rlState === 0.3) {
                rlState = 5;
                showSettings(config);
            }
            else if (rlState === 0.4) process.exit(0);
        }
    } else if (rlState === 1) {
        const answer = parseInt(str);
        console.clear();
        if (isNaN(answer)) {
            showChannels(client);
        }
        else {
            const channel: Channel = Array.from(client.channels.values())[answer - 1];
            if (channel === undefined) return console.log(chalk.red("An error occured!"));
            await showChannel(channel, client);
            client.activeChannel = channel;
            channel.handleMessages(n => {
                if (channel.messages.length === n.length) return;
                else {
                    channel.messages = n;
                    if (rlState === 3) {
                        console.clear();
                        showChannel(client.activeChannel, client, 1);
                    }
                }
            }, 1e3);
            rlState = 3;
        }
    } else if (rlState === 2) {
        ConsoleHelper.reset();
        showMenu(rlState = 0.1);
    } else if (rlState === 3) {
        if (str === "x") {
            console.clear();
            showChannel(client.activeChannel, client, 2);
            rlState = 4;
        } else if (str === "c") {
            ConsoleHelper.reset();
            rlState = 1;
            clearInterval(client.activeChannel.messageHandler);
            client.activeChannel = null;
            showChannels(client);
        } else if (str === "r") {
            client.activeChannel.fetchMessages(true).then(() => {
                console.clear();
                showChannel(client.activeChannel, client, 1);
            });
        }
    } else if (rlState === 4) {
        switch (name) {
            case "backspace":
                client.activeChannel.inputText = client.activeChannel.inputText.slice(0, -1);
                break;
            case "return":
                client.activeChannel.send().then(() => {
                    client.activeChannel.inputText = "";
                    console.clear();
                    showChannel(client.activeChannel, client, 1);
                    rlState = 3;
                });
                break;
            default:
                client.activeChannel.inputText += str;
                break;
        }
    } else if (rlState === 5) { //TODO
        if (str === "1") {
            // Change Access Token
            process.stdout.write("\n" + chalk.yellow("New Access Token: "));
            rlState = 6;
        } else if (str === "2") {
            // Change Language
        } else if (str === "3") {
            // Change Color Scheme
        } else if (str === "4") {
            ConsoleHelper.reset();
            showMenu(rlState = 0.1);
            rlState = 0;
        }
    } else if (rlState === 6) {
        if (name === "return") {
            client.accessToken = tempInput;
            config["ACCESS_TOKEN"] = tempInput;
            writeFile("./.config", Object.entries(config).map(v => v[0] + "=" + v[1]).join("\n"), (err) => {
                if (err) return console.log(chalk.red(err.toString()));
                ConsoleHelper.reset();
                showSettings(config);
                console.log(chalk.green("Successfully updated Access Token!"));
            });
            tempInput = "";
            rlState = 5;
            return;
        } else if (name === "backspace") tempInput = tempInput.slice(0, -1);
        tempInput += str;
    }
});

rl.on("SIGINT", () => {
    if (rlState === 4) {
        console.clear();
        showChannel(client.activeChannel, client, 1);
        rlState = 3;
        return;
    }
    client.removeActiveChannel();
    ConsoleHelper.reset();
    showMenu(rlState = 0.1);
    rlState = 0;
    tempInput = "";
});