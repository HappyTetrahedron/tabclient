import * as Api from "./api.js"
import * as Router from "./router.js"
import {reactive} from "https://unpkg.com/petite-vue@0.3.0/dist/petite-vue.es.js"

export const store = reactive({
    songlist: [],
    currentSong: {},

    loadingSongList: true,
    songLoaded: false,
    connected: false,
    server: null,

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
        await Api.fetchSong(songId)
            .then(s => this.setCurrentSong(s));
    },

    toggleNav() {
        this.navExpanded = !this.navExpanded
    },

    setCurrentSong(song) {
        this.currentSong = song;
        this.songLoaded = true;
        this.navExpanded = false;
    },

    unsetCurrentSong(song) {
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
