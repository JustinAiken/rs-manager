window.ipcRenderer = require("electron").ipcRenderer;
window.app = require("electron").app;
window.shell = require("electron").shell;
window.remote = require('electron').remote;
window.electronFS = window.remote.require('fs');
window.spawn = require("await-spawn");
window.dirname = __dirname;
window.sqlite = require("sqlite");
window.fetch = fetch;
window.http = require("http");
window.os = require("os");
window.prompt = require('electron-prompt');
window.processPSARC = require("./lib/libpsarc").processPSARC
window.extractFile = require("./lib/libpsarc").extractFile
const rp = require('request-promise');
const isDev = require('electron-is-dev');

//eslint-disable-next-line
window.path = null;

if (window.os.platform() === 'win32') {
    //eslint-disable-next-line
    window.path = require("path").win32;
}
else {
    //eslint-disable-next-line
    window.path = require("path");
}


window.request = async function (uri, cookie, cookieurl, qs) {

    let cookiejar = rp.jar();
    //cookiejar.setCookie('steamLoginSecure=76561197985613182%7C%7C4B2D9C3BFDDB12750CD0BB9086C188AAD7051295', 'https://store.steampowered.com');
    if (cookie != "") {
        cookiejar.setCookie(cookie, cookieurl);
    }
    const options = {
        //uri: 'https://store.steampowered.com/dynamicstore/userdata/',
        uri,
        jar: cookiejar, // Tells rp to include cookies in jar that match uri,
        qs,
    };
    const d = await rp(options);
    return d;
}


if (isDev) {
    window.configPath = path.resolve(window.dirname + "/../config.json");
    window.sqlitePath = path.resolve(window.dirname + "/../rsdb.sqlite");
}
else {
    window.configPath = path.resolve(window.remote.app.getPath("userData") + "/config.json");
    window.sqlitePath = path.resolve(window.remote.app.getPath("userData") + "/rsdb.sqlite");
}

// Warn if overriding existing method
if (Array.prototype.equals)
    console.warn("Overriding existing Array.prototype.equals. Possible causes: New API defines the method, there's a framework conflict or you've got double inclusions in your code.");
// attach the .equals method to Array's prototype to call it on any array
Array.prototype.equals = function (array) {
    // if the other array is a falsy value, return
    if (!array)
        return false;

    // compare lengths - can save a lot of time 
    if (this.length != array.length)
        return false;

    for (var i = 0, l = this.length; i < l; i++) {
        // Check if we have nested arrays
        if (this[i] instanceof Array && array[i] instanceof Array) {
            // recurse into the nested arrays
            if (!this[i].equals(array[i]))
                return false;
        }
        else if (this[i] != array[i]) {
            // Warning - two different object instances will never be equal: {x:20} != {x:20}
            return false;
        }
    }
    return true;
}
// Hide method from for-in loops
Object.defineProperty(Array.prototype, "equals", { enumerable: false });