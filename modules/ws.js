import * as Config from "../configuration.js"

export function connect() {
    return new Promise(function(resolve, reject) {
        var conn = new WebSocket(`wss://${document.location.host}${Config.WS_URI}`);
        conn.onopen = function() {
            resolve(conn);
        }
        conn.onerror = function(err) {
            reject(err)
        }
    })
}

export async function fetchApi() {
    let response = await fetch(Config.API_URI);
    return await response.json();
}