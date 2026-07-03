import socket
import select
import hashlib


import data

def main():
    albums = data.main()  # Load album data
    server_socket = setup_server('127.0.0.1', 9090)
    clients = []
    try:
        while True:
            read_sockets, _, _ = select.select([server_socket] + clients, [], [])
            for sock in read_sockets:
                if sock == server_socket:
                    client_socket, addr = server_socket.accept()
                    clients.append(client_socket)
                    send_welcome(client_socket)
                else:
                    handle_client(sock, clients, albums)
    finally:
        for client in clients:
            client.close()
        server_socket.close()

def setup_server(host, port):
    """ Sets up the server socket. """
    server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_socket.bind((host, port))
    server_socket.listen(5)
    return server_socket

def send_welcome(client_socket):
    """ Sends a welcome message to the client. """
    welcome_message = "Welcome to the Pink Floyd Archive Server!\n"
    client_socket.sendall(welcome_message.encode())

def handle_client(client_socket, clients, albums):
    """ Receives data from the client and processes commands. """
    try:
        data = client_socket.recv(4096)
        if not data:
            clients.remove(client_socket)
            client_socket.close()
            return

        decoded_data = try_decode(data)
        if decoded_data and decoded_data.strip():
            process_command(decoded_data.strip(), client_socket, albums)
        else:
            print("Failed to decode data or no data provided.")
    except ConnectionResetError:
        clients.remove(client_socket)
        client_socket.close()

def try_decode(data):
    """ Tries to decode the incoming data using UTF-8 encoding. """
    try:
        return data.decode('utf-8')
    except UnicodeDecodeError:
        return None

def process_command(command, client_socket, albums):
    """ Determines the type of command and calls the appropriate function. """
    if command == 'exit':
        farewell_msg = "Goodbye!\n"
        client_socket.sendall(farewell_msg.encode())
        client_socket.close()
    else:
        args = command.split('&')
        if args[0] == '100':
            result = album_list(albums)
        elif args[0] == '200' and len(args) > 1:
            result = songs_list_in_album(albums, args[1])
        elif args[0] == '300' and len(args) > 1:
            result = songs_len(albums, args[1])
        elif args[0] == '400' and len(args) > 1:
            result = songs_lyrics(albums, args[1])
        elif args[0] == '500' and len(args) > 1:
            result = which_album_is_this_song(albums, args[1])
        elif args[0] == '600' and len(args) > 1:
            result = search_song_by_name(albums, args[1])
        elif args[0] == '700' and len(args) > 1:
            result = search_song_by_song_lyric(albums, args[1])
        else:
            result = "Invalid command\n"
        client_socket.sendall(result.encode())

def album_list(albums):
    """ Returns a list of all albums. """
    return "100&" + "\n".join(albums.keys()) + "\n"

def songs_list_in_album(albums, album_name):
    """ Returns a list of songs for a specific album. """
    if album_name in albums:
        songs = albums[album_name]['songs']
        return "200&" + "\n".join(songs.keys()) + "\n"
    return "200&Album not found\n"

def songs_len(albums, song_name):
    """ Returns the length of a specific song. """
    for album in albums.values():
        if song_name in album['songs']:
            return f"300&{song_name} length: {album['songs'][song_name]['time']}\n"
    return "300&Song not found\n"

def songs_lyrics(albums, song_name):
    """ Returns the lyrics of a specific song. """
    for album in albums.values():
        if song_name in album['songs']:
            lyrics = "\n".join(album['songs'][song_name]['lyrics'])
            return f"400&Lyrics of {song_name}: \n{lyrics}\n"
    return "400&Song not found\n"

def which_album_is_this_song(albums, song_name):
    """ Determines which album a song belongs to. """
    for album_name, album in albums.items():
        if song_name in album['songs']:
            return f"500&{song_name} is in album {album_name}\n"
    return "500&Song not found\n"

def search_song_by_name(albums, name):
    """ Searches for songs by name. """
    result = "600&"
    name = name.lower()
    for album_name, album in albums.items():
        for song in album['songs']:
            if name in song.lower():
                result += f"{song} from {album_name}\n"
    return result.strip() + "\n"

def search_song_by_song_lyric(albums, lyric):
    """ Searches for songs by a snippet of their lyrics. """
    result = "700&"
    lyric = lyric.lower()
    for album_name, album in albums.items():
        for song, details in album['songs'].items():
            if any(lyric in line.lower() for line in details['lyrics']):
                result += f"{song} from {album_name}\n"
    return result.strip() + "\n"


if __name__ == "__main__":
    main()
