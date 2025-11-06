import os
import yt_dlp
import spotipy
from spotipy.oauth2 import SpotifyClientCredentials
from dotenv import load_dotenv
load_dotenv()

SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")

sp = spotipy.Spotify(auth_manager=SpotifyClientCredentials(
    client_id=SPOTIFY_CLIENT_ID,
    client_secret=SPOTIFY_CLIENT_SECRET
))

def download_audio(query, output_path):
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': output_path,
        'quiet': True,
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'wav',
            'preferredquality': '192',
        }],
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([f"ytsearch1:{query}"])

def fetch_playlist_songs(playlist_url):
    playlist = sp.playlist_tracks(playlist_url)
    tracks = []
    for item in playlist['items']:
        track = item['track']
        title = track['name']
        artist = track['artists'][0]['name']
        tracks.append((title, artist))
    return tracks

def build_dataset(playlist_url):
    tracks = fetch_playlist_songs(playlist_url)
    for title, artist in tracks:
        folder = os.path.join("dataset", artist)
        os.makedirs(folder, exist_ok=True)
        output_file = os.path.join(folder, f"{title}.wav")
        query = f"{title} {artist} audio"
        print(f"Downloading: {query}")
        download_audio(query, output_file)
    print("✅ Dataset built successfully!")

if __name__ == "__main__":
    playlist_link = input("Enter Spotify playlist link: ")
    build_dataset(playlist_link)
