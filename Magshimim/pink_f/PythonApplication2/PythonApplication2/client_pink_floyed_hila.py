import socket
#the fuction display the menu
#input:none
#output:none
def display_menu():
    print("-menu-")
    print("|1|album list")
    print("|2|list of songs in album")
    print("|3|get song length")
    print("|4|get lyrics of song ")
    print("|5|in which album is the song? ")
    print("|6|search song by name ")
    print("|7|search song by lyrics in the song")
    print("|8|exit")

def main():
    host = '127.0.0.1'
    port = 9090

    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.connect((host, port))

          
            print(sock.recv(4096).decode())

            
            while True:
                display_menu()
                try:
                    choice = input("Enter your choice (1-8): ")
                    if not choice.isdigit() or int(choice) < 1 or int(choice) > 8:
                        raise ValueError("Invalid input: Please enter a number between 1 and 8.")

                    if choice == '8':  # Exit choice
                        
                        sock.sendall('100&exit'.encode())
                        response = sock.recv(4096).decode()
                        print("Exiting...")
                        break
                    elif choice == '1':
                        sock.sendall('100&album'.encode())
                    elif choice == '2':
                        print("enter album")
                        album_name=input()
                        sock.sendall(('200&'+album_name).encode())
                        

                    elif choice == '3':
                        print("enter song:")
                        song=input()
                        sock.sendall(('300&'+song).encode())
                    elif choice == '4':
                        print("enter song:")
                        song=input()
                        sock.sendall(('400&'+song).encode())
                    elif choice == '5':
                        print("enter song:")
                        song=input()
                        sock.sendall(('500&'+song).encode())
                    elif choice == '6':
                        print("enter song:")
                        song=input()
                        sock.sendall(('600&'+song).encode())
                    elif choice == '7':
                        print("enter lyric:")
                        song=input()
                        sock.sendall(('700&'+song).encode())
                    # Receive and print the server response
                    response = sock.recv(4096).decode()
                    print("Server response:", response)
                except ValueError as e:
                    print(e)

    except ConnectionRefusedError:
        print("Connection failed: The server is unavailable or the address is incorrect.")
    except socket.error as e:
        print(f"Network error: {e}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    main()
