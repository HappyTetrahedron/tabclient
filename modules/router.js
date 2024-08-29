export function pushCurrentUri(song_path) {
    history.pushState(song_path, "", "/" + song_path);
}

export function restoreState(store, uri) {
    if (uri.startsWith("/")) {
        uri = uri.substr(1)
    }
    if (uri.startsWith('session/')) {
        store.connectSessionById(uri.substr(8))
        return
    }
    store.selectSong(uri, true)
}
