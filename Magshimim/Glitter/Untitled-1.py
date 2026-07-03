import socket

IP = "cyber.glitter.org.il"
PORT = 1336
LEN = 1024

def send_message_to_server(sock_et_et, message):
    """
    לעשות ההערה פה
    """
    sock_et_et.sendall(message.encode())
    server_msg = sock_et_et.recv(LEN)
    return server_msg.decode()


def main():
    # Create a TCP/IP sock_etet
    sock_et = socket.socket(socket.AF_INET, socket.SOCK_STREAM)


    server_address = (IP, PORT)
    sock_et.connect(server_address)

    login = """100#{gli&&er}{"user_name":"hbl_28_22_1","password":"lala","enable_push_notifications":true}##"""
    send_message_to_server(sock_et, login)
    login = """110#{gli&&er}1260##"""
    send_message_to_server(sock_et, login)
    login = """310#{gli&&er}44584##"""
    send_message_to_server(sock_et, login)


    # set diffrent color
    setcolor_msg = """550#{gli&&er}{"feed_owner_id":48077,"publisher_id":48077,"publisher_screen_name":"lolaa","publisher_avatar":"im1","background_color":"Turquoise","date":"2024-07-08T12:27:46.559Z","content":"w","font_color":"black","id":-1}##"""
    # search msg
    search_msg = """300#{gli&&er}{"search_type":"SIMPLE","search_entry":"a"}##"""
    #send as diffrent user a post with link
    link_msg = """550#{gli&&er}{"feed_owner_id":43459,"publisher_id":48077,"publisher_screen_name":"lolaa","publisher_avatar":"im1","background_color":"Turquoise","date":"2024-07-08T12:27:46.559Z","content":"<a href='https://ilearn.cyber.org.il/?from_logout=true'>click</a>","font_color":"black","id":-1}##"""

    #send in a diffrent time
    dif_time_msg = """550#{gli&&er}{"feed_owner_id":43459,"publisher_id":48077,"publisher_screen_name":"lolaa","publisher_avatar":"im1","background_color":"Turquoise","date":"2020-07-08T12:27:46.559Z","content":"<a href='https://ilearn.cyber.org.il/?from_logout=true'>click</a>","font_color":"black","id":-1}##"""


    final_response = send_message_to_server(sock_et, setcolor_msg)
    print(final_response)
    final_response = send_message_to_server(sock_et, link_msg)
    print(final_response)
    final_response = send_message_to_server(sock_et, search_msg)
    print(final_response)
    final_response = send_message_to_server(sock_et, dif_time_msg)
    print(final_response)

    # Closing the sock_etet
    sock_et.close()


if __name__ == "__main__":
    main()
 #user:hbl_28_22_1 pass:lala