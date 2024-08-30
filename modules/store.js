import * as Api from "./api.js"
import * as Ws from "./ws.js"
import * as Router from "./router.js"
import {reactive} from "https://unpkg.com/petite-vue@0.3.0/dist/petite-vue.es.js"
import {QRCode} from "./qrcode.js"

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

const sharps = [1, 3, 6, 8, 10];

const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const store = reactive({
    // Song state:
    songlist: [],
    currentSong: {},
    currentSongPath: "",

    loadingSongList: true,
    songLoaded: false,

    transpose: 0,
    transposeIndex: 0,

    // UI state:
    panelExpanded: true,
    showChords: true,

    // Session management:
    connected: false,
    server: null,

    sessionId: "",
    sessionIdInput: "",
    sessionKey: "",

    onSongTitlePressed(songId) {
        if (this.connected) {
            this.sendSongToServer(songId)
        }
        else {
            this.selectSong(songId)
        }
    },

    onSectionDoubleClick(sectionId) {
        if (this.connected) {
            this.sendSectionToServer(sectionId);
        }
        else {
            this.scrollToSection(sectionId);
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

    toggleChords() {
        this.showChords = !this.showChords;
    },

    transposeUp() {
        this.transpose = (this.transpose + 7) % 12;
        this.transposeIndex++;
    },

    transposeDown() {
        this.transpose = (this.transpose + 5) % 12;
        this.transposeIndex--;
    },

    togglePanel() {
        this.panelExpanded = !this.panelExpanded
    },

    setCurrentSong(song) {
        this.currentSong = song;
        this.songLoaded = true;
        this.panelExpanded = false;
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

    scrollToSection(sectionId) {
        let el = document.getElementById(sectionId);
        let main = document.getElementById('main-content');
        window.scrollTo({
            top: el.offsetTop,
            behavior: 'smooth',
        });
        main.scrollTo({
            top: el.offsetTop - 50,
            behavior: 'smooth',
        });
    },

    connectSession(event) {
        event.preventDefault();
        let id = encodeURIComponent(this.sessionIdInput.toUpperCase());
        if (id == "") {
            for (let i = 0; i < 4; i++) {
                const randomInd = Math.floor(Math.random() * characters.length);
                id += characters.charAt(randomInd);
            }
        }
        this.connectSessionById(id);
    },

    connectSessionById(sessionid) {
        this.sessionId = sessionid;
        Router.pushCurrentUri(`session/${this.sessionId}`);
        this.connectWs();
        new QRCode(document.getElementById("session-qr"), {
            text: window.location.href,
            colorLight: "#f6f6f6",
            correctLevel: QRCode.CorrectLevel.L,
        });
    },

    onWsDisconnect() {
        this.connected = false;
    },

    disconnectFromSession() {
        if (!this.connected) {
            return;
        }
        this.server.close();
        this.sessionIdInput = "";
        document.getElementById("session-qr").innerHTML = "";
        Router.pushCurrentUri(this.currentSongPath);
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
        if (parsed.section) {
            this.scrollToSection(parsed.section)
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

    sendSectionToServer(sectionId) {
        if (!this.connected) {
            return
        }
        let data = {
            'transpose': this.transpose,
            'section': sectionId,
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
                this.onWsDisconnect();
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
