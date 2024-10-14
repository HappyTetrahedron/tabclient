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

const NO_MATCH = "nomatch";

const languages = {
    "de-ch": "Mundart",
    "de": "Deutsch",
    "en": "English",
    "tp": "toki pona",
    [NO_MATCH]: "other languages",
};

const categories = {
    [NO_MATCH]: "",
    "christmas": "Weihnachtslieder ",
};

const sharps = [1, 3, 6, 8, 10];

const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const store = reactive({
    // Song state:
    songlist: [],
    display_songlist: [],
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

    presenting: false,
    following: true,

    sessionId: "",
    sessionIdInput: "",
    sessionKey: "",

    serverState: {
        songPath: "",
        transpose: 0,
        section: "",
    },

    onSongTitlePressed(songId) {
        if (this.connected && this.presenting) {
            this.sendSongToServer(songId);
        }
        else {
            this.following = false;
            this.selectSong(songId);
        }
    },

    onSectionDoubleClick(sectionId) {
        if (this.connected && this.presenting) {
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
        if (this.connected && this.presenting) {
            this.sendTransposeToServer((this.transpose + 7) % 12)
        }
        else {
            this.transposeUp()
        }
    },

    onTransposeDownPressed() {
        if (this.connected && this.presenting) {
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
        this.scrollToTop();
    },

    unsetCurrentSong() {
        this.songLoaded = false;
        this.currentSong = {};
        this.currentSongPath = "";
    },


    setSongList(list){
        this.songlist = list
        this.createDisplaySongList();
    },

    createDisplaySongList() {
        // this utter mess is the product of my sick brain
        let buckets = {};
        this.songlist.forEach(song => {
            let cat = song.category || NO_MATCH;
            if (!Object.keys(categories).includes(cat.toLowerCase())) {
                cat = NO_MATCH;
            }
            cat = cat.toLowerCase();
            let lang = song.language || NO_MATCH;
            if (!Object.keys(languages).includes(lang.toLowerCase())) {
                if (Object.keys(languages).every(lk => {
                    if (lang.toLowerCase().startsWith(lk)) {
                        lang = lk;
                        return false;
                    }
                    return true;
                })) {
                    lang = NO_MATCH;
                }
            }
            lang = lang.toLowerCase();
            let b1 = buckets[cat] || {subs: {}};
            let b2 = b1.subs[lang] || {};
            b2.title = categories[cat] + languages[lang];
            b2.lang = lang;
            b1.cat = cat;
            let songs = b2.songs || [];
            songs.push(song);
            b2.songs = songs;
            b1.subs[lang] = b2;
            buckets[cat] = b1;
        })

        buckets = Object.values(buckets).sort(function(a, b) {
            return Object.keys(categories).indexOf(a.cat) - Object.keys(categories).indexOf(b.cat);
        })
        buckets = buckets.flatMap(b => Object.values(b.subs).sort(function(a, b) {
            return Object.keys(languages).indexOf(a.lang) - Object.keys(languages).indexOf(b.lang);
        }))

        buckets.forEach(sublist => {
            sublist.songs.sort(function(a, b) {
                let av = a.title || a.path
                let bv = b.title || b.path
                return av < bv ? -1 : av > bv ? 1 : 0
            })
        })

        this.display_songlist = buckets;
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

    scrollToTop() {
        let main = document.getElementById('main-content');
        window.scrollTo({
            top: 0,
            behavior: 'smooth',
        });
        main.scrollTo({
            top: 0,
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
        this.following = true;
        this.presenting = false;
        this.showChords = false;
        new QRCode(document.getElementById("session-qr"), {
            text: window.location.href,
            colorLight: "#f6f6f6",
            correctLevel: QRCode.CorrectLevel.L,
        });
    },

    onWsDisconnect() {
        if (this.sessionId == "") {
            this.connected = false;
            document.getElementById("session-qr").innerHTML = "";
        }
        else {
            this.connectWs();
        }
    },

    disconnectFromSession() {
        if (!this.connected) {
            return;
        }
        this.server.close();
        this.sessionIdInput = "";
        this.sessionId = "";
        document.getElementById("session-qr").innerHTML = "";
        Router.pushCurrentUri(this.currentSongPath);
    },

    updateFromServer(data) {
        let parsed = JSON.parse(data)
        if (parsed.songPath && parsed.songPath != this.serverState.songPath) {
            this.serverState.songPath = parsed.songPath;
            this.serverState.section = "";
        }
        if ("transpose" in parsed) {
            this.serverState.transpose = parsed.transpose
        }
        if (parsed.section) {
            this.serverState.section = parsed.section;
        }

        if (this.following) {
            this.localStateFromServer();
        }
    },

    localStateFromServer() {
        if (this.currentSongPath != this.serverState.songPath) {
            this.selectSong(this.serverState.songPath);
        }
        if (this.transpose != this.serverState.transpose) {
            this.transpose = 0;
            this.transposeIndex = 0;
            while (this.transpose != this.serverState.transpose) {
                this.transposeUp();
            }
        }
        if (!!this.serverState.section) {
            this.scrollToSection(this.serverState.section);
        }
    },

    localStateToServer() {
        this.sendSongToServer(this.currentSongPath, this.transpose);
    },


    sendSongToServer(songPath, transpose=0) {
        if (!this.connected) {
            return
        }
        let data = {
            'transpose': transpose,
            'songPath': songPath,
            'section': '',
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

    onFollowPressed(event) {
        if (this.presenting) {
            this.presenting = false;
        }
        else {
            this.following = !this.following;
            if (this.following) {
                this.localStateFromServer();
            }
        }
    },

    onPresentPressed(event) {
        this.presenting = !this.presenting;
        if (this.presenting) {
            this.following = true;
            this.localStateToServer();
        }
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
