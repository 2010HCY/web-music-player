// === 专辑封面缓存 ===
let COVER_BLOB_URL = null;
async function blobToHash(blob) {
    const arrayBuffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function openDB() {
    return new Promise((resolve, reject) => {
        const req = window.indexedDB.open("album-cover-cache", 1);
        req.onupgradeneeded = e => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains("covers")) db.createObjectStore("covers");
        };
        req.onerror = reject;
        req.onsuccess = e => resolve(e.target.result);
    });
}
function getCoverFromDB(key) {
    return openDB().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction("covers", "readonly");
        const store = tx.objectStore("covers");
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result); // { blob, hash }
        req.onerror = reject;
    }));
}
function saveCoverToDB(key, value) {
    return openDB().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction("covers", "readwrite");
        const store = tx.objectStore("covers");
        const req = store.put(value, key);
        req.onsuccess = () => resolve(true);
        req.onerror = reject;
    }));
}

// === 专辑封面加载 ===
async function loadOrFetchCover(callback) {
    const cache = await getCoverFromDB(COVER_IMAGE);
    let localBlob = cache && cache.blob;
    let localHash = cache && cache.hash;

    const response = await fetch(COVER_IMAGE, {cache: "reload"});
    const blob = await response.blob();
    const hash = await blobToHash(blob);

    if (hash === localHash && localBlob) {
        COVER_BLOB_URL = URL.createObjectURL(localBlob);
    } else {
        COVER_BLOB_URL = URL.createObjectURL(blob);
        await saveCoverToDB(COVER_IMAGE, {blob, hash});
    }
    if (typeof callback === "function") callback();
}
// === 播放逻辑 ===
const audioPlayer = document.getElementById('audioPlayer');
const playlistContainer = document.getElementById('playlistContainer');
const songInfo = document.getElementById('songInfo');
let currentTrack = 0;
let pendingAutoPlay = false;

function tryAutoPlay() {
    audioPlayer.play().then(() => {
        pendingAutoPlay = false;
    }).catch(() => {
        pendingAutoPlay = true;
    });
}

function loadPlaylist() {
    playlist.forEach((track, index) => {
        const item = document.createElement('div');
        item.className = 'playlist-item';
        item.textContent = track.name;
        item.dataset.index = index;
        item.addEventListener('click', () => playTrack(index, true));
        playlistContainer.appendChild(item);
    });
}
function updateSongInfo() {
    const track = playlist[currentTrack];
    songInfo.querySelector('h3').textContent = track.name;
    songInfo.querySelector('p').textContent = track.artist;
}
function updateActiveTrack() {
    document.querySelectorAll('.playlist-item').forEach(item => {
        item.classList.remove('active');
    });
    const currentItem = document.querySelector(`.playlist-item[data-index='${currentTrack}']`);
    if (currentItem) currentItem.classList.add('active');
}
function playTrack(index, userInitiated = false) {
    currentTrack = index;
    audioPlayer.src = playlist[currentTrack].path;
    updateActiveTrack();
    updateSongInfo();
    updateMediaSession && updateMediaSession();
    tryAutoPlay();
}
audioPlayer.addEventListener('ended', () => {
    if (currentTrack < playlist.length - 1) {
        playTrack(currentTrack + 1, false);
    } else {
        playTrack(0, false);
    }
});

function listenVisibilityForAutoplay() {
    document.addEventListener('visibilitychange', () => {
        if (!audioPlayer.paused && !pendingAutoPlay) return;
        if (!document.hidden && pendingAutoPlay) {
            tryAutoPlay();
        }
    });
    window.addEventListener('focus', () => {
        if (!audioPlayer.paused && !pendingAutoPlay) return;
        if (pendingAutoPlay) {
            tryAutoPlay();
        }
    });
}

loadOrFetchCover(function() {
    loadPlaylist();
    updateActiveTrack();
    playTrack(0, false);
    listenVisibilityForAutoplay();
});
// === 全局按键控制 ===
window.addEventListener('keydown', function (e) {
    const tag = document.activeElement.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;

    if (e.code === 'Space') {
        e.preventDefault();
        if (audioPlayer.paused) {
            audioPlayer.play();
        } else {
            audioPlayer.pause();
        }
    }

    if (e.code === 'ArrowLeft') {
        e.preventDefault();
        audioPlayer.currentTime = Math.max(0, audioPlayer.currentTime - 5);
    }
    if (e.code === 'ArrowRight') {
        e.preventDefault();
        audioPlayer.currentTime = Math.min(audioPlayer.duration || 0, audioPlayer.currentTime + 5);
    }

    if (e.code === 'ArrowUp') {
        e.preventDefault();
        audioPlayer.volume = Math.min(1, audioPlayer.volume + 0.1);
    }
    if (e.code === 'ArrowDown') {
        e.preventDefault();
        audioPlayer.volume = Math.max(0, audioPlayer.volume - 0.1);
    }
});
// === 音乐专辑信息显示 ===
function updateMediaSession() {
    if ('mediaSession' in navigator && COVER_BLOB_URL) {
        const track = playlist[currentTrack];
        navigator.mediaSession.metadata = new window.MediaMetadata({
            title: track.name,
            artist: track.artist,
            album: '',
            artwork: [
                { src: COVER_BLOB_URL, sizes: '512x512', type: 'image/png' },
                { src: COVER_BLOB_URL, sizes: '192x192', type: 'image/png' }
            ]
        });
        navigator.mediaSession.setActionHandler('previoustrack', () => {
            playTrack(currentTrack === 0 ? playlist.length - 1 : currentTrack - 1);
        });
        navigator.mediaSession.setActionHandler('nexttrack', () => {
            playTrack((currentTrack + 1) % playlist.length);
        });
        navigator.mediaSession.setActionHandler('pause', () => { audioPlayer.pause(); });
        navigator.mediaSession.setActionHandler('play', () => { audioPlayer.play(); });
    }
}