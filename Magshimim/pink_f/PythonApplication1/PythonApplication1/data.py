
def main():
     # Initialize data structures
    all_albums = {}
    current_album = None   

    # Using a raw string to handle file path
    with open(r"C:\Users\Cyber_User\Desktop\pink_f\Pink_Floyd_DB.txt", "r") as file_data:
        for data in file_data:
            data = data.strip()  # Strip newline and whitespace

            if data.startswith("#"):
                # Extracting album name and year from the lines starting with '#'
                parts = data.lstrip('#').split("::")
                if len(parts) >= 2:
                    album_name = parts[0]
                    album_year = parts[1]
                    current_album = album_name
                    all_albums[current_album] = {'year': album_year, 'songs': {}}

            elif data.startswith("*") and current_album:
                # Extracting song details from lines starting with '*'
                parts = data.lstrip('*').split("::")
                if len(parts) >= 4:
                    song_name = parts[0]
                    who_wrote_the_song = parts[1]
                    time = parts[2]
                    lyrics = parts[3]
                    all_albums[current_album]['songs'][song_name] = {
                        'written_by': who_wrote_the_song,
                        'time': time,
                        'lyrics': [lyrics]
                    }
            elif current_album and data and 'songs' in all_albums[current_album] and list(all_albums[current_album]['songs'])[-1]:
                # Adding additional lyrics to the last song entered if the line doesn't start with '*' or '#'
                last_song_name = list(all_albums[current_album]['songs'])[-1]
                all_albums[current_album]['songs'][last_song_name]['lyrics'].append(data)
    return all_albums

    # Print all data to verify structure
    # for album, details in all_albums.items():
    #     print(f"Album Name: {album}")
    #     print(f"Album Year: {details['year']}")
    #     for song, song_details in details['songs'].items():
    #         print(f"  Song Name: {song}")
    #         print(f"  Written By: {song_details['written_by']}")
    #         print(f"  Time: {song_details['time']}")
    #         print("  Lyrics:")
    #         for lyric in song_details['lyrics']:
    #             print(f"    {lyric}")
    #     print("\n")  # Adds a new line for better readability between albums


    
   

if __name__== '__main__':
    main()