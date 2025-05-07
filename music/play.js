// === 播放逻辑 ===
const audioPlayer = document.getElementById('audioPlayer');
const playlistContainer = document.getElementById('playlistContainer');
const songInfo = document.getElementById('songInfo');
let currentTrack = 0;

function loadPlaylist() {
    playlist.forEach((track, index) => {
        const item = document.createElement('div');
        item.className = 'playlist-item';
        item.textContent = track.name;
        item.dataset.index = index;
        item.addEventListener('click', () => playTrack(index));
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

function playTrack(index) {
    currentTrack = index;
    audioPlayer.src = playlist[currentTrack].path;
    audioPlayer.play();
    updateActiveTrack();
    updateSongInfo();
    updateMediaSession();
}

audioPlayer.addEventListener('ended', () => {
    if (currentTrack < playlist.length - 1) {
        playTrack(currentTrack + 1);
    } else {
        playTrack(0);
    }
});

loadPlaylist();
updateActiveTrack();
playTrack(0);
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
    if ('mediaSession' in navigator) {
        const track = playlist[currentTrack];
        navigator.mediaSession.metadata = new window.MediaMetadata({
            title: track.name,
            artist: track.artist,
            album: '',
            artwork: [
                { src: COVER_IMAGE, sizes: '512x512', type: 'image/png' },
                { src: COVER_IMAGE, sizes: '192x192', type: 'image/png' }
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