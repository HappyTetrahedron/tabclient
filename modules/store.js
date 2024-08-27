import * as Api from "./api.js"
import * as Router from "./router.js"
import {reactive} from "https://unpkg.com/petite-vue@0.3.0/dist/petite-vue.es.js"

const notes = {
    0: 'C',
    1: 'C#',
    2: 'D',
    3: 'D#',
    4: 'E',
    5: 'F',
    6: 'F#',
    7: 'G',
    8: 'G#',
    9: 'A',
    10: 'A#',
    11: 'B',
}

const sharps = [1, 3, 6, 8, 10]

export const store = reactive({
    songlist: [],
    currentSong: {},

    loadingSongList: true,
    songLoaded: false,
    connected: false,
    server: null,

    transpose: 0,

    navExpanded: true,

    sendMessage(event) {
        event.preventDefault();
        if (!this.connected) {
            return;
        }
        this.server.send("foo");
    },

    async selectSong(songId, skipPush = false) {
        if (!skipPush) {
            Router.pushCurrentUri(songId);
        }
        this.songLoaded = false;
        this.transpose = 0;
        await Api.fetchSong(songId)
            .then(s => this.setCurrentSong(s));
    },

    getTransposedChord(chord) {
        if (this.transpose == 0) {
            return chord.chord;
        }
        let newChordSym = notes[(chord.scale_index + this.transpose) % 12]
        let ind = sharps.includes(chord.scale_index) ? 2 : 1
        return newChordSym + chord.chord.substring(ind)
    },

    get transposeIndex() {
        if (this.transpose > 6) {
            return this.transpose - 12
        }
        return this.transpose
    },

    transposeUp() {
        this.transpose = (this.transpose + 1) % 12;
    },

    transposeDown() {
        this.transpose = (this.transpose + 11) % 12;
    },

    toggleNav() {
        this.navExpanded = !this.navExpanded
    },

    setCurrentSong(song) {
        this.currentSong = song;
        this.songLoaded = true;
        this.navExpanded = false;
    },

    unsetCurrentSong() {
        this.songLoaded = false;
        this.currentSong = {};
    },


    setSongList(list){
        this.songlist = list
    },

    setConnected(connected) {
        this.connected = connected;
    },

    async init() {
        // try {
            // this.server = await Api.connect();
            // this.server.onmessage = function(evt) {
            //     this.appendConsoleLines(evt.data);
            // }.bind(this);
            // this.server.onclose = function(evt) {
            //     this.appendConsoleMetaLine("Connection closed. Refresh to re-connect.")
            //     this.setConnected(false);
            // }.bind(this);
            // this.connected = true;
        // }
        // catch (error) {
        //     console.log("Could not establish websocket connection.", error);
        //     this.appendConsoleMetaLine("Unable to connect. Try refreshing, or yell at Aline if that also doesn't work.")
        // }
        await Api.fetchSongList()
            .then(l => this.setSongList(l))
            .then(() => this.loadingSongList = false)
        // TODO routing
    }
})
