export function pushCurrentUri(song_path) {
    history.pushState(song_path, "", song_path);
}

export function restoreState(store, song_path) {
    store.selectSong(song_path, true)
}
