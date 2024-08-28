import * as Api from "./api.js"
import * as Ws from "./ws.js"
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

const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

export const store = reactive({
    songlist: [],
    currentSong: {},
    currentSongPath: "",

    loadingSongList: true,
    songLoaded: false,

    connected: false,
    server: null,

    transpose: 0,
    transposeIndex: 0,

    navExpanded: true,

    sessionId: "",
    sessionIdInput: "",
    sessionKey: "",

    sendMessage(event) {
        event.preventDefault();
        if (!this.connected) {
            return;
        }
        this.server.send("foo");
    },

    onSongTitlePressed(songId) {
        console.log("le press")
        if (this.connected) {
            this.sendSongToServer(songId)
        }
        else {
            this.selectSong(songId)
        }
    },

    async selectSong(songId, skipPush = false) {
        if (!skipPush && !this.connected) {
            Router.pushCurrentUri(songId);
        }
        this.songLoaded = false;
        this.currentSongPath = songId;
        this.transpose = 0;
        this.transposeIndex = 0;
        await Api.fetchSong(songId)
            .then(s => this.setCurrentSong(s));
    },

    getTransposedChord(chord) {
        if (this.transpose == 0) {
            return chord.chord;
        }
        if (!('scale_index' in chord)) {
            return chord.chord;
        }
        let newChordSym = notes[(chord.scale_index + this.transpose) % 12]
        let ind = sharps.includes(chord.scale_index) ? 2 : 1
        return newChordSym + chord.chord.substring(ind)
    },

    onTransposeUpPressed() {
        if (this.connected) {
            this.sendTransposeToServer((this.transpose + 7) % 12)
        }
        else {
            this.transposeUp()
        }
    },

    onTransposeDownPressed() {
        if (this.connected) {
            this.sendTransposeToServer((this.transpose + 5) % 12)
        }
        else {
            this.transposeDown()
        }
    },

    transposeUp() {
        this.transpose = (this.transpose + 7) % 12;
        this.transposeIndex++;
    },

    transposeDown() {
        this.transpose = (this.transpose + 5) % 12;
        this.transposeIndex--;
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
        this.currentSongPath = "";
    },


    setSongList(list){
        this.songlist = list
    },

    setConnected(connected) {
        this.connected = connected;
    },

    openSession() {
        let result = '';
        for (let i = 0; i < 4; i++) {
            const randomInd = Math.floor(Math.random() * characters.length);
            result += characters.charAt(randomInd);
        }
        this.sessionId = result;
        Router.pushCurrentUri(`session/${result}`);
        this.connectWs();
    },

    connectSession(event) {
        event.preventDefault();
        this.connectSessionById(encodeURIComponent(this.sessionIdInput));
    },

    connectSessionById(sessionid) {
        this.sessionId = sessionid;
        Router.pushCurrentUri(`session/${this.sessionId}`);
        this.connectWs();
    },

    updateFromServer(data) {
        let parsed = JSON.parse(data)
        if (parsed.songPath && parsed.songPath != this.currentSongPath) {
            this.selectSong(parsed.songPath)
        }
        if (("transpose" in parsed) && parsed.transpose != this.transpose) {
            this.transpose = 0;
            this.transposeIndex = 0;
            while (this.transpose != parsed.transpose) {
                this.transposeUp();
            }
        }
    },

    sendSongToServer(songPath) {
        if (!this.connected) {
            return
        }
        let data = {
            'transpose': 0,
            'songPath': songPath,
        }
        this.server.send(JSON.stringify(data))
    },

    sendTransposeToServer(transpose) {
        if (!this.connected) {
            return
        }
        let data = {
            'transpose': transpose,
        }
        this.server.send(JSON.stringify(data))
    },

    async connectWs() {
        try {
            this.server = await Ws.connect(this.sessionId);
            this.server.onmessage = function(evt) {
                this.updateFromServer(evt.data);
            }.bind(this);
            this.server.onclose = function() {
                this.setConnected(false);
            }.bind(this);
            this.connected = true;
        }
        catch (error) {
            console.log("Could not establish websocket connection.", error);
        }
    },

    async init() {
        await Api.fetchSongList()
            .then(l => this.setSongList(l))
            .then(() => this.loadingSongList = false)
    }
})
