import * as Config from "../configuration.js"

export async function fetchSongList() {
    let list = await fetchJson(Config.API_URI);
    return list;
}

export async function fetchSong(songKey) {
    let song = await fetchJson(Config.API_URI + songKey);
    return song;
}

async function fetchJson(url) {
    let res = await fetch(url);
    return await res.json()
}
